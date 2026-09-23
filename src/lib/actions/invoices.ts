"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  InvoiceStatus,
  InvoiceType,
  InvoiceTransactionType,
  TaxClassification,
  type TaxRoundingMode,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { COMPANY_PROFILE } from "@/lib/constants/company-profile"
import { DELIVERY_NOTE_DELIVERED_STATUSES } from "@/lib/validators/delivery-note"
import {
  invoiceCreateSchema,
  invoiceCandidateQuerySchema,
  invoiceListParamsSchema,
  INVOICE_STATUS_TRANSITIONS,
  type InvoiceListParams,
} from "@/lib/validators/invoice"
import {
  computeInvoiceAmounts,
  TAX_RATE_PERCENT,
  type InvoiceAmounts,
} from "@/lib/calc/invoice-amounts"
import { addDaysYmd, fromYmd, toYmd } from "@/lib/calc/invoice-period"
import {
  listClientPayments,
  sumPayments,
  type ClientPaymentRow,
} from "@/lib/billing/client-payments"

/**
 * B-109 PR-2c: 合計請求書（繰越型）Server Actions（delivery-notes の作法を写経）。
 * 設計: docs/specs/b-109-pr2-implementation-brief-2026-09-23.md §4-4 / addendum v0.9 §2
 * - 採番 INV-{年}-{4桁}（保存時確定・P2002 リトライ）。★findFirst を deletedAt で絞らない。
 * - 候補 = DELIVERED 以降の納品書の明細のうち、期間内で、取消されていない請求書に載っていないもの（D-6・D-26）。
 * - 消費税は請求書1枚につき税率ごとに1回・その時点のクライアントの端数処理（D-22・D-23・D-35）。
 * - 繰越型: 前回御請求額 − 御入金額 = 繰越金額、今回御請求額 = 繰越金額 + 当月お買上げ額 + 消費税等（D-24・D-29）。
 * - 二重請求はサーバの保存時にも再確認する（UI だけに頼らない）。
 * - ★発行済み（SENT 以降）の請求書の金額を再計算する処理は書かない（D-35）。
 * - ★Invoice / InvoiceItem は TENANT_MODELS に無いため companyId / deletedAt を必ず明示する。
 * - 期間は periodStartDate / periodEndDate に保存する（導出しない。発行済みの期間が後からズレないように）。invoiceDate は請求日（＝締め日）。
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

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

/** 拡張クライアント（src/lib/prisma.ts）の $transaction が渡す tx の型。Prisma.TransactionClient とは合わない */
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// =============================================================================
// 選択肢（新規フォーム用・companyId スコープ）
// =============================================================================
export type InvoiceClientOption = {
  id: string
  clientCode: string
  companyName: string
  closingDay: number | null
  paymentMonthOffset: number | null
  paymentDay: number | null
  taxRoundingMode: TaxRoundingMode
}

export async function listActiveClientsForInvoiceSelect(): Promise<InvoiceClientOption[]> {
  const sess = await requireSession()
  if (!sess.ok) return []
  return prisma.client.findMany({
    where: { companyId: sess.companyId, deletedAt: null, status: "ACTIVE" },
    select: {
      id: true,
      clientCode: true,
      companyName: true,
      closingDay: true,
      paymentMonthOffset: true,
      paymentDay: true,
      taxRoundingMode: true,
    },
    orderBy: [{ clientCode: "asc" }],
  })
}

// =============================================================================
// 採番（INV-{年}-{4桁}）— delivery-notes.ts の computeNextDeliveryNumber を写す
// =============================================================================
type InvoiceNumberFinder = {
  findFirst: (args: {
    where: { companyId: string; invoiceNumber: { startsWith: string } }
    orderBy: { invoiceNumber: "desc" }
    select: { invoiceNumber: true }
  }) => Promise<{ invoiceNumber: string } | null>
}

function invoiceNumberPrefix(year: number): string {
  return `INV-${year}-`
}

