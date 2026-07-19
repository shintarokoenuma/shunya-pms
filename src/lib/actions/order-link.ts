"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * B-078-4: 発注（WO/PO）直アクセス作成時の「品番 → サンプル（任意）」紐付けピッカー用の候補。
 * 品番必須（§4-1(d) 案件化強制）。サンプルは選択品番で client 側フィルタする前提で全件返す。
 */
export type OrderLinkProduct = {
  id: string
  productCode: string
  clientProductCode: string | null
  productName: string
}
export type OrderLinkSample = {
  id: string
  sampleNumber: string
  productId: string
  title: string | null
}

export async function getOrderLinkOptions(): Promise<{
  products: OrderLinkProduct[]
  samples: OrderLinkSample[]
}> {
  const session = await auth()
  if (!session?.user) return { products: [], samples: [] }
  const companyId = session.user.companyId

  const [products, samples] = await Promise.all([
    prisma.product.findMany({
      where: { companyId, deletedAt: null },
      select: {
        id: true,
        productCode: true,
        clientProductCode: true,
        productName: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.sampleProduction.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, sampleNumber: true, productId: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ])
  return { products, samples }
}
