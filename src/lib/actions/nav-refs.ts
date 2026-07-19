"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * B-078-1: パンくず（ツリー表示）用の関連参照解決。
 * WO/PO は productId / sampleProductionId（scalar）しか持たないため、
 * パンくずの「品番 › サンプル › 伝票」を描くのに必要な最小情報だけを read-only で引く。
 */
export type NavProductRef = {
  id: string
  productCode: string
  clientProductCode: string | null
}
export type NavSampleRef = { id: string; sampleNumber: string; productId: string }

export async function getNavRefs(
  productId: string | null | undefined,
  sampleProductionId: string | null | undefined,
): Promise<{ product: NavProductRef | null; sample: NavSampleRef | null }> {
  const session = await auth()
  if (!session?.user) return { product: null, sample: null }
  const companyId = session.user.companyId

  let sample: NavSampleRef | null = null
  let resolvedProductId = productId ?? null
  if (sampleProductionId) {
    const sp = await prisma.sampleProduction.findFirst({
      where: { id: sampleProductionId, companyId },
      select: { id: true, sampleNumber: true, productId: true },
    })
    if (sp) {
      sample = sp
      if (!resolvedProductId) resolvedProductId = sp.productId
    }
  }

  let product: NavProductRef | null = null
  if (resolvedProductId) {
    product = await prisma.product.findFirst({
      where: { id: resolvedProductId, companyId },
      select: { id: true, productCode: true, clientProductCode: true },
    })
  }
  return { product, sample }
}