async function computeNextInvoiceNumber(
  finder: InvoiceNumberFinder,
  companyId: string,
  prefix: string,
): Promise<string> {
  // ★deletedAt で絞らない：論理削除レコードも最大値判定に含める（番号の再利用を防ぐ）。
  const last = await finder.findFirst({
    where: { companyId, invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  })
  let nextNum = 1
  if (last) {
    const match = last.invoiceNumber.match(/-(\d+)$/)
    if (match) nextNum = parseInt(match[1], 10) + 1
  }
  return `${prefix}${String(nextNum).padStart(4, "0")}`
}

// =============================================================================
// 請求先住所（Client.billing* → Client 基本 の連鎖・B-108 §4-2 と同型・snapshot コピー）
// =============================================================================
type AddressParts = {
  postalCode?: string | null
  prefecture?: string | null
  city?: string | null
  address?: string | null
  addressLine2?: string | null
}

function composeAddress(p: AddressParts): string {
  const parts: string[] = []
  if (p.postalCode) parts.push(`〒${p.postalCode}`)
  const line = [p.prefecture, p.city, p.address, p.addressLine2]
    .filter((v): v is string => !!v && v.trim() !== "")
    .join(" ")
  if (line) parts.push(line)
  return parts.join(" ")
}

const ISSUER_ADDRESS = `${COMPANY_PROFILE.postalCode} ${COMPANY_PROFILE.address}`

// =============================================================================
// 候補（新規フォーム）
// =============================================================================
export type InvoiceCandidateRow = {
  deliveryNoteItemId: string
  deliveryNoteId: string
  deliveryNumber: string
  /** yyyy-MM-dd */
  deliveryDate: string
  productCode: string | null
  clientProductCode: string | null
  productName: string
  colorName: string | null
  colorCode: string | null
  size: string | null
  quantity: number
  /** 納品書で単価未定なら null（金額は 0 として扱う） */
  unitPrice: number | null
  subtotal: number
}

export type InvoiceCandidatesResult = {
  candidates: InvoiceCandidateRow[]
  previousInvoice: {
    id: string
    invoiceNumber: string
    invoiceDate: string
    totalAmount: number
  } | null
  /** 御入金額を集計した窓（前回の締め日の翌日〜今回の締め日） */
  paymentWindow: { start: string; end: string }
  paymentReceivedAmount: number
  taxRoundingMode: TaxRoundingMode
}

async function loadCandidateContext(
  companyId: string,
  q: { clientId: string; periodStart: string; periodEnd: string },
): Promise<
  | { ok: true; ctx: InvoiceCandidatesResult; client: ClientForInvoice }
  | { ok: false; error: string }
> {
  const client = await prisma.client.findFirst({
    where: { id: q.clientId, companyId, deletedAt: null },
    select: CLIENT_SELECT,
  })
  if (!client) return { ok: false, error: "クライアントが見つかりません" }

  // 候補: DELIVERED 以降・期間内の納品書の明細
  const notes = await prisma.deliveryNote.findMany({
    where: {
      companyId,
      clientId: client.id,
      deletedAt: null,
      status: { in: DELIVERY_NOTE_DELIVERED_STATUSES },
      deliveryDate: { gte: fromYmd(q.periodStart), lte: fromYmd(q.periodEnd) },
    },
    select: {
      id: true,
      deliveryNumber: true,
      deliveryDate: true,
      items: {
        orderBy: { itemOrder: "asc" },
        select: {
          id: true,
          productId: true,
          clientProductCode: true,
          productName: true,
          colorCode: true,
          colorName: true,
          size: true,
          quantity: true,
          unitPrice: true,
          subtotal: true,
        },
      },
    },
    orderBy: [{ deliveryDate: "asc" }, { deliveryNumber: "asc" }],
  })
  const allItemIds = notes.flatMap((n) => n.items.map((it) => it.id))

  // 取消されていない請求書に既に載っている明細を除く（D-6・二重請求の防止）
  const billed = allItemIds.length
    ? await prisma.invoiceItem.findMany({
        where: {
          deliveryNoteItemId: { in: allItemIds },
          invoice: { companyId, deletedAt: null, status: { not: InvoiceStatus.CANCELLED } },
        },
        select: { deliveryNoteItemId: true },
      })
    : []
  const billedIds = new Set(billed.map((b) => b.deliveryNoteItemId))

  // 品番コード（先方品番が無い行の表示用・manual join）
  const productIds = [...new Set(notes.flatMap((n) => n.items.map((it) => it.productId)))]
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds }, companyId },
        select: { id: true, productCode: true },
      })
    : []
  const productCodeById = new Map(products.map((p) => [p.id, p.productCode]))

  const candidates: InvoiceCandidateRow[] = []
  for (const n of notes) {
    for (const it of n.items) {
      if (billedIds.has(it.id)) continue
      const unitPrice = it.unitPrice != null ? it.unitPrice.toNumber() : null
      const subtotal =
        it.subtotal != null ? it.subtotal.toNumber() : Math.round(it.quantity * (unitPrice ?? 0))
      candidates.push({
        deliveryNoteItemId: it.id,
        deliveryNoteId: n.id,
        deliveryNumber: n.deliveryNumber,
        deliveryDate: toYmd(n.deliveryDate),
        productCode: productCodeById.get(it.productId) ?? null,
        clientProductCode: it.clientProductCode,
        productName: it.productName,
        colorName: it.colorName,
        colorCode: it.colorCode,
        size: it.size,
        quantity: it.quantity,
        unitPrice,
        subtotal,
      })
    }
  }

  // 直前の請求書（取消されていない・締め日の新しい順）
  const prev = await prisma.invoice.findFirst({
    where: {
      companyId,
      clientId: client.id,
      deletedAt: null,
      status: { not: InvoiceStatus.CANCELLED },
    },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      periodEndDate: true,
      totalAmount: true,
    },
  })

  // 御入金額: 前回の締め日（直前の請求書の periodEndDate）の翌日〜今回の締め日（直前が無ければ期間の始まりから）
  const paymentWindow = {
    start: prev ? addDaysYmd(toYmd(prev.periodEndDate), 1) : q.periodStart,
    end: q.periodEnd,
  }
  const payments = await listClientPayments(companyId, client.id, { window: paymentWindow })

  return {
    ok: true,
    client,
    ctx: {
      candidates,
      previousInvoice: prev
        ? {
            id: prev.id,
            invoiceNumber: prev.invoiceNumber,
            invoiceDate: toYmd(prev.invoiceDate),
            totalAmount: prev.totalAmount.toNumber(),
          }
        : null,
      paymentWindow,
      paymentReceivedAmount: sumPayments(payments),
      taxRoundingMode: client.taxRoundingMode,
    },
  }
}

