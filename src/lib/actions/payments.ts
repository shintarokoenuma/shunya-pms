"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  PaymentDirection,
  CounterpartType,
  PaymentStatus,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { clientPaymentCreateSchema } from "@/lib/validators/payment"
import { fromYmd } from "@/lib/calc/invoice-period"
import {
  listClientPayments as listClientPaymentsRows,
  listPaymentsPaged,
  type ClientPaymentRow,
} from "@/lib/billing/client-payments"

/**
 * B-109 PR-2c: クライアント単位の入金（D-25）Server Actions。
 * 設計: ブリーフ §4-5 / addendum v0.9 §2-4 / B-222 PR-2d ブリーフ §4-2（/payments の一覧）
 * - Payment を INCOMING・counterpartType=CLIENT で単体保存する。請求書には充当しない。
 * - 採番 PAY-{年}-{4桁}（delivery-notes の computeNextDeliveryNumber と同型・deletedAt で絞らない）。
 * - 予定日＝入金日・状態＝CONFIRMED（実績の記録なので予定と実績が同じ）。
 * - ★Payment は TENANT_MODELS に無いため companyId / deletedAt を必ず明示する。
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

type PaymentNumberFinder = {
  findFirst: (args: {
    where: { companyId: string; paymentNumber: { startsWith: string } }
    orderBy: { paymentNumber: "desc" }
    select: { paymentNumber: true }
  }) => Promise<{ paymentNumber: string } | null>
}

function paymentNumberPrefix(year: number): string {
  return `PAY-${year}-`
}

async function computeNextPaymentNumber(
  finder: PaymentNumberFinder,
  companyId: string,
  prefix: string,
): Promise<string> {
  // ★deletedAt で絞らない：論理削除レコードも最大値判定に含める（番号の再利用を防ぐ）。
  const last = await finder.findFirst({
    where: { companyId, paymentNumber: { startsWith: prefix } },
    orderBy: { paymentNumber: "desc" },
    select: { paymentNumber: true },
  })
  let nextNum = 1
  if (last) {
    const match = last.paymentNumber.match(/-(\d+)$/)
    if (match) nextNum = parseInt(match[1], 10) + 1
  }
  return `${prefix}${String(nextNum).padStart(4, "0")}`
}

/** クライアント詳細の「入金」の節（新しい順・全件。件数を絞るのは呼び出し側） */
export async function listClientPayments(clientId: string): Promise<ClientPaymentRow[]> {
  const sess = await requireSession()
  if (!sess.ok) return []
  return listClientPaymentsRows(sess.companyId, clientId, { order: "desc" })
}

const LIST_PAGE_SIZE = 20

export type PaymentListParams = {
  clientId?: string
  /** yyyy-MM-dd（片方だけでも効く） */
  start?: string
  end?: string
  page?: number
}

/** B-222 PR-2d: /payments の一覧（クライアント横断・期間・ページング・絞り込み結果の全件合計 D-43） */
export async function listPayments(
  params: PaymentListParams = {},
): Promise<
  ActionResult<{
    items: ClientPaymentRow[]
    total: number
    count: number
    page: number
    pageSize: number
    totalPages: number
  }>
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const page = Math.max(1, Math.floor(params.page ?? 1))
    const r = await listPaymentsPaged(
      sess.companyId,
      {
        clientId: params.clientId || undefined,
        window: { start: params.start || undefined, end: params.end || undefined },
      },
      { page, pageSize: LIST_PAGE_SIZE },
    )
    return {
      ok: true,
      data: {
        items: r.rows,
        total: r.total,
        count: r.count,
        page,
        pageSize: LIST_PAGE_SIZE,
        totalPages: Math.max(1, Math.ceil(r.count / LIST_PAGE_SIZE)),
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "一覧取得に失敗しました" }
  }
}

const CREATE_MAX_RETRIES = 3

export async function createClientPayment(
  input: unknown,
): Promise<ActionResult<{ id: string; paymentNumber: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = clientPaymentCreateSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const client = await prisma.client.findFirst({
      where: { id: data.clientId, companyId: sess.companyId, deletedAt: null },
      select: { id: true, companyName: true },
    })
    if (!client) return { ok: false, error: "クライアントが見つかりません" }

    const date = fromYmd(data.paymentDate)
    const prefix = paymentNumberPrefix(new Date().getFullYear())
    let created: { id: string; paymentNumber: string } | null = null
    let lastError: unknown = null

    for (let attempt = 0; attempt < CREATE_MAX_RETRIES; attempt++) {
      try {
        created = await prisma.$transaction(
          async (tx) => {
            const paymentNumber = await computeNextPaymentNumber(tx.payment, sess.companyId, prefix)
            const p = await tx.payment.create({
              data: {
                companyId: sess.companyId,
                paymentNumber,
                paymentDirection: PaymentDirection.INCOMING,
                counterpartType: CounterpartType.CLIENT,
                counterpartId: client.id,
                counterpartName: client.companyName,
                description: data.description,
                amount: new Prisma.Decimal(data.amount),
                currency: "JPY",
                paymentMethod: data.paymentMethod,
                // 実績の記録なので予定日＝入金日・状態＝着金確認済み（ブリーフ §4-5）
                scheduledDate: date,
                actualPaymentDate: date,
                status: PaymentStatus.CONFIRMED,
                createdByUserId: sess.userId,
              },
              select: { id: true, paymentNumber: true },
            })
            await tx.auditLog.create({
              data: {
                companyId: sess.companyId,
                userId: sess.userId,
                action: "CREATE",
                entityType: "Payment",
                entityId: p.id,
                afterData: {
                  paymentNumber: p.paymentNumber,
                  clientId: client.id,
                  paymentDate: data.paymentDate,
                  amount: data.amount,
                  paymentMethod: data.paymentMethod,
                },
                description: `入金記録: ${client.companyName} ${p.paymentNumber}`,
              },
            })
            return p
          },
          { timeout: 15000 },
        )
        break
      } catch (e) {
        lastError = e
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          continue
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

    revalidatePath(`/clients/${client.id}`)
    revalidatePath("/invoices")
    revalidatePath("/payments")
    return { ok: true, data: created }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "入金の記録に失敗しました" }
  }
}
