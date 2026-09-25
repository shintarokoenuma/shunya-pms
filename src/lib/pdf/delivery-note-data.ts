import type { DeliveryLineKind, DeliveryNoteStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { toYmd } from "@/lib/calc/invoice-period"
import { pdfText } from "./invoice-rows"

/**
 * B-109 PR-4（P4-D12〜D14）: 納品書 PDF 用のデータ組み立て（companyId・deletedAt で絞る）。
 * - 消費税・税込合計は出さない（D-40）。旧データの tax_amount は読まない（P4-D14）
 * - showAmounts が false なら 単価・金額・小計 の列を出さない
 * - 数量合計は totalQuantity（前受金の行を含まない・PR-3）
 */
export type DeliveryNotePdfItem = {
  clientProductCode: string | null
  productName: string
  colorName: string | null
  size: string | null
  quantity: number
  unit: string
  unitPrice: number | null
  subtotal: number | null
  lineKind: DeliveryLineKind | null
}

export type DeliveryNotePdfData = {
  deliveryNumber: string
  status: DeliveryNoteStatus
  /** yyyy-MM-dd */
  deliveryDate: string
  clientName: string
  /** 明細の受注番号（重複なし・番号順） */
  soNumbers: string[]
  shipToAddress: string
  shipToContact: string
  shipToPhone: string
  showAmounts: boolean
  totalQuantity: number
  subtotalAmount: number | null
  clientNotes: string
  hasDepositLines: boolean
  items: DeliveryNotePdfItem[]
}

export async function getDeliveryNotePdfData(
  id: string,
  companyId: string,
): Promise<DeliveryNotePdfData | null> {
  const row = await prisma.deliveryNote.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { items: { orderBy: { itemOrder: "asc" } } },
  })
  if (!row) return null

  const client = await prisma.client.findFirst({
    where: { id: row.clientId, companyId },
    select: { companyName: true },
  })
  const soIds = [...new Set(row.items.map((it) => it.soId).filter((v): v is string => !!v))]
  const sos = soIds.length
    ? await prisma.salesOrder.findMany({
        where: { id: { in: soIds }, companyId },
        select: { soNumber: true },
        orderBy: { soNumber: "asc" },
      })
    : []

  return {
    deliveryNumber: row.deliveryNumber,
    status: row.status,
    deliveryDate: toYmd(row.deliveryDate),
    clientName: pdfText(client?.companyName ?? ""),
    soNumbers: sos.map((s) => s.soNumber),
    shipToAddress: pdfText(row.shipToAddress),
    shipToContact: pdfText(row.shipToContact),
    shipToPhone: pdfText(row.shipToPhone),
    showAmounts: row.showAmounts,
    totalQuantity: row.totalQuantity,
    subtotalAmount: row.subtotalAmount != null ? row.subtotalAmount.toNumber() : null,
    clientNotes: pdfText(row.clientNotes),
    hasDepositLines: row.items.some((it) => it.lineKind !== null),
    items: row.items.map((it) => ({
      clientProductCode: pdfText(it.clientProductCode) || null,
      productName: pdfText(it.productName),
      colorName: pdfText(it.colorName) || null,
      size: pdfText(it.size) || null,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unitPrice != null ? it.unitPrice.toNumber() : null,
      subtotal: it.subtotal != null ? it.subtotal.toNumber() : null,
      lineKind: it.lineKind,
    })),
  }
}