const CLIENT_SELECT = {
  id: true,
  companyName: true,
  legalEntity: true,
  taxId: true,
  taxRoundingMode: true,
  postalCode: true,
  prefecture: true,
  city: true,
  address: true,
  addressLine2: true,
  billingPostalCode: true,
  billingPrefecture: true,
  billingCity: true,
  billingAddress: true,
  billingAddressLine2: true,
} satisfies Prisma.ClientSelect

type ClientForInvoice = Prisma.ClientGetPayload<{ select: typeof CLIENT_SELECT }>

export async function getInvoiceCandidates(
  input: unknown,
): Promise<ActionResult<InvoiceCandidatesResult>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const parsed = invoiceCandidateQuerySchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const loaded = await loadCandidateContext(sess.companyId, parsed.data)
    if (!loaded.ok) return loaded
    return { ok: true, data: loaded.ctx }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "候補の取得に失敗しました" }
  }
}

// =============================================================================
// 新規（採番 + Invoice + InvoiceItem 群を同一 tx・P2002 リトライ・二重請求のサーバ再確認）
// =============================================================================
const CREATE_MAX_RETRIES = 3

class DoubleBillingError extends Error {}

export async function createInvoice(
  input: unknown,
): Promise<ActionResult<{ id: string; invoiceNumber: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = invoiceCreateSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const loaded = await loadCandidateContext(sess.companyId, {
      clientId: data.clientId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
    })
    if (!loaded.ok) return loaded
    const { ctx, client } = loaded

    // 再発行の元（取消済み・同じクライアント）
    if (data.replacesInvoiceId) {
      const orig = await prisma.invoice.findFirst({
        where: { id: data.replacesInvoiceId, companyId: sess.companyId, deletedAt: null },
        select: { id: true, clientId: true, status: true },
      })
      if (!orig || orig.clientId !== client.id) {
        return { ok: false, error: "再発行の元の請求書が見つかりません" }
      }
      if (orig.status !== InvoiceStatus.CANCELLED) {
        return { ok: false, error: "再発行できるのは取消した請求書だけです" }
      }
    }

    // 選んだ明細は候補（期間内・納品完了以降・未請求）に含まれていなければならない
    const candidateById = new Map(ctx.candidates.map((c) => [c.deliveryNoteItemId, c]))
    const picked = data.items.map((it) => {
      const c = candidateById.get(it.deliveryNoteItemId)
      return c ? { c, taxClassification: it.taxClassification } : null
    })
    if (picked.some((p) => p === null)) {
      return {
        ok: false,
        error:
          "候補に無い明細が含まれています（納品完了前・期間外・既に請求済みのいずれか）。候補を読み直してください",
      }
    }
    const rows = picked.filter((p): p is NonNullable<typeof p> => p !== null)

    // 金額（D-22・D-23・D-29・D-35）
    const previousBalanceAmount = ctx.previousInvoice
      ? ctx.previousInvoice.totalAmount
      : (data.previousBalanceAmount ?? 0)
    const amounts: InvoiceAmounts = computeInvoiceAmounts(
      rows.map((r) => ({ subtotal: r.c.subtotal, taxClassification: r.taxClassification })),
      client.taxRoundingMode,
      previousBalanceAmount,
      ctx.paymentReceivedAmount,
    )
    const hasNonStandard = rows.some((r) => r.taxClassification !== TaxClassification.STANDARD_10)
    const hasReduced = rows.some((r) => r.taxClassification === TaxClassification.REDUCED_8)

    const billToAddress =
      composeAddress({
        postalCode: client.billingPostalCode,
        prefecture: client.billingPrefecture,
        city: client.billingCity,
        address: client.billingAddress,
        addressLine2: client.billingAddressLine2,
      }) || composeAddress(client)

    const dnIds = [...new Set(rows.map((r) => r.c.deliveryNoteId))]
    const itemIds = rows.map((r) => r.c.deliveryNoteItemId)
    const D = (n: number) => new Prisma.Decimal(n)

    const prefix = invoiceNumberPrefix(new Date().getFullYear())
    let created: { id: string; invoiceNumber: string } | null = null
    let lastError: unknown = null

    for (let attempt = 0; attempt < CREATE_MAX_RETRIES; attempt++) {
      try {
        created = await prisma.$transaction(
          async (tx: TxClient) => {
            // ★二重請求の防止（サーバ側を正とする）: 取消されていない請求書に既に載っていれば中断
            if (itemIds.length > 0) {
              const dup = await tx.invoiceItem.findFirst({
                where: {
                  deliveryNoteItemId: { in: itemIds },
                  invoice: {
                    companyId: sess.companyId,
                    deletedAt: null,
                    status: { not: InvoiceStatus.CANCELLED },
                  },
                },
                select: { deliveryNoteItemId: true },
              })
              if (dup) throw new DoubleBillingError("既に請求済みの明細が含まれています。候補を読み直してください")
            }
            const invoiceNumber = await computeNextInvoiceNumber(tx.invoice, sess.companyId, prefix)
            const inv = await tx.invoice.create({
              data: {
                companyId: sess.companyId,
                invoiceNumber,
                invoiceType: InvoiceType.STANDARD,
                clientId: client.id,
                primaryDeliveryNoteId: dnIds[0] ?? null,
                relatedDeliveryNoteIds: dnIds.length > 0 ? dnIds : Prisma.DbNull,
                // 期間は保存する（導出しない）。invoiceDate は請求日＝締め日
                periodStartDate: fromYmd(data.periodStart),
                periodEndDate: fromYmd(data.periodEnd),
                invoiceDate: fromYmd(data.periodEnd),
                paymentDueDate: fromYmd(data.paymentDueDate),
                issuerName: COMPANY_PROFILE.name,
                issuerAddress: ISSUER_ADDRESS,
                issuerPhone: COMPANY_PROFILE.tel,
                issuerEmail: COMPANY_PROFILE.email,
                issuerTaxId: COMPANY_PROFILE.taxId,
                billToName: client.companyName,
                billToLegalEntity: client.legalEntity,
                billToAddress,
                billToTaxId: client.taxId,
                currency: "JPY",
                subtotal: D(amounts.subtotal),
                taxableAmount10: D(amounts.taxableAmount10),
                taxAmount10: D(amounts.taxAmount10),
                taxableAmount8: hasReduced ? D(amounts.taxableAmount8) : null,
                taxAmount8: hasReduced ? D(amounts.taxAmount8) : null,
                totalTaxAmount: D(amounts.totalTaxAmount),
                totalAmount: D(amounts.totalAmount),
                previousBalanceAmount: D(amounts.previousBalanceAmount),
                paymentReceivedAmount: D(amounts.paymentReceivedAmount),
                carriedForwardAmount: D(amounts.carriedForwardAmount),
                replacesInvoiceId: data.replacesInvoiceId,
                transactionType: hasNonStandard
                  ? InvoiceTransactionType.MIXED
                  : InvoiceTransactionType.DOMESTIC_TAXABLE_10,
                status: InvoiceStatus.DRAFT,
                createdByUserId: sess.userId,
                internalNotes: data.internalNotes,
              },
              select: { id: true, invoiceNumber: true },
            })
            if (rows.length > 0) {
              await tx.invoiceItem.createMany({
                data: rows.map((r, i) => ({
                  invoiceId: inv.id,
                  itemOrder: i,
                  productId: null,
                  skuId: null,
                  deliveryNoteItemId: r.c.deliveryNoteItemId,
                  itemCode: r.c.clientProductCode ?? r.c.productCode,
                  itemName: r.c.productName,
                  // 色名は InvoiceItem に列が無いため description に写す（colorCode は colorCode に）
                  description: r.c.colorName,
                  colorCode: r.c.colorCode,
                  size: r.c.size,
                  quantity: D(r.c.quantity),
                  unit: "枚",
                  unitPrice: D(r.c.unitPrice ?? 0),
                  subtotal: D(r.c.subtotal),
                  taxRate: D(TAX_RATE_PERCENT[r.taxClassification]),
                  taxClassification: r.taxClassification,
                  currency: "JPY",
                })),
              })
            }
            await tx.auditLog.create({
              data: {
                companyId: sess.companyId,
                userId: sess.userId,
                action: "CREATE",
                entityType: "Invoice",
                entityId: inv.id,
                afterData: {
                  invoiceNumber: inv.invoiceNumber,
                  clientId: client.id,
                  periodStart: data.periodStart,
                  periodEnd: data.periodEnd,
                  itemCount: rows.length,
                  totalAmount: amounts.totalAmount,
                  replacesInvoiceId: data.replacesInvoiceId,
                },
                description: `請求書新規作成: ${inv.invoiceNumber}`,
              },
            })
            return inv
          },
          { timeout: 15000 },
        )
        break
      } catch (e) {
        lastError = e
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          continue // invoiceNumber unique 衝突：再試行
        }
        if (e instanceof DoubleBillingError) {
          return { ok: false, error: e.message }
        }
        throw e
      }
    }

    if (!created) {
      return {
        ok: false,
        error:
          lastError instanceof Error
            ? `採番衝突が解消されませんでした：${lastError.message}`
            : "採番衝突が解消されませんでした",
      }
    }

    revalidatePath("/invoices")
    return { ok: true, data: created }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "請求書の作成に失敗しました" }
  }
}

