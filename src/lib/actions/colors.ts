"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  colorInputSchema,
  deriveColorIndices,
  type ColorInput,
  type ColorStatusValue,
} from "@/lib/validators/color"
import type { ColorPickerOption } from "@/lib/types/color"

/**
 * Phase 1A-13c: 色マスター（Color）Server Actions
 *
 * 設計方針（spec 2026-06-01 / PR-2 ブリーフ）:
 * - shunya-master-patterns v1.2 §5 標準の 8 関数構成
 * - colorNumber から hueGroup/toneStep/sortOrder を派生（create / update 共通）
 * - status は VarChar(20) 文字列（"ACTIVE"/"ARCHIVED"）。enum 化はしない
 * - checkColorUsage は PR-2 時点では参照先が未接続のため常に 0 件
 *   （PR-3 で Material.availableColors と接続したら拡張）
 */

// =============================================================================
// 戻り値の型
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type ColorUsage = {
  materialCount: number
  totalRefs: number
}

// =============================================================================
// 1. 一覧取得
// =============================================================================
export type ListColorsParams = {
  q?: string
  status?: ColorStatusValue
  hueGroup?: number
  page?: number
  pageSize?: number
}

export async function listColors(params: ListColorsParams) {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? 20))
  const skip = (page - 1) * pageSize

  const where: Prisma.ColorWhereInput = {
    companyId,
    deletedAt: null,
  }

  if (params.status) where.status = params.status
  if (typeof params.hueGroup === "number") where.hueGroup = params.hueGroup
  if (params.q && params.q.trim() !== "") {
    const q = params.q.trim()
    where.OR = [
      { colorNumber: { contains: q, mode: "insensitive" } },
      { colorName: { contains: q, mode: "insensitive" } },
    ]
  }

  const [total, colors] = await Promise.all([
    prisma.color.count({ where }),
    prisma.color.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }],
      skip,
      take: pageSize,
    }),
  ])

  return {
    colors,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  }
}

// =============================================================================
// 2. 詳細取得
// =============================================================================
export async function getColor(id: string) {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  return prisma.color.findFirst({
    where: { id, companyId, deletedAt: null },
  })
}

// =============================================================================
// 3. 新規作成
// =============================================================================
export async function createColor(
  input: ColorInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = colorInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      }
    }
    const data = parsed.data

    // colorNumber 重複チェック
    const conflict = await prisma.color.findFirst({
      where: { companyId, colorNumber: data.colorNumber, deletedAt: null },
    })
    if (conflict) {
      return {
        ok: false,
        error: `色番号 "${data.colorNumber}" は既に存在します`,
      }
    }

    const { hueGroup, toneStep, sortOrder } = deriveColorIndices(
      data.colorNumber,
    )

    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.color.create({
        data: {
          companyId,
          colorNumber: data.colorNumber,
          colorName: data.colorName,
          colorNameEn: data.colorNameEn || null,
          hueGroup,
          toneStep,
          cmyk: data.cmyk,
          hex: data.hex,
          impression: data.impression || null,
          sortOrder,
          status: data.status,
        },
      })

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "CREATE",
          entityType: "Color",
          entityId: c.id,
          afterData: {
            colorNumber: c.colorNumber,
            colorName: c.colorName,
            colorNameEn: c.colorNameEn,
            hueGroup: c.hueGroup,
            toneStep: c.toneStep,
            cmyk: c.cmyk,
            hex: c.hex,
            status: c.status,
          },
        },
      })

      return c
    })

    revalidatePath("/colors")
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "色の作成に失敗しました",
    }
  }
}

