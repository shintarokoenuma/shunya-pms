import {
  Prisma,
  PaymentDirection,
  CounterpartType,
  PaymentStatus,
  type PaymentMethod,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { fromYmd, toYmd } from "@/lib/calc/invoice-period"

/**
 * B-109 PR-2c / B-222 PR-2d: クライアント単位の入金の読み取り（invoices / payments の両 action から使う中立モジュール）。
 * 集計の条件はブリーフ §4-5「御入金額の集計」＝ D-25 の決まりそのもの:
 *   INCOMING・counterpartType=CLIENT・deletedAt null・status が CANCELLED / FAILED 以外・
 *   actualPaymentDate が 前回の締め日の翌日〜今回の締め日。
 * ★この条件は paymentWhere の1か所にだけ書く（B-222 ブリーフ §4-1）。
 *   2か所に書くと、片方だけ直ったときに請求書の「御入金額」と /payments の合計がズレる。
 * ★Payment は TENANT_MODELS に無いため companyId / deletedAt を必ず明示する。
 */
export type ClientPaymentRow = {
  id: string
  paymentNumber: string
  /** yyyy-MM-dd */
  paymentDate: string
  paymentMethod: PaymentMethod
  description: string | null
  amount: number
  /** 入金時のクライアント（スナップショット。改名しても過去の入金の表示は変わらない） */
  counterpartId: string
  counterpartName: string
  /** 記録した日時（ISO 8601）。B-223（D-50）: 請求書の createdAt との前後比較に使う */
  createdAt: string
}

export type PaymentFilter = {
  /** 省略時はクライアント横断（/payments） */
  clientId?: string
  /** 片方だけでも効く（gte / lte を個別に組む） */
  window?: { start?: string; end?: string }
}

export function paymentWhere(companyId: string, f: PaymentFilter): Prisma.PaymentWhereInput {
  const dateRange: Prisma.DateTimeFilter = {}
  if (f.window?.start) dateRange.gte = fromYmd(f.window.start)
  if (f.window?.end) dateRange.lte = fromYmd(f.window.end)
  return {
    companyId,
    deletedAt: null,
    paymentDirection: PaymentDirection.INCOMING,
    counterpartType: CounterpartType.CLIENT,
    status: { notIn: [PaymentStatus.CANCELLED, PaymentStatus.FAILED] },
    ...(f.clientId ? { counterpartId: f.clientId } : {}),
    ...(Object.keys(dateRange).length > 0 ? { actualPaymentDate: dateRange } : {}),
  }
}

const ROW_SELECT = {
  id: true,
  paymentNumber: true,
  actualPaymentDate: true,
  scheduledDate: true,
  paymentMethod: true,
  description: true,
  amount: true,
  counterpartId: true,
  counterpartName: true,
  createdAt: true,
} satisfies Prisma.PaymentSelect

type RowPayload = Prisma.PaymentGetPayload<{ select: typeof ROW_SELECT }>

function toRow(r: RowPayload): ClientPaymentRow {
  return {
    id: r.id,
    paymentNumber: r.paymentNumber,
    paymentDate: toYmd(r.actualPaymentDate ?? r.scheduledDate),
    paymentMethod: r.paymentMethod,
    description: r.description,
    amount: r.amount.toNumber(),
    counterpartId: r.counterpartId,
    counterpartName: r.counterpartName,
    createdAt: r.createdAt.toISOString(),
  }
}

function orderBy(order: "asc" | "desc"): Prisma.PaymentOrderByWithRelationInput[] {
  return [{ actualPaymentDate: order }, { paymentNumber: order }]
}

export async function listClientPayments(
  companyId: string,
  clientId: string,
  opts: { window?: { start: string; end: string }; order?: "asc" | "desc" } = {},
): Promise<ClientPaymentRow[]> {
  const rows = await prisma.payment.findMany({
    where: paymentWhere(companyId, { clientId, window: opts.window }),
    select: ROW_SELECT,
    orderBy: orderBy(opts.order ?? "desc"),
  })
  return rows.map(toRow)
}

/**
 * B-222 PR-2d: /payments の一覧（クライアント横断・ページング）。
 * - total は絞り込み結果の全件合計（D-43）。表示中のページの合計ではない。aggregate で一覧とは別に集計する。
 * - rows / count / total の3本は同じ paymentWhere の結果を使う。
 */
export async function listPaymentsPaged(
  companyId: string,
  f: PaymentFilter,
  page: { page: number; pageSize: number },
): Promise<{ rows: ClientPaymentRow[]; count: number; total: number }> {
  const where = paymentWhere(companyId, f)
  const skip = (page.page - 1) * page.pageSize
  const [rows, count, agg] = await Promise.all([
    prisma.payment.findMany({
      where,
      select: ROW_SELECT,
      orderBy: orderBy("desc"),
      skip,
      take: page.pageSize,
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where, _sum: { amount: true } }),
  ])
  return {
    rows: rows.map(toRow),
    count,
    // ★_sum.amount は 0 件のとき null
    total: agg._sum.amount?.toNumber() ?? 0,
  }
}

export function sumPayments(rows: { amount: number }[]): number {
  return rows.reduce((a, r) => a + r.amount, 0)
}