// =============================================================================
// 一覧（addendum v0.9 §2-1）
// =============================================================================
export type InvoiceListItem = {
  id: string
  invoiceNumber: string
  clientName: string | null
  periodStart: string
  periodEnd: string
  carriedForwardAmount: number
  totalAmount: number
  paymentDueDate: string
  status: InvoiceStatus
}

export async function listInvoices(
  params: InvoiceListParams = {} as InvoiceListParams,
): Promise<
  ActionResult<{
    items: InvoiceListItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const parsed = invoiceListParamsSchema.parse(params)
    const skip = (parsed.page - 1) * parsed.pageSize
    const q = parsed.q.trim()

    const where: Prisma.InvoiceWhereInput = { companyId: sess.companyId, deletedAt: null }
    if (parsed.status) where.status = parsed.status
    if (parsed.clientId) where.clientId = parsed.clientId
    if (q.length > 0) where.invoiceNumber = { contains: q, mode: "insensitive" }

    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: {
          id: true,
          invoiceNumber: true,
          clientId: true,
          periodStartDate: true,
          periodEndDate: true,
          paymentDueDate: true,
          carriedForwardAmount: true,
          totalAmount: true,
          status: true,
        },
        orderBy: [{ invoiceNumber: "desc" }],
        skip,
        take: parsed.pageSize,
      }),
      prisma.invoice.count({ where }),
    ])

    const clientIds = [...new Set(rows.map((r) => r.clientId))]
    const clients = clientIds.length
      ? await prisma.client.findMany({
          where: { id: { in: clientIds }, companyId: sess.companyId },
          select: { id: true, companyName: true },
        })
      : []
    const clientById = new Map(clients.map((c) => [c.id, c]))

    const items: InvoiceListItem[] = rows.map((r) => {
      const c = clientById.get(r.clientId)
      return {
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        clientName: c?.companyName ?? null,
        periodStart: toYmd(r.periodStartDate),
        periodEnd: toYmd(r.periodEndDate),
        carriedForwardAmount: r.carriedForwardAmount?.toNumber() ?? 0,
        totalAmount: r.totalAmount.toNumber(),
        paymentDueDate: toYmd(r.paymentDueDate),
        status: r.status,
      }
    })

    return {
      ok: true,
      data: {
        items,
        total,
        page: parsed.page,
        pageSize: parsed.pageSize,
        totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "一覧取得に失敗しました" }
  }
}

