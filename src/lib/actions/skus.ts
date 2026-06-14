"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * B-064: 品番配下の SKU（色×サイズ＋数量群）を読み取り専用で取得。
 * 数量は量産ライフサイクルの値（受注=orderedQuantity / 量産=productionQuantity 他）。
 * 書き込みなし・Decimal なし＝正規化不要。
 * house style: requireSession はこのプロジェクトでは各 action ファイルにローカル定義
 *   （共有 @/lib/auth-helpers は存在しない）。boms.ts と同型にする。
 */

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

export type SkuRow = {
  id: string
  colorCode: string
  colorName: string
  size: string
  sizeOrder: number
  orderedQuantity: number
  productionQuantity: number
  producedQuantity: number
  deliveredQuantity: number
  defectQuantity: number
  remainingStock: number
}

export async function listSkusForProduct(
  productId: string,
): Promise<{ ok: true; data: SkuRow[] } | { ok: false; error: string }> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const rows = await prisma.sku.findMany({
      where: { productId, companyId: sess.companyId, deletedAt: null },
      orderBy: [{ colorCode: "asc" }, { sizeOrder: "asc" }, { size: "asc" }],
      select: {
        id: true,
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
      },
    })
    return { ok: true, data: rows }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "SKU の取得に失敗しました",
    }
  }
}
