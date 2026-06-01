"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  textilePatternTypeInputSchema,
  type TextilePatternTypeInput,
  type TextilePatternTypeStatusValue,
} from "@/lib/validators/textile-pattern-type"

/**
 * Phase 1A-13d: 柄種別マスター（TextilePatternType）Server Actions
 *
 * 設計方針（spec v0.2 2026-06-01 / PR-2 ブリーフ）:
 * - shunya-master-patterns v1.2 §5 標準の 8 関数構成
 * - status は VarChar(20)（軽量カテゴリ前例）
 * - sortOrder 未指定時は actions 層で「既存最大 + 10」を補完
 * - checkTextilePatternTypeUsage は PR-2 時点では参照先が未接続のため常に 0 件
 *   （Material 連携が入る将来 PR で拡張）
 * - AuditLog の entityType は seed と揃えて "TextilePatternType" 統一
 */

// =============================================================================
// 戻り値の型
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type TextilePatternTypeUsage = {
  materialCount: number
  totalRefs: number
}

const AUDIT_ENTITY_TYPE = "TextilePatternType"

// =============================================================================
// sortOrder 末尾採番ヘルパー
// =============================================================================
async function nextSortOrder(companyId: string): Promise<number> {
  const last = await prisma.textilePatternType.findFirst({
    where: { companyId, deletedAt: null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })
  return (last?.sortOrder ?? 0) + 10
}

// =============================================================================
// 1. 一覧取得
// =============================================================================
export type ListTextilePatternTypesParams = {
  q?: string
  status?: TextilePatternTypeStatusValue
  page?: number
  pageSize?: number
}

export async function listTextilePatternTypes(
  params: ListTextilePatternTypesParams,
) {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? 20))
  const skip = (page - 1) * pageSize

  const where: Prisma.TextilePatternTypeWhereInput = {
    companyId,
    deletedAt: null,
  }

  if (params.status) where.status = params.status
  if (params.q && params.q.trim() !== "") {
    const q = params.q.trim()
    where.OR = [
      { typeCode: { contains: q, mode: "insensitive" } },
      { typeName: { contains: q, mode: "insensitive" } },
    ]
  }

  const [total, patternTypes] = await Promise.all([
    prisma.textilePatternType.count({ where }),
    prisma.textilePatternType.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }],
      skip,
      take: pageSize,
    }),
  ])

  return {
    patternTypes,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  }
}

// =============================================================================
// 2. 詳細取得
// =============================================================================
export async function getTextilePatternType(id: string) {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  return prisma.textilePatternType.findFirst({
    where: { id, companyId, deletedAt: null },
  })
}

// =============================================================================
// 3. 新規作成
// =============================================================================
export async function createTextilePatternType(
  input: TextilePatternTypeInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = textilePatternTypeInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      }
    }
    const data = parsed.data

    // typeCode 重複チェック
    const conflict = await prisma.textilePatternType.findFirst({
      where: { companyId, typeCode: data.typeCode, deletedAt: null },
    })
    if (conflict) {
      return {
        ok: false,
        error: `柄種別コード "${data.typeCode}" は既に存在します`,
      }
    }

    // sortOrder 未指定時は末尾採番
    const sortOrder = data.sortOrder ?? (await nextSortOrder(companyId))

    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.textilePatternType.create({
        data: {
          companyId,
          typeCode: data.typeCode,
          typeName: data.typeName,
          description: data.description || null,
          sortOrder,
          status: data.status,
        },
      })

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "CREATE",
          entityType: AUDIT_ENTITY_TYPE,
          entityId: c.id,
          afterData: {
            typeCode: c.typeCode,
            typeName: c.typeName,
            description: c.description,
            sortOrder: c.sortOrder,
            status: c.status,
          },
        },
      })

      return c
    })

    revalidatePath("/textile-pattern-types")
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "柄種別の作成に失敗しました",
    }
  }
}