// =============================================================================
// 単票取得（addendum v0.9 §2-3）
// =============================================================================
export type InvoiceDetailItem = {
  id: string
  deliveryNumber: string | null
  deliveryDate: string | null
  itemCode: string | null
  itemName: string
  colorName: string | null
  size: string | null
  taxClassification: TaxClassification
  quantity: number
  unitPrice: number
  subtotal: number
}

export type InvoiceDetail = {
  id: string
  invoiceNumber: string
  status: InvoiceStatus
  clientId: string
  clientName: string | null
  periodStart: string
  periodEnd: string
  paymentDueDate: string
  previousBalanceAmount: number
  paymentReceivedAmount: number
  carriedForwardAmount: number
  taxableAmount10: number
  taxAmount10: number
  taxableAmount8: number | null
  taxAmount8: number | null
  nonTaxableAmount: number
  subtotal: number
  totalTaxAmount: number
  totalAmount: number
  replacesInvoiceId: string | null
  replacesInvoiceNumber: string | null
  replacedByInvoiceNumber: string | null
  replacedByInvoiceId: string | null
  sentAt: string | null
  items: InvoiceDetailItem[]
  /** 御入金（この期間）: 期間の始まり〜締め日の入金・入金日順 */
  payments: ClientPaymentRow[]
}

