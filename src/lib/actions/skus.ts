"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { listColorways } from "@/lib/actions/product-colorways"
import type { SkuRow } from "@/lib/types/sku"

/**
 * SKU 設計: 品番配下の SKU（カラーウェイ × サイズ ＋ 数量群）。
 * - SkuRow は中立モジュール @/lib/types/sku に置く（client が "use server" から型 import する
 *   と @prisma/client がブラウザに漏れるため・index-browser 罠回避）。
 * - 数量は量産ライフサイクルの値（受注=orderedQuantity / 量産=productionQuantity 他）。
 * - house style: requireSession は各 action ファイルにローカル定義（共有 helper なし）。
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type { SkuRow } from "@/lib/types/sku"

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

// =============================================================================
// 1. 一覧取得（カラーウェイ情報込み・カラーウェイ sortOrder→サイズ順）
// =============================================================================
export async function listSkusForProduct(
  productId: string,
): Promise<{ ok: true; data: SkuRow[] } | { ok: false; error: string }> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const rows = await prisma.sku.findMany({
      where: { productId, companyId: sess.companyId, deletedAt: null },
      orderBy: [{ colorway: { sortOrder: "asc" } }, { sizeOrder: "asc" }, { size: "asc" }],
      select: {
        id: true,
        colorwayId: true,
        colorCode: true,
        colorName: true,
        size: true,
        sizeOrder: true,
        orderedQuantity: true,
        productionQuantity: true,
        producedQuantity: true,
        deliveredQuantity: true,
        defectQuantity: true,
        remainingStock: true,
        colorway: { select: { colorwayCode: true, colorwayName: true } },
      },
    })
    const data: SkuRow[] = rows.map((r) => ({
      id: r.id,
      colorwayId: r.colorwayId,
      colorwayCode: r.colorway.colorwayCode,
      colorwayName: r.colorway.colorwayName,
      colorCode: r.colorCode,
      colorName: r.colorName,
      size: r.size,
      sizeOrder: r.sizeOrder,
      orderedQuantity: r.orderedQuantity,
      productionQuantity: r.productionQuantity,
      producedQuantity: r.producedQuantity,
      deliveredQuantity: r.deliveredQuantity,
      defectQuantity: r.defectQuantity,
      remainingStock: r.remainingStock,
    }))
    return { ok: true, data }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "SKU の取得に失敗しました",
    }
  }
}

// =============================================================================
// 2. SKU 生成（ACTIVE カラーウェイ × サイズ の直積を upsert・冪等）
//    数量は引数 quantities（colorwayId|size → 受注数）or 0。skuCode で冪等。
// =============================================================================
export type SkuSizeInput = { size: string; sizeOrder: number }

export async function createSkusForProduct(
  productId: string,
  sizes: SkuSizeInput[],
  quantities?: Record<string, number>, // key: `${colorwayId}|${size}` → orderedQuantity
): Promise<ActionResult<{ count: number }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    if (!sizes || sizes.length === 0)
      return { ok: false, error: "サイズが指定されていません" }

    // 品番の所有確認＋productCode（skuCode 採番に使用）
    const product = await prisma.product.findFirst({
      where: { id: productId, companyId: sess.companyId, deletedAt: null },
      select: { id: true, productCode: true },
    })
    if (!product) return { ok: false, error: "品番が見つかりません" }

    // ACTIVE カラーウェイのみ（listColorways は ARCHIVED 含むため絞る）
    const cwResult = await listColorways(productId)
    if (!cwResult.ok) return cwResult
    const colorways = cwResult.data.filter((c) => c.status === "ACTIVE")
    if (colorways.length === 0)
      return { ok: false, error: "ACTIVE なカラーウェイがありません。先にカラー展開/柄展開を登録してください" }

    let count = 0
    await prisma.$transaction(async (tx) => {
      for (const cw of colorways) {
        for (const sz of sizes) {
          const skuCode = `${product.productCode}-${cw.colorwayCode}-${sz.size}`
          const ordered = quantities?.[`${cw.id}|${sz.size}`] ?? 0
          await tx.sku.upsert({
            where: { companyId_skuCode: { companyId: sess.companyId, skuCode } },
            update: {
              colorwayId: cw.id,
              colorCode: cw.colorwayCode,
              colorName: cw.colorwayName,
              size: sz.size,
              sizeOrder: sz.sizeOrder,
              orderedQuantity: ordered,
            },
            create: {
              companyId: sess.companyId,
              productId,
              skuCode,
              colorwayId: cw.id,
              colorCode: cw.colorwayCode,
              colorName: cw.colorwayName,
              size: sz.size,
              sizeOrder: sz.sizeOrder,
              orderedQuantity: ordered,
            },
          })
          count++
        }
      }
      await tx.auditLog.create({
        data: {
          companyId: sess.companyId,
          userId: sess.userId,
          action: "CREATE",
          entityType: "Sku",
          entityId: productId,
          afterData: {
            action: "generate_skus",
            colorways: colorways.length,
            sizes: sizes.length,
            count,
          },
        },
      })
    })

    revalidatePath(`/products/${productId}`)
    return { ok: true, data: { count } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "SKU の生成に失敗しました",
    }
  }
}