// =============================================================================
// 4. 更新
// =============================================================================
export async function updateColor(
  id: string,
  input: ColorInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = colorInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      }
    }
    const data = parsed.data

    const existing = await prisma.color.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "色が見つかりません" }
    }

    // colorNumber 重複チェック（自分以外）
    if (data.colorNumber !== existing.colorNumber) {
      const conflict = await prisma.color.findFirst({
        where: {
          companyId,
          colorNumber: data.colorNumber,
          deletedAt: null,
          NOT: { id },
        },
      })
      if (conflict) {
        return {
          ok: false,
          error: `色番号 "${data.colorNumber}" は既に存在します`,
        }
      }
    }

    const { hueGroup, toneStep, sortOrder } = deriveColorIndices(
      data.colorNumber,
    )

    await prisma.$transaction(async (tx) => {
      const updated = await tx.color.update({
        where: { id },
        data: {
          colorNumber: data.colorNumber,
          colorName: data.colorName,
          colorNameEn: data.colorNameEn || null,
          hueGroup,
          toneStep,
          cmyk: data.cmyk,
          hex: data.hex,
          impression: data.impression || null,
          sortOrder,
          status: data.status,
        },
      })

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "UPDATE",
          entityType: "Color",
          entityId: id,
          beforeData: {
            colorNumber: existing.colorNumber,
            colorName: existing.colorName,
            colorNameEn: existing.colorNameEn,
            cmyk: existing.cmyk,
            hex: existing.hex,
            status: existing.status,
          },
          afterData: {
            colorNumber: updated.colorNumber,
            colorName: updated.colorName,
            colorNameEn: updated.colorNameEn,
            cmyk: updated.cmyk,
            hex: updated.hex,
            status: updated.status,
          },
        },
      })
    })

    revalidatePath("/colors")
    revalidatePath(`/colors/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "色の更新に失敗しました",
    }
  }
}

// =============================================================================
// 5. アーカイブ
// =============================================================================
export async function archiveColor(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.color.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) {
      return { ok: false, error: "対象の色が見つかりません" }
    }
    if (before.status === "ARCHIVED") {
      return { ok: false, error: "既にアーカイブされています" }
    }

    const after = await prisma.color.update({
      where: { id },
      data: { status: "ARCHIVED" },
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        entityType: "Color",
        entityId: id,
        beforeData: { status: before.status },
        afterData: { status: after.status },
      },
    })

    revalidatePath("/colors")
    revalidatePath(`/colors/${id}`)
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
export async function restoreColor(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.color.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) {
      return { ok: false, error: "対象の色が見つかりません" }
    }
    if (before.status !== "ARCHIVED") {
      return {
        ok: false,
        error: "アーカイブされていない色は復元できません",
      }
    }

    const after = await prisma.color.update({
      where: { id },
      data: { status: "ACTIVE" },
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        entityType: "Color",
        entityId: id,
        beforeData: { status: before.status },
        afterData: { status: after.status },
      },
    })

    revalidatePath("/colors")
    revalidatePath(`/colors/${id}`)
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
// PR-2 時点では Color を参照する先（Material.availableColors / SKU 等）が
// 未接続のため、常に 0 件を返す最小実装。PR-3 で Material 連携時に拡張する。
// =============================================================================
export async function checkColorUsage(id: string): Promise<ColorUsage> {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const color = await prisma.color.findFirst({
    where: { id, companyId },
  })
  if (!color) {
    throw new Error("色が見つかりません")
  }

  // PR-3 で Material.availableColors を Color 参照へ移行した際に実装する
  const materialCount = 0

  return {
    materialCount,
    totalRefs: materialCount,
  }
}

// =============================================================================
// 8. 物理削除（4 重ガード）
// =============================================================================
export async function deleteColorPermanently(
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

    const existing = await prisma.color.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "色が見つかりません" }
    }

    if (existing.status !== "ARCHIVED") {
      return {
        ok: false,
        error: "アーカイブ済みの色のみ物理削除できます",
      }
    }

    if (confirmationName.trim() !== existing.colorName) {
      return { ok: false, error: "確認名が一致しません" }
    }

    const usage = await checkColorUsage(id)
    if (usage.totalRefs > 0) {
      return {
        ok: false,
        error: `素材 ${usage.materialCount} 件から参照されています`,
      }
    }

    await runWithoutTenantContext(async () => {
      await prisma.color.delete({ where: { id } })
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "DELETE",
        entityType: "Color",
        entityId: id,
        beforeData: {
          colorNumber: existing.colorNumber,
          colorName: existing.colorName,
          cmyk: existing.cmyk,
          hex: existing.hex,
          status: existing.status,
        },
      },
    })

    revalidatePath("/colors")
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}

// =============================================================================
// B-063: カラーピッカー用の軽量取得（read のみ）。
//   戻り列は id / colorNumber / colorName / hueGroup / toneStep / hex のみ。
//   auth + companyId スコープ + deletedAt:null + status="ACTIVE"・sortOrder 昇順。
// =============================================================================
// 型は中立モジュール（@/lib/types/color）に置く（client が "use server" から型を引くと
// ブラウザバンドルに @prisma/client が漏れるため）。ここでは値を再 export しない。
export async function listActiveColorsForPicker(): Promise<ColorPickerOption[]> {
  const session = await auth()
  if (!session?.user) return []
  const companyId = session.user.companyId
  if (!companyId) return []

  return prisma.color.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }],
    select: {
      id: true,
      colorNumber: true,
      colorName: true,
      colorNameEn: true,
      hueGroup: true,
      toneStep: true,
      hex: true,
    },
  })
}