export async function getInvoice(id: string): Promise<ActionResult<InvoiceDetail>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const row = await prisma.invoice.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      include: { items: { orderBy: { itemOrder: "asc" } } },
    })
    if (!row) return { ok: false, error: "請求書が見つかりません" }

    const [client, replaces, replacedBy] = await Promise.all([
      prisma.client.findFirst({
        where: { id: row.clientId, companyId: sess.companyId },
        select: { companyName: true },
      }),
      row.replacesInvoiceId
        ? prisma.invoice.findFirst({
            where: { id: row.replacesInvoiceId, companyId: sess.companyId },
            select: { invoiceNumber: true },
          })
        : Promise.resolve(null),
      prisma.invoice.findFirst({
        where: { replacesInvoiceId: row.id, companyId: sess.companyId, deletedAt: null },
        select: { id: true, invoiceNumber: true },
      }),
    ])

    const periodStart = toYmd(row.periodStartDate)
    const periodEnd = toYmd(row.periodEndDate)

    // 納品日・納品書番号は InvoiceItem に列が無いため納品書明細から引く（manual join）
    const dnItemIds = row.items
      .map((it) => it.deliveryNoteItemId)
      .filter((v): v is string => !!v)
    const dnItems = dnItemIds.length
      ? await prisma.deliveryNoteItem.findMany({
          where: { id: { in: dnItemIds }, deliveryNote: { companyId: sess.companyId } },
          select: {
            id: true,
            deliveryNote: { select: { deliveryNumber: true, deliveryDate: true } },
          },
        })
      : []
    const dnById = new Map(dnItems.map((d) => [d.id, d.deliveryNote]))

    const items: InvoiceDetailItem[] = row.items.map((it) => {
      const dn = it.deliveryNoteItemId ? dnById.get(it.deliveryNoteItemId) : undefined
      return {
        id: it.id,
        deliveryNumber: dn?.deliveryNumber ?? null,
        deliveryDate: dn ? toYmd(dn.deliveryDate) : null,
        itemCode: it.itemCode,
        itemName: it.itemName,
        colorName: it.description,
        size: it.size,
        taxClassification: it.taxClassification,
        quantity: it.quantity.toNumber(),
        unitPrice: it.unitPrice.toNumber(),
        subtotal: it.subtotal.toNumber(),
      }
    })
    const nonTaxableAmount = items
      .filter(
        (it) =>
          it.taxClassification !== TaxClassification.STANDARD_10 &&
          it.taxClassification !== TaxClassification.REDUCED_8,
      )
      .reduce((a, it) => a + it.subtotal, 0)

    const payments = await listClientPayments(sess.companyId, row.clientId, {
      window: { start: periodStart, end: periodEnd },
      order: "asc",
    })

    return {
      ok: true,
      data: {
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        status: row.status,
        clientId: row.clientId,
        clientName: client?.companyName ?? null,
        periodStart,
        periodEnd,
        paymentDueDate: toYmd(row.paymentDueDate),
        previousBalanceAmount: row.previousBalanceAmount?.toNumber() ?? 0,
        paymentReceivedAmount: row.paymentReceivedAmount?.toNumber() ?? 0,
        carriedForwardAmount: row.carriedForwardAmount?.toNumber() ?? 0,
        taxableAmount10: row.taxableAmount10?.toNumber() ?? 0,
        taxAmount10: row.taxAmount10?.toNumber() ?? 0,
        taxableAmount8: row.taxableAmount8?.toNumber() ?? null,
        taxAmount8: row.taxAmount8?.toNumber() ?? null,
        nonTaxableAmount,
        subtotal: row.subtotal.toNumber(),
        totalTaxAmount: row.totalTaxAmount?.toNumber() ?? 0,
        totalAmount: row.totalAmount.toNumber(),
        replacesInvoiceId: row.replacesInvoiceId,
        replacesInvoiceNumber: replaces?.invoiceNumber ?? null,
        replacedByInvoiceId: replacedBy?.id ?? null,
        replacedByInvoiceNumber: replacedBy?.invoiceNumber ?? null,
        sentAt: row.sentAt ? row.sentAt.toISOString() : null,
        items,
        payments,
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "取得に失敗しました" }
  }
}

