"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  textilePatternInputSchema,
  type TextilePatternInput,
} from "@/lib/validators/textile-pattern"
import type {
  TextilePatternRow,
  TextilePatternStatusValue,
  PatternTypeOption,
} from "@/lib/types/textile-pattern"

/**
 * B-066: 柄マスター（TextilePattern・層2）Server Actions。
 * 仕様: docs/specs/b-066-textile-pattern-master-spec-confirmation-v1_1-2026-06-17.md
 * - shunya-master-patterns v1.2 §5 標準の 8 関数構成（textile-pattern-types.ts を雛形）。
 * - status は VarChar(20)（enum 化しない）。sortOrder 未指定時は末尾採番。
 * - typeId は TextilePatternType への緩い参照（@relation なし）。種別名は別取得してアプリ側結合。
 * - AuditLog の entityType は "TextilePattern" で統一。
 * - ★checkTextilePatternUsage: 現時点で柄を参照する先（ProductColorway.patternId）は未存在＝B-066-③で増設。
 *   よって現状は参照0固定（削除可）。③のPRで productColorway.count({where:{patternId:id}}) を追加すること。
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type TextilePatternUsage = {
  colorwayCount: number
  totalRefs: number
}

const AUDIT_ENTITY_TYPE = "TextilePattern"

// =============================================================================
// 種別名の結合ヘルパー（typeId 緩い参照 → typeCode/typeName マップ）
// =============================================================================
async function buildTypeMap(companyId: string, typeIds: (string | null)[]) {
  const ids = [...new Set(typeIds.filter((v): v is string => !!v))]
  if (ids.length === 0) return new Map<string, { typeCode: string; typeName: string }>()
  const types = await prisma.textilePatternType.findMany({
    where: { id: { in: ids }, companyId },
    select: { id: true, typeCode: true, typeName: true },
  })
  return new Map(types.map((t) => [t.id, { typeCode: t.typeCode, typeName: t.typeName }]))
}

async function nextSortOrder(companyId: string): Promise<number> {
  const last = await prisma.textilePattern.findFirst({
    where: { companyId, deletedAt: null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })
  return (last?.sortOrder ?? 0) + 10
}

// =============================================================================
// 種別ドロップダウン用（ACTIVE な TextilePatternType）
// =============================================================================
export async function listActivePatternTypes(): Promise<PatternTypeOption[]> {
  const session = await auth()
  if (!session?.user) return []
  const companyId = session.user.companyId
  if (!companyId) return []
  const rows = await prisma.textilePatternType.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }],
    select: { id: true, typeCode: true, typeName: true },
  })
  return rows
}

// =============================================================================
// 1. 一覧取得
// =============================================================================
export type ListTextilePatternsParams = {
  q?: string
  status?: TextilePatternStatusValue
  page?: number
  pageSize?: number
}

export async function listTextilePatterns(params: ListTextilePatternsParams) {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? 20))
  const skip = (page - 1) * pageSize

  const where: Prisma.TextilePatternWhereInput = {
    companyId,
    deletedAt: null,
  }
  if (params.status) where.status = params.status
  if (params.q && params.q.trim() !== "") {
    const q = params.q.trim()
    where.OR = [
      { patternNumber: { contains: q, mode: "insensitive" } },
      { patternName: { contains: q, mode: "insensitive" } },
    ]
  }

  const [total, rows] = await Promise.all([
    prisma.textilePattern.count({ where }),
    prisma.textilePattern.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }],
      skip,
      take: pageSize,
    }),
  ])

  const typeMap = await buildTypeMap(companyId, rows.map((r) => r.typeId))
  const patterns: TextilePatternRow[] = rows.map((r) => {
    const t = r.typeId ? typeMap.get(r.typeId) ?? null : null
    return {
      id: r.id,
      patternNumber: r.patternNumber,
      patternName: r.patternName,
      typeId: r.typeId,
      typeCode: t?.typeCode ?? null,
      typeName: t?.typeName ?? null,
      sortOrder: r.sortOrder,
      status: r.status,
    }
  })

  return {
    patterns,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  }
}

// =============================================================================
// 2. 詳細取得（種別名つき）
// =============================================================================
export async function getTextilePattern(
  id: string,
): Promise<TextilePatternRow | null> {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const r = await prisma.textilePattern.findFirst({
    where: { id, companyId, deletedAt: null },
  })
  if (!r) return null
  const typeMap = await buildTypeMap(companyId, [r.typeId])
  const t = r.typeId ? typeMap.get(r.typeId) ?? null : null
  return {
    id: r.id,
    patternNumber: r.patternNumber,
    patternName: r.patternName,
    typeId: r.typeId,
    typeCode: t?.typeCode ?? null,
    typeName: t?.typeName ?? null,
    sortOrder: r.sortOrder,
    status: r.status,
  }
}

// =============================================================================
// 3. 新規作成
// =============================================================================
export async function createTextilePattern(
  input: TextilePatternInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = textilePatternInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      }
    }
    const data = parsed.data

    const conflict = await prisma.textilePattern.findFirst({
      where: { companyId, patternNumber: data.patternNumber, deletedAt: null },
    })
    if (conflict) {
      return { ok: false, error: `柄番号 "${data.patternNumber}" は既に存在します` }
    }

    const sortOrder = data.sortOrder ?? (await nextSortOrder(companyId))

    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.textilePattern.create({
        data: {
          companyId,
          patternNumber: data.patternNumber,
          patternName: data.patternName,
          typeId: data.typeId,
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
            patternNumber: c.patternNumber,
            patternName: c.patternName,
            typeId: c.typeId,
            sortOrder: c.sortOrder,
            status: c.status,
          },
        },
      })
      return c
    })

    revalidatePath("/textile-patterns")
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "柄の作成に失敗しました",
    }
  }
}

// =============================================================================
// 4. 更新
// =============================================================================
export async function updateTextilePattern(
  id: string,
  input: TextilePatternInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = textilePatternInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      }
    }
    const data = parsed.data

    const existing = await prisma.textilePattern.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!existing) return { ok: false, error: "柄が見つかりません" }

    if (data.patternNumber !== existing.patternNumber) {
      const conflict = await prisma.textilePattern.findFirst({
        where: {
          companyId,
          patternNumber: data.patternNumber,
          deletedAt: null,
          NOT: { id },
        },
      })
      if (conflict) {
        return { ok: false, error: `柄番号 "${data.patternNumber}" は既に存在します` }
      }
    }

    const sortOrder = data.sortOrder ?? existing.sortOrder

    await prisma.$transaction(async (tx) => {
      const updated = await tx.textilePattern.update({
        where: { id },
        data: {
          patternNumber: data.patternNumber,
          patternName: data.patternName,
          typeId: data.typeId,
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
            patternNumber: existing.patternNumber,
            patternName: existing.patternName,
            typeId: existing.typeId,
            sortOrder: existing.sortOrder,
            status: existing.status,
          },
          afterData: {
            patternNumber: updated.patternNumber,
            patternName: updated.patternName,
            typeId: updated.typeId,
            sortOrder: updated.sortOrder,
            status: updated.status,
          },
        },
      })
    })

    revalidatePath("/textile-patterns")
    revalidatePath(`/textile-patterns/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "柄の更新に失敗しました",
    }
  }
}

// =============================================================================
// 5. アーカイブ
// =============================================================================
export async function archiveTextilePattern(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.textilePattern.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) return { ok: false, error: "対象の柄が見つかりません" }
    if (before.status === "ARCHIVED") {
      return { ok: false, error: "既にアーカイブされています" }
    }

    await prisma.$transaction(async (tx) => {
      const after = await tx.textilePattern.update({
        where: { id },
        data: { status: "ARCHIVED" },
      })
      await tx.auditLog.create({
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
    })

    revalidatePath("/textile-patterns")
    revalidatePath(`/textile-patterns/${id}`)
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
export async function restoreTextilePattern(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.textilePattern.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) return { ok: false, error: "対象の柄が見つかりません" }
    if (before.status !== "ARCHIVED") {
      return { ok: false, error: "アーカイブされていない柄は復元できません" }
    }

    await prisma.$transaction(async (tx) => {
      const after = await tx.textilePattern.update({
        where: { id },
        data: { status: "ACTIVE" },
      })
      await tx.auditLog.create({
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
    })

    revalidatePath("/textile-patterns")
    revalidatePath(`/textile-patterns/${id}`)
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
// ★B-066-② 時点では柄を参照する先（ProductColorway.patternId）が未存在のため常に 0 件。
//   ③のPRで patternId 増設時に productColorway.count({where:{patternId:id}}) を追加する。
// =============================================================================
export async function checkTextilePatternUsage(
  id: string,
): Promise<TextilePatternUsage> {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const pattern = await prisma.textilePattern.findFirst({
    where: { id, companyId },
  })
  if (!pattern) throw new Error("柄が見つかりません")

  // ③で ProductColorway.patternId 増設後に実装する
  const colorwayCount = 0

  return { colorwayCount, totalRefs: colorwayCount }
}

// =============================================================================
// 8. 物理削除（4 重ガード）
// =============================================================================
export async function deleteTextilePatternPermanently(
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
      return { ok: false, error: "物理削除はマスター管理者のみ実行可能です" }
    }

    const existing = await prisma.textilePattern.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!existing) return { ok: false, error: "柄が見つかりません" }
    if (existing.status !== "ARCHIVED") {
      return { ok: false, error: "アーカイブ済みの柄のみ物理削除できます" }
    }
    if (confirmationName.trim() !== existing.patternName) {
      return { ok: false, error: "確認名が一致しません" }
    }

    const usage = await checkTextilePatternUsage(id)
    if (usage.totalRefs > 0) {
      return {
        ok: false,
        error: `${usage.colorwayCount} 件のカラーウェイから参照されています`,
      }
    }

    await runWithoutTenantContext(async () => {
      await prisma.textilePattern.delete({ where: { id } })
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "DELETE",
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        beforeData: {
          patternNumber: existing.patternNumber,
          patternName: existing.patternName,
          typeId: existing.typeId,
          sortOrder: existing.sortOrder,
          status: existing.status,
        },
      },
    })

    revalidatePath("/textile-patterns")
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}