// =============================================================================
// 4. 更新
// =============================================================================
export async function updateTextilePatternType(
  id: string,
  input: TextilePatternTypeInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = textilePatternTypeInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      }
    }
    const data = parsed.data

    const existing = await prisma.textilePatternType.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "柄種別が見つかりません" }
    }

    // typeCode 重複チェック（自分以外）
    if (data.typeCode !== existing.typeCode) {
      const conflict = await prisma.textilePatternType.findFirst({
        where: {
          companyId,
          typeCode: data.typeCode,
          deletedAt: null,
          NOT: { id },
        },
      })
      if (conflict) {
        return {
          ok: false,
          error: `柄種別コード "${data.typeCode}" は既に存在します`,
        }
      }
    }

    // sortOrder 未指定時は既存値を維持（編集で空にしても既存末尾採番にしない）
    const sortOrder = data.sortOrder ?? existing.sortOrder

    await prisma.$transaction(async (tx) => {
      const updated = await tx.textilePatternType.update({
        where: { id },
        data: {
          typeCode: data.typeCode,
          typeName: data.typeName,
          description: data.description || null,
          sortOrder,
          status: data.status,
        },
      })

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "UPDATE",
          entityType: AUDIT_ENTITY_TYPE,
          entityId: id,
          beforeData: {
            typeCode: existing.typeCode,
            typeName: existing.typeName,
            description: existing.description,
            sortOrder: existing.sortOrder,
            status: existing.status,
          },
          afterData: {
            typeCode: updated.typeCode,
            typeName: updated.typeName,
            description: updated.description,
            sortOrder: updated.sortOrder,
            status: updated.status,
          },
        },
      })
    })

    revalidatePath("/textile-pattern-types")
    revalidatePath(`/textile-pattern-types/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "柄種別の更新に失敗しました",
    }
  }
}

// =============================================================================
// 5. アーカイブ
// =============================================================================
export async function archiveTextilePatternType(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.textilePatternType.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) {
      return { ok: false, error: "対象の柄種別が見つかりません" }
    }
    if (before.status === "ARCHIVED") {
      return { ok: false, error: "既にアーカイブされています" }
    }

    const after = await prisma.textilePatternType.update({
      where: { id },
      data: { status: "ARCHIVED" },
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        beforeData: { status: before.status },
        afterData: { status: after.status },
      },
    })

    revalidatePath("/textile-pattern-types")
    revalidatePath(`/textile-pattern-types/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "アーカイブに失敗しました",
    }
  }
}

// =============================================================================
// 6. 復元
// =============================================================================
export async function restoreTextilePatternType(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.textilePatternType.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) {
      return { ok: false, error: "対象の柄種別が見つかりません" }
    }
    if (before.status !== "ARCHIVED") {
      return {
        ok: false,
        error: "アーカイブされていない柄種別は復元できません",
      }
    }

    const after = await prisma.textilePatternType.update({
      where: { id },
      data: { status: "ACTIVE" },
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        beforeData: { status: before.status },
        afterData: { status: after.status },
      },
    })

    revalidatePath("/textile-pattern-types")
    revalidatePath(`/textile-pattern-types/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "復元に失敗しました",
    }
  }
}

// =============================================================================
// 7. 紐付きチェック
//
// PR-2 時点では TextilePatternType を参照する先 (Material 側の柄種別参照など)
// が未接続のため、常に 0 件を返す最小実装。将来 PR で Material 連携時に拡張する。
// =============================================================================
export async function checkTextilePatternTypeUsage(
  id: string,
): Promise<TextilePatternTypeUsage> {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const patternType = await prisma.textilePatternType.findFirst({
    where: { id, companyId },
  })
  if (!patternType) {
    throw new Error("柄種別が見つかりません")
  }

  // 将来 Material 側に柄種別参照が入った時に実装する
  const materialCount = 0

  return {
    materialCount,
    totalRefs: materialCount,
  }
}

// =============================================================================
// 8. 物理削除（4 重ガード）
// =============================================================================
export async function deleteTextilePatternTypePermanently(
  id: string,
  confirmationName: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { tenantType: true },
    })
    if (company?.tenantType !== "MASTER_ADMIN") {
      return {
        ok: false,
        error: "物理削除はマスター管理者のみ実行可能です",
      }
    }

    const existing = await prisma.textilePatternType.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "柄種別が見つかりません" }
    }

    if (existing.status !== "ARCHIVED") {
      return {
        ok: false,
        error: "アーカイブ済みの柄種別のみ物理削除できます",
      }
    }

    if (confirmationName.trim() !== existing.typeName) {
      return { ok: false, error: "確認名が一致しません" }
    }

    const usage = await checkTextilePatternTypeUsage(id)
    if (usage.totalRefs > 0) {
      return {
        ok: false,
        error: `素材 ${usage.materialCount} 件から参照されています`,
      }
    }

    await runWithoutTenantContext(async () => {
      await prisma.textilePatternType.delete({ where: { id } })
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "DELETE",
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        beforeData: {
          typeCode: existing.typeCode,
          typeName: existing.typeName,
          description: existing.description,
          sortOrder: existing.sortOrder,
          status: existing.status,
        },
      },
    })

    revalidatePath("/textile-pattern-types")
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}
