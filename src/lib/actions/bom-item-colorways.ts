"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  bomItemColorwayInputSchema,
  type BomItemColorwayInput,
} from "@/lib/validators/bom-item-colorway"

/**
 * B-062 β 次PR: 資材×カラーウェイの調達カラー（BomItemColorway）Server Actions。
 * 仕様: docs/specs/product-overview-one-page-spec-confirmation-v0_4-2026-06-15.md §1-2 / §4
 * - product-colorways.ts 流儀（auth() 直 + $transaction + auditLog + revalidatePath）。
 * - BomItemColorway に companyId 列は無い → 親経由でスコープ検証:
 *   bomItem → bom → {companyId, productId} を引き、bom.companyId === session.companyId を確認。
 *   productColorway も同社確認（findFirst with companyId）。
 * - migration なし（テーブルは #83 で作成済み）。
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type BomItemColorwayCell = {
  productColorwayId: string
  supplierColorCode: string
  supplierColorName: string | null
}

// =============================================================================
// 1. 描画用一括取得（bom 配下の BomItemColorway を bomItemId でグルーピング）
// =============================================================================
export async function listColorwaysByBomItems(
  bomId: string,
): Promise<ActionResult<Record<string, BomItemColorwayCell[]>>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    if (!companyId) return { ok: false, error: "テナント情報が取得できません" }

    // bom の同社確認
    const bom = await prisma.bom.findFirst({
      where: { id: bomId, companyId, deletedAt: null },
      select: { id: true },
    })
    if (!bom) return { ok: true, data: {} }

    // bom 配下の bomItem の id 群
    const items = await prisma.bomItem.findMany({
      where: { bomId },
      select: { id: true },
    })
    const itemIds = items.map((i) => i.id)
    if (itemIds.length === 0) return { ok: true, data: {} }

    const rows = await prisma.bomItemColorway.findMany({
      where: { bomItemId: { in: itemIds } },
      select: {
        bomItemId: true,
        productColorwayId: true,
        supplierColorCode: true,
        supplierColorName: true,
      },
    })

    const grouped: Record<string, BomItemColorwayCell[]> = {}
    for (const r of rows) {
      const cell: BomItemColorwayCell = {
        productColorwayId: r.productColorwayId,
        supplierColorCode: r.supplierColorCode,
        supplierColorName: r.supplierColorName,
      }
      const arr = grouped[r.bomItemId]
      if (arr) arr.push(cell)
      else grouped[r.bomItemId] = [cell]
    }
    return { ok: true, data: grouped }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "カラーウェイ調達色の取得に失敗しました",
    }
  }
}

// =============================================================================
// 2. upsert（値あり=作成/更新・空=削除）
// =============================================================================
export async function upsertBomItemColorway(
  input: BomItemColorwayInput,
): Promise<ActionResult<{ id?: string; deleted?: boolean }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = bomItemColorwayInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      }
    }
    const data = parsed.data

    // 親経由 companyId 検証: bomItem → bom
    const bomItem = await prisma.bomItem.findFirst({
      where: { id: data.bomItemId },
      select: { id: true, bomId: true },
    })
    if (!bomItem) return { ok: false, error: "対象の資材明細が見つかりません" }
    const bom = await prisma.bom.findFirst({
      where: { id: bomItem.bomId, companyId, deletedAt: null },
      select: { id: true, productId: true },
    })
    if (!bom) return { ok: false, error: "対象が見つかりません" }

    // productColorway 同社確認
    const colorway = await prisma.productColorway.findFirst({
      where: { id: data.productColorwayId, companyId, deletedAt: null },
      select: { id: true },
    })
    if (!colorway) return { ok: false, error: "カラーウェイが見つかりません" }

    const code = data.supplierColorCode.trim()
    const name = data.supplierColorName.trim()

    // 既存セル
    const existing = await prisma.bomItemColorway.findFirst({
      where: {
        bomItemId: data.bomItemId,
        productColorwayId: data.productColorwayId,
      },
    })

    // 空文字 → 既存あれば削除
    if (code === "") {
      if (!existing) return { ok: true, data: {} }
      await prisma.$transaction(async (tx) => {
        await tx.bomItemColorway.delete({ where: { id: existing.id } })
        await tx.auditLog.create({
          data: {
            companyId,
            userId,
            action: "DELETE",
            entityType: "BomItemColorway",
            entityId: existing.id,
            beforeData: {
              bomItemId: existing.bomItemId,
              productColorwayId: existing.productColorwayId,
              supplierColorCode: existing.supplierColorCode,
            },
          },
        })
      })
      revalidatePath(`/products/${bom.productId}`)
      return { ok: true, data: { deleted: true } }
    }

    // 値あり → upsert
    const saved = await prisma.$transaction(async (tx) => {
      if (existing) {
        const u = await tx.bomItemColorway.update({
          where: { id: existing.id },
          data: { supplierColorCode: code, supplierColorName: name || null },
        })
        await tx.auditLog.create({
          data: {
            companyId,
            userId,
            action: "UPDATE",
            entityType: "BomItemColorway",
            entityId: existing.id,
            beforeData: {
              supplierColorCode: existing.supplierColorCode,
              supplierColorName: existing.supplierColorName,
            },
            afterData: {
              supplierColorCode: u.supplierColorCode,
              supplierColorName: u.supplierColorName,
            },
          },
        })
        return u
      }
      const c = await tx.bomItemColorway.create({
        data: {
          bomItemId: data.bomItemId,
          productColorwayId: data.productColorwayId,
          supplierColorCode: code,
          supplierColorName: name || null,
        },
      })
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "CREATE",
          entityType: "BomItemColorway",
          entityId: c.id,
          afterData: {
            bomItemId: data.bomItemId,
            productColorwayId: data.productColorwayId,
            supplierColorCode: c.supplierColorCode,
          },
        },
      })
      return c
    })

    revalidatePath(`/products/${bom.productId}`)
    return { ok: true, data: { id: saved.id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "カラーウェイ調達色の保存に失敗しました",
    }
  }
}
