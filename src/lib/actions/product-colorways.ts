"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  productColorwayInputSchema,
  type ProductColorwayInput,
} from "@/lib/validators/product-colorway"

/**
 * B-062 β: 製品カラーウェイ（ProductColorway）Server Actions。
 * 仕様: docs/specs/product-overview-one-page-spec-confirmation-v0_4-2026-06-15.md §2 / §5-3
 * - colors.ts 流儀（auth() 直 + session.user.companyId・$transaction + auditLog）。
 * - 素の prisma + 明示 companyId スコープ。runWithoutTenantContext は使わない（permanent delete を作らないため）。
 * - 本 PR は ProductColorway の CRUD のみ。BomItemColorway 編集・colorId 配線は次 PR / B-063。
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type ColorwayRow = {
  id: string
  colorwayCode: string
  colorwayName: string
  colorId: string | null
  colorHex: string | null
  patternId: string | null
  sortOrder: number
  status: string
}

// =============================================================================
// 1. 一覧取得（品番配下・live のみ。ARCHIVED も含めて返し UI 側でバッジ表示）
// =============================================================================
export async function listColorways(
  productId: string,
): Promise<ActionResult<ColorwayRow[]>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    if (!companyId) return { ok: false, error: "テナント情報が取得できません" }

    const rows = await prisma.productColorway.findMany({
      where: { productId, companyId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { colorwayCode: "asc" }],
      select: {
        id: true,
        colorwayCode: true,
        colorwayName: true,
        colorId: true,
        colorHex: true,
        patternId: true,
        sortOrder: true,
        status: true,
      },
    })
    return { ok: true, data: rows }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "カラーウェイの取得に失敗しました",
    }
  }
}

// =============================================================================
// 2. 単一取得
// =============================================================================
export async function getColorway(
  id: string,
): Promise<ActionResult<ColorwayRow & { productId: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    if (!companyId) return { ok: false, error: "テナント情報が取得できません" }

    const row = await prisma.productColorway.findFirst({
      where: { id, companyId, deletedAt: null },
      select: {
        id: true,
        productId: true,
        colorwayCode: true,
        colorwayName: true,
        colorId: true,
        colorHex: true,
        patternId: true,
        sortOrder: true,
        status: true,
      },
    })
    if (!row) return { ok: false, error: "カラーウェイが見つかりません" }
    return { ok: true, data: row }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "カラーウェイの取得に失敗しました",
    }
  }
}

// =============================================================================
// 3. 作成
// =============================================================================
export async function createColorway(
  productId: string,
  input: ProductColorwayInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = productColorwayInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      }
    }
    const data = parsed.data

    // 品番の所有確認（companyId スコープ）
    const product = await prisma.product.findFirst({
      where: { id: productId, companyId, deletedAt: null },
      select: { id: true },
    })
    if (!product) return { ok: false, error: "品番が見つかりません" }

    // colorwayCode 重複チェック（@@unique([productId, colorwayCode])）
    const conflict = await prisma.productColorway.findFirst({
      where: { productId, colorwayCode: data.colorwayCode, deletedAt: null },
    })
    if (conflict) {
      return {
        ok: false,
        error: `カラーウェイ記号 "${data.colorwayCode}" は既に存在します`,
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.productColorway.create({
        data: {
          companyId,
          productId,
          colorwayCode: data.colorwayCode,
          colorwayName: data.colorwayName,
          colorId: data.colorId,
          colorHex: data.colorHex || null,
          patternId: data.patternId,
          sortOrder: data.sortOrder,
          status: data.status,
        },
        select: { id: true },
      })
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "CREATE",
          entityType: "ProductColorway",
          entityId: c.id,
          afterData: {
            productId,
            colorwayCode: data.colorwayCode,
            colorwayName: data.colorwayName,
            status: data.status,
          },
        },
      })
      return c
    })

    revalidatePath(`/products/${productId}`)
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "カラーウェイの作成に失敗しました",
    }
  }
}

// =============================================================================
// 4. 更新
// =============================================================================
export async function updateColorway(
  id: string,
  input: ProductColorwayInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = productColorwayInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      }
    }
    const data = parsed.data

    const existing = await prisma.productColorway.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!existing) return { ok: false, error: "カラーウェイが見つかりません" }

    // colorwayCode 重複チェック（自分以外・同一品番内）
    if (data.colorwayCode !== existing.colorwayCode) {
      const conflict = await prisma.productColorway.findFirst({
        where: {
          productId: existing.productId,
          colorwayCode: data.colorwayCode,
          deletedAt: null,
          NOT: { id },
        },
      })
      if (conflict) {
        return {
          ok: false,
          error: `カラーウェイ記号 "${data.colorwayCode}" は既に存在します`,
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.productColorway.update({
        where: { id },
        data: {
          colorwayCode: data.colorwayCode,
          colorwayName: data.colorwayName,
          colorId: data.colorId,
          colorHex: data.colorHex || null,
          patternId: data.patternId,
          sortOrder: data.sortOrder,
          status: data.status,
        },
      })
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "UPDATE",
          entityType: "ProductColorway",
          entityId: id,
          beforeData: {
            colorwayCode: existing.colorwayCode,
            colorwayName: existing.colorwayName,
            colorHex: existing.colorHex,
            sortOrder: existing.sortOrder,
            status: existing.status,
          },
          afterData: {
            colorwayCode: updated.colorwayCode,
            colorwayName: updated.colorwayName,
            colorHex: updated.colorHex,
            sortOrder: updated.sortOrder,
            status: updated.status,
          },
        },
      })
    })

    revalidatePath(`/products/${existing.productId}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "カラーウェイの更新に失敗しました",
    }
  }
}

// =============================================================================
// 5. アーカイブ（status=ARCHIVED）
// =============================================================================
export async function archiveColorway(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.productColorway.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) return { ok: false, error: "対象のカラーウェイが見つかりません" }
    if (before.status === "ARCHIVED") {
      return { ok: false, error: "既にアーカイブされています" }
    }

    await prisma.$transaction(async (tx) => {
      const after = await tx.productColorway.update({
        where: { id },
        data: { status: "ARCHIVED" },
      })
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "UPDATE",
          entityType: "ProductColorway",
          entityId: id,
          beforeData: { status: before.status },
          afterData: { status: after.status },
        },
      })
    })

    revalidatePath(`/products/${before.productId}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "アーカイブに失敗しました",
    }
  }
}

// =============================================================================
// 6. 復元（status=ACTIVE）
// =============================================================================
export async function restoreColorway(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.productColorway.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) return { ok: false, error: "対象のカラーウェイが見つかりません" }
    if (before.status !== "ARCHIVED") {
      return { ok: false, error: "アーカイブされていないカラーウェイは復元できません" }
    }

    await prisma.$transaction(async (tx) => {
      const after = await tx.productColorway.update({
        where: { id },
        data: { status: "ACTIVE" },
      })
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "UPDATE",
          entityType: "ProductColorway",
          entityId: id,
          beforeData: { status: before.status },
          afterData: { status: after.status },
        },
      })
    })

    revalidatePath(`/products/${before.productId}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "復元に失敗しました",
    }
  }
}
