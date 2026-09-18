"use server"

import { revalidatePath } from "next/cache"
import type { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import type { CommentView } from "@/lib/types/comment"
import {
  createProductCommentSchema,
  updateProductCommentSchema,
  deleteProductCommentSchema,
} from "@/lib/validators/comment"

/**
 * B-202 PR-3: 品番カルテ メモ欄（Comment）Server Actions。
 * 仕様: docs/specs/b-202-product-karte-one-screen-spec-confirmation-v1_0-2026-09-12.md D-7 /
 *       docs/specs/b-202-spec-addendum-v0_1-2026-09-13.md Q6 / addendum v0.2 D-9 / v0.5 §2
 * - product-sketches.ts の骨格を鏡写し（requireSession → 品番の所有確認 → 書き込み → AuditLog → revalidate）。
 * - ★schema 変更なし。comments / comment_mentions の DDL は 2026-05-16 の init で適用済み（v0.2 D-9）。
 * - 多態列は attachedToType="product" / attachedToId=productId に固定。既存の
 *   @@index([companyId, attachedToType, attachedToId]) に乗る。全クエリに companyId を含める。
 * - 初版で書く列: companyId / attachedToType / attachedToId / content / contentFormat(PLAIN) / authorUserId / authorRole。
 *   commentType・priority・language・isExternalAuthor は DB 既定に任せる（v1.0 D-7「初版で使わない列」）。
 * - ★社外ユーザー（role=EXTERNAL）には既定拒否: list は空配列、create / update / delete は拒否
 *   （B-172 D-4 のホワイトリストに入れない）。
 * - 編集は自分のメモのみ。isEdited / editedAt を立て、originalContent は「まだ null のときだけ」初版の文面を残す。
 * - 削除は deletedAt の論理削除のみ（物理削除しない）。
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

const ATTACHED_TO_TYPE = "product"

async function requireSession() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, error: "認証されていません" }
  }
  return {
    ok: true as const,
    companyId: session.user.companyId,
    userId: session.user.id,
    role: session.user.role as UserRole,
  }
}

const EXTERNAL_DENIED = "メモは社外ユーザーには公開していません"

/** 品番の所有確認（companyId スコープ）。product-sketches.ts の loadProduct と同形。 */
async function loadProduct(productId: string, companyId: string) {
  return prisma.product.findFirst({
    where: { id: productId, companyId, deletedAt: null },
    select: { id: true },
  })
}

/** 自分のメモを1件読む（companyId・品番・論理削除・authorUserId で絞る）。 */
async function loadOwnComment(
  commentId: string,
  productId: string,
  companyId: string,
  userId: string,
) {
  return prisma.comment.findFirst({
    where: {
      id: commentId,
      companyId,
      attachedToType: ATTACHED_TO_TYPE,
      attachedToId: productId,
      authorUserId: userId,
      deletedAt: null,
    },
    select: { id: true, content: true, originalContent: true },
  })
}

/**
 * 書いた人の名前を一括解決する（N+1 にしない）。
 * displayName ?? `${lastName} ${firstName}`。products.ts の private ヘルパーと同形だが export はしない。
 * ★deletedAt で絞らない（退職した書き手の名前が「—」に消えるのを避ける）。companyId スコープは必須。
 */
async function fetchAuthorNamesByIds(
  companyId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()
  const rows = await prisma.user.findMany({
    where: { id: { in: userIds }, companyId },
    select: { id: true, displayName: true, lastName: true, firstName: true },
  })
  return new Map(
    rows.map((u) => [u.id, u.displayName ?? `${u.lastName} ${u.firstName}`]),
  )
}

// =============================================================================
// 1. 一覧（新しい順・全件・ページングなし）
// =============================================================================
export async function listProductComments(
  productId: string,
): Promise<ActionResult<CommentView[]>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: true, data: [] }

    const product = await loadProduct(productId, sess.companyId)
    if (!product) return { ok: false, error: "品番が見つかりません" }

    const rows = await prisma.comment.findMany({
      where: {
        companyId: sess.companyId,
        attachedToType: ATTACHED_TO_TYPE,
        attachedToId: productId,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
        authorUserId: true,
        createdAt: true,
        isEdited: true,
      },
    })
    const names = await fetchAuthorNamesByIds(sess.companyId, [
      ...new Set(rows.map((r) => r.authorUserId)),
    ])
    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        content: r.content,
        authorUserId: r.authorUserId,
        authorName: names.get(r.authorUserId) ?? "—",
        createdAt: r.createdAt.toISOString(),
        isEdited: r.isEdited,
        canEdit: r.authorUserId === sess.userId,
      })),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "メモの取得に失敗しました" }
  }
}

