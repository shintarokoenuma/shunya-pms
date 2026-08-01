"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  sewingInstructionInputSchema,
  parseSewingInstruction,
} from "@/lib/validators/sewing-instruction"

/**
 * B-094: 品番カルテ 縫製指示 Server Actions（product-sketches.ts の専用 action + 専用 AuditLog を踏襲）。
 * 仕様: docs/specs/b-094-sewing-instruction-spec-confirmation-v1_0-2026-08-01.md §4-4
 * - sewingInstructions(Json) は Json 全体を置き換える（部分更新しない）。
 * - ProductAuditField から Exclude 済みのため、変更履歴はこの専用 AuditLog に必ず残す。
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

async function requireSession() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, error: "認証されていません" }
  }
  return {
    ok: true as const,
    companyId: session.user.companyId,
    userId: session.user.id,
  }
}

export async function updateSewingInstructions(
  productId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const product = await prisma.product.findFirst({
      where: { id: productId, companyId: sess.companyId, deletedAt: null },
      select: { id: true, sewingInstructions: true },
    })
    if (!product) return { ok: false, error: "品番が見つかりません" }

    const parsed = sewingInstructionInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }

    // 変更前後を専用 AuditLog に記録（ProductAuditField から Exclude 済みのため）。
    const before = parseSewingInstruction(product.sewingInstructions)
    const after = parsed.data

    await prisma.product.update({
      where: { id: productId },
      data: { sewingInstructions: after },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Product",
        entityId: productId,
        beforeData: before,
        afterData: after,
      },
    })

    revalidatePath(`/products/${productId}`)
    revalidatePath("/products")
    return { ok: true, data: undefined }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "縫製指示の更新に失敗しました",
    }
  }
}
