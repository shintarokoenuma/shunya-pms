import { PaymentDirection, CounterpartType, PaymentStatus, type PaymentMethod } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { fromYmd, toYmd } from "@/lib/calc/invoice-period"

/**
 * B-109 PR-2c: クライアント単位の入金の読み取り（invoices / payments の両 action から使う中立モジュール）。
 * 集計の条件はブリーフ §4-5「御入金額の集計」:
 *   INCOMING・counterpartType=CLIENT・deletedAt null・status が CANCELLED / FAILED 以外・
 *   actualPaymentDate が 前回の締め日の翌日〜今回の締め日。
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
}

export async function listClientPayments(
  companyId: string,
  clientId: string,
  opts: { window?: { start: string; end: string }; order?: "asc" | "desc" } = {},
): Promise<ClientPaymentRow[]> {
  const order = opts.order ?? "desc"
  const rows = await prisma.payment.findMany({
    where: {
      companyId,
      deletedAt: null,
      paymentDirection: PaymentDirection.INCOMING,
      counterpartType: CounterpartType.CLIENT,
      counterpartId: clientId,
      status: { notIn: [PaymentStatus.CANCELLED, PaymentStatus.FAILED] },
      ...(opts.window
        ? {
            actualPaymentDate: {
              gte: fromYmd(opts.window.start),
              lte: fromYmd(opts.window.end),
            },
          }
        : {}),
    },
    select: {
      id: true,
      paymentNumber: true,
      actualPaymentDate: true,
      scheduledDate: true,
      paymentMethod: true,
      description: true,
      amount: true,
    },
    orderBy: [{ actualPaymentDate: order }, { paymentNumber: order }],
  })
  return rows.map((r) => ({
    id: r.id,
    paymentNumber: r.paymentNumber,
    paymentDate: toYmd(r.actualPaymentDate ?? r.scheduledDate),
    paymentMethod: r.paymentMethod,
    description: r.description,
    amount: r.amount.toNumber(),
  }))
}

export function sumPayments(rows: { amount: number }[]): number {
  return rows.reduce((a, r) => a + r.amount, 0)
}