// =============================================================================
// 2. 作成
// =============================================================================
export async function createProductComment(
  productId: string,
  content: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }

    const parsed = createProductCommentSchema.safeParse({ productId, content })
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") }
    }

    const product = await loadProduct(parsed.data.productId, sess.companyId)
    if (!product) return { ok: false, error: "品番が見つかりません" }

    const created = await prisma.comment.create({
      data: {
        companyId: sess.companyId,
        attachedToType: ATTACHED_TO_TYPE,
        attachedToId: parsed.data.productId,
        content: parsed.data.content,
        contentFormat: "PLAIN",
        authorUserId: sess.userId,
        authorRole: sess.role,
      },
      select: { id: true },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "CREATE",
        entityType: "Comment",
        entityId: created.id,
        afterData: {
          action: "create_product_comment",
          productId: parsed.data.productId,
          content: parsed.data.content,
        },
      },
    })

    revalidatePath(`/products/${parsed.data.productId}`)
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "メモの保存に失敗しました" }
  }
}

// =============================================================================
// 3. 更新（自分のメモのみ・初版の文面は originalContent に残す）
// =============================================================================
export async function updateProductComment(
  productId: string,
  commentId: string,
  content: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }

    const parsed = updateProductCommentSchema.safeParse({ productId, commentId, content })
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") }
    }

    const product = await loadProduct(parsed.data.productId, sess.companyId)
    if (!product) return { ok: false, error: "品番が見つかりません" }

    const existing = await loadOwnComment(
      parsed.data.commentId,
      parsed.data.productId,
      sess.companyId,
      sess.userId,
    )
    if (!existing) return { ok: false, error: "メモが見つからないか、編集できません" }
    if (existing.content === parsed.data.content) {
      return { ok: true, data: { id: existing.id } } // 変更なし: update も AuditLog も出さない
    }

    await prisma.comment.update({
      where: { id: existing.id },
      data: {
        content: parsed.data.content,
        isEdited: true,
        editedAt: new Date(),
        // 初版の文面だけ残す（2回目以降の編集では上書きしない）
        ...(existing.originalContent === null
          ? { originalContent: existing.content }
          : {}),
      },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Comment",
        entityId: existing.id,
        beforeData: { action: "update_product_comment", content: existing.content },
        afterData: { action: "update_product_comment", content: parsed.data.content },
      },
    })

    revalidatePath(`/products/${parsed.data.productId}`)
    return { ok: true, data: { id: existing.id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "メモの更新に失敗しました" }
  }
}

// =============================================================================
// 4. 削除（論理削除・自分のメモのみ）
// =============================================================================
export async function deleteProductComment(
  productId: string,
  commentId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }

    const parsed = deleteProductCommentSchema.safeParse({ productId, commentId })
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") }
    }

    const product = await loadProduct(parsed.data.productId, sess.companyId)
    if (!product) return { ok: false, error: "品番が見つかりません" }

    const existing = await loadOwnComment(
      parsed.data.commentId,
      parsed.data.productId,
      sess.companyId,
      sess.userId,
    )
    if (!existing) return { ok: false, error: "メモが見つからないか、削除できません" }

    await prisma.comment.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "Comment",
        entityId: existing.id,
        beforeData: { action: "delete_product_comment", content: existing.content },
      },
    })

    revalidatePath(`/products/${parsed.data.productId}`)
    return { ok: true, data: { id: existing.id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "メモの削除に失敗しました" }
  }
}
