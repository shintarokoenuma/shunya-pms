import { InvoiceStatus, type PaymentMethod } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { COMPANY_PROFILE, type CompanyBankAccount } from "@/lib/constants/company-profile"
import { toYmd } from "@/lib/calc/invoice-period"
import { listClientPayments } from "@/lib/billing/client-payments"
import {
  buildInvoiceRows,
  buildPaymentRows,
  pdfText,
  type InvoicePdfRow,
} from "./invoice-rows"

/**
 * B-109 PR-4: 請求書 PDF 用のデータ組み立て（companyId・deletedAt で絞る）。
 * - 6枠と税の内訳は保存した列をそのまま出す（D-35・PDF 側で計算し直さない）
 * - 発行者欄はスナップショット列（P4-D5）。FAX・MAIL はスナップショットが無いので COMPANY_PROFILE
 * - 振込先は bankInfo（P4-D4）。null（本 PR より前の請求書）なら COMPANY_PROFILE.bank
 * - 明細は納品の行＋入金の行を日付順に（P4-D7・P4-D8 は invoice-rows の純関数）
 */
export type InvoicePdfData = {
  invoiceNumber: string
  status: InvoiceStatus
  /** yyyy-MM-dd */
  invoiceDate: string
  periodStart: string
  periodEnd: string
  paymentDueDate: string
  /** 再発行のとき元の番号（P4-D10） */
  replacesInvoiceNumber: string | null
  billToName: string
  billToAddress: string
  issuerName: string
  issuerAddress: string
  issuerPhone: string
  issuerFax: string
  issuerEmail: string
  issuerTaxId: string
  previousBalanceAmount: number
  paymentReceivedAmount: number
  carriedForwardAmount: number
  subtotal: number
  totalTaxAmount: number
  totalAmount: number
  taxableAmount10: number
  taxAmount10: number
  taxableAmount8: number | null
  taxAmount8: number | null
  nonTaxableAmount: number
  bank: CompanyBankAccount
  rows: InvoicePdfRow[]
}

/** 入金の方法の紙面表記（「〔御入金〕振込」・P4-D7） */
const PAYMENT_METHOD_PDF: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "振込",
  WIRE_TRANSFER_TT: "T/T送金",
  LETTER_OF_CREDIT: "L/C",
  CASH: "現金",
  CREDIT_CARD: "カード",
  CHECK: "小切手",
  PAYPAL: "PayPal",
  WISE: "Wise",
  OTHER: "その他",
}

function isBankAccount(v: unknown): v is CompanyBankAccount {
  if (!v || typeof v !== "object") return false
  const o = v as Record<string, unknown>
  return ["bankName", "branchName", "accountType", "accountNumber", "accountHolder"].every(
    (k) => typeof o[k] === "string",
  )
}

export async function getInvoicePdfData(
  id: string,
  companyId: string,
): Promise<InvoicePdfData | null> {
  const row = await prisma.invoice.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { items: { orderBy: { itemOrder: "asc" } } },
  })
  if (!row) return null

  const replaces = row.replacesInvoiceId
    ? await prisma.invoice.findFirst({
        where: { id: row.replacesInvoiceId, companyId },
        select: { invoiceNumber: true },
      })
    : null

  // 納品書番号・納品日（deliveryNoteItemId から・親の companyId で絞る）
  const dnItemIds = row.items.map((it) => it.deliveryNoteItemId).filter((v): v is string => !!v)
  const dnItems = dnItemIds.length
    ? await prisma.deliveryNoteItem.findMany({
        where: { id: { in: dnItemIds }, deliveryNote: { companyId } },
        select: { id: true, deliveryNote: { select: { deliveryNumber: true, deliveryDate: true } } },
      })
    : []
  const dnById = new Map(dnItems.map((d) => [d.id, d.deliveryNote]))

  const periodStart = toYmd(row.periodStartDate)
  const periodEnd = toYmd(row.periodEndDate)

  // 期間の窓の入金（取消されていない・入金日順）。paymentWhere の 1 か所を通る
  const payments = await listClientPayments(companyId, row.clientId, {
    window: { start: periodStart, end: periodEnd },
    order: "asc",
  })
  const paymentRows = buildPaymentRows(
    payments.map((p) => ({
      paymentNumber: p.paymentNumber,
      paymentDate: p.paymentDate,
      methodLabel: PAYMENT_METHOD_PDF[p.paymentMethod] ?? "その他",
      amount: p.amount,
      createdAt: p.createdAt,
    })),
    row.createdAt.toISOString(),
    row.paymentReceivedAmount?.toNumber() ?? 0,
  )

  const lines = row.items.map((it) => {
    const dn = it.deliveryNoteItemId ? dnById.get(it.deliveryNoteItemId) : undefined
    return {
      deliveryDate: dn ? toYmd(dn.deliveryDate) : null,
      deliveryNumber: dn?.deliveryNumber ?? null,
      itemCode: it.itemCode,
      itemName: it.itemName,
      colorName: it.description,
      size: it.size,
      quantity: it.quantity.toNumber(),
      unitPrice: it.unitPrice.toNumber(),
      subtotal: it.subtotal.toNumber(),
    }
  })
  const nonTaxableAmount = row.items
    .filter((it) => it.taxClassification !== "STANDARD_10" && it.taxClassification !== "REDUCED_8")
    .reduce((a, it) => a + it.subtotal.toNumber(), 0)

  return {
    invoiceNumber: row.invoiceNumber,
    status: row.status,
    invoiceDate: toYmd(row.invoiceDate),
    periodStart,
    periodEnd,
    paymentDueDate: toYmd(row.paymentDueDate),
    replacesInvoiceNumber: replaces?.invoiceNumber ?? null,
    billToName: pdfText(row.billToName),
    billToAddress: pdfText(row.billToAddress),
    issuerName: pdfText(row.issuerName),
    issuerAddress: pdfText(row.issuerAddress),
    issuerPhone: pdfText(row.issuerPhone) || COMPANY_PROFILE.tel,
    issuerFax: COMPANY_PROFILE.fax,
    issuerEmail: pdfText(row.issuerEmail) || COMPANY_PROFILE.email,
    issuerTaxId: row.issuerTaxId,
    previousBalanceAmount: row.previousBalanceAmount?.toNumber() ?? 0,
    paymentReceivedAmount: row.paymentReceivedAmount?.toNumber() ?? 0,
    carriedForwardAmount: row.carriedForwardAmount?.toNumber() ?? 0,
    subtotal: row.subtotal.toNumber(),
    totalTaxAmount: row.totalTaxAmount?.toNumber() ?? 0,
    totalAmount: row.totalAmount.toNumber(),
    taxableAmount10: row.taxableAmount10?.toNumber() ?? 0,
    taxAmount10: row.taxAmount10?.toNumber() ?? 0,
    taxableAmount8: row.taxableAmount8?.toNumber() ?? null,
    taxAmount8: row.taxAmount8?.toNumber() ?? null,
    nonTaxableAmount,
    bank: isBankAccount(row.bankInfo) ? row.bankInfo : COMPANY_PROFILE.bank,
    rows: buildInvoiceRows(lines, paymentRows),
  }
}