// =============================================================================
// 状態変更（DRAFT → SENT / CANCELLED、SENT → CANCELLED・AuditLog）
// ★金額は再計算しない（D-35）。取消した請求書の明細は候補に戻る（候補側が CANCELLED を除外する）。
// =============================================================================
export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.invoice.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, status: true, invoiceNumber: true },
    })
    if (!existing) return { ok: false, error: "請求書が見つかりません" }
    if (existing.status === status) return { ok: true, data: { id } }

    const allowed = INVOICE_STATUS_TRANSITIONS[existing.status] ?? []
    if (!allowed.includes(status)) {
      return { ok: false, error: "この状態には変更できません" }
    }

    await prisma.$transaction(
      async (tx: TxClient) => {
        await tx.invoice.update({
          where: { id },
          data: {
            status,
            ...(status === InvoiceStatus.SENT
              ? { sentAt: new Date(), sentByUserId: sess.userId }
              : {}),
          },
        })
        await tx.auditLog.create({
          data: {
            companyId: sess.companyId,
            userId: sess.userId,
            action: "STATUS_CHANGE",
            entityType: "Invoice",
            entityId: id,
            beforeData: { status: existing.status },
            afterData: { status },
            description: `請求書 ${existing.invoiceNumber}: ${existing.status} → ${status}`,
          },
        })
      },
      { timeout: 15000 },
    )

    revalidatePath("/invoices")
    revalidatePath(`/invoices/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "状態の変更に失敗しました" }
  }
}
