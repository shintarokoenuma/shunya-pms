"use server"

import { revalidatePath } from "next/cache"
import {
  CounterpartType,
  DeliveryNoteStatus,
  InvoiceStatus,
  PeriodCloseStatus,
  PurchaseOrderStatus,
  WorkOrderStatus,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { DELIVERY_NOTE_DELIVERED_STATUSES } from "@/lib/validators/delivery-note"
import {
  closePeriodSchema,
  periodCloseListSchema,
  reopenPeriodSchema,
  type PeriodCloseState,
} from "@/lib/validators/period-close"
import {
  closingPeriodForMonth,
  fromYmd,
  parseYearMonth,
  toYmd,
} from "@/lib/calc/invoice-period"
import { canReopenPeriod, type PeriodCloseCounterpartType } from "@/lib/period-close/lock"

/**
 * B-109 PR-6（B-123）: 締め（PeriodClose）Server Actions。
 * ブリーフ: docs/specs/b-109-pr6-implementation-brief-2026-09-26.md §4
 * - 締めは社内の誰でも。EXTERNAL は締め・解除・一覧すべて拒否。解除は OWNER / ADMIN だけ（P6-D9）。
 * - 1回の締め＝1行。解除は同じ行を REOPENED に。締め直しは新しい行（P6-D1）。
 * - 期間は取引先の closingDay から出して保存する（P6-D3・P6-D4）。重なる CLOSED 行があれば締めない（P6-D5）。
 * - 締める時に残っている伝票を数えて closeWarnings と AuditLog に残す（P6-D10）。残っていても締められる。
 * - AuditLog は payments.ts と同じく tx.auditLog.create に companyId / userId を手書き（P6-D11）。
 * ★PeriodClose は TENANT_MODELS に無い。companyId / deletedAt を必ず手書きする（AGENTS.md）。
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

const REOPEN_DENIED = "締めを解除できるのは管理者（OWNER / ADMIN）だけです"
const EXTERNAL_DENIED = "外部ユーザーは締めを扱えません"

/** payments.ts の requireSession に role を足した形（P6-D9） */
async function requireSession() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, error: "認証されていません" }
  }
  return {
    ok: true as const,
    companyId: session.user.companyId,
    userId: session.user.id,
    role: session.user.role,
  }
}

/** 拡張クライアントの $transaction が渡す tx の型 */
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// =============================================================================
// 取引先の解決（種類ごとに別テーブル・companyId で絞る）
// =============================================================================
type Counterpart = {
  id: string
  name: string
  closingDay: number | null
  isActive: boolean
}

async function listCounterparts(
  companyId: string,
  counterpartType: PeriodCloseCounterpartType,
  extraIds: string[],
): Promise<Counterpart[]> {
  // その種類の ACTIVE の取引先（deletedAt null）＋その月に行がある取引先（ACTIVE でなくても出す）
  const extra = [...new Set(extraIds)]
  switch (counterpartType) {
    case CounterpartType.CLIENT: {
      const rows = await prisma.client.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [{ status: "ACTIVE" }, ...(extra.length ? [{ id: { in: extra } }] : [])],
        },
        select: { id: true, companyName: true, closingDay: true, status: true },
        orderBy: { companyName: "asc" },
      })
      return rows.map((r) => ({ id: r.id, name: r.companyName, closingDay: r.closingDay, isActive: r.status === "ACTIVE" }))
    }
    case CounterpartType.SUPPLIER: {
      const rows = await prisma.supplier.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [{ status: "ACTIVE" }, ...(extra.length ? [{ id: { in: extra } }] : [])],
        },
        select: { id: true, companyName: true, closingDay: true, status: true },
        orderBy: { companyName: "asc" },
      })
      return rows.map((r) => ({ id: r.id, name: r.companyName, closingDay: r.closingDay, isActive: r.status === "ACTIVE" }))
    }
    case CounterpartType.FACTORY: {
      const rows = await prisma.factory.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [{ status: "ACTIVE" }, ...(extra.length ? [{ id: { in: extra } }] : [])],
        },
        select: { id: true, factoryName: true, closingDay: true, status: true },
        orderBy: { factoryName: "asc" },
      })
      return rows.map((r) => ({ id: r.id, name: r.factoryName, closingDay: r.closingDay, isActive: r.status === "ACTIVE" }))
    }
    case CounterpartType.CONTRACTOR: {
      const rows = await prisma.contractor.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [{ status: "ACTIVE" }, ...(extra.length ? [{ id: { in: extra } }] : [])],
        },
        select: { id: true, contractorName: true, closingDay: true, status: true },
        orderBy: { contractorName: "asc" },
      })
      return rows.map((r) => ({ id: r.id, name: r.contractorName, closingDay: r.closingDay, isActive: r.status === "ACTIVE" }))
    }
  }
}

async function findCounterpart(
  companyId: string,
  counterpartType: PeriodCloseCounterpartType,
  counterpartId: string,
): Promise<Counterpart | null> {
  const rows = await listCounterparts(companyId, counterpartType, [counterpartId])
  return rows.find((r) => r.id === counterpartId) ?? null
}

// =============================================================================
// 残っている伝票（P6-D10）
// =============================================================================
export type CloseWarning = {
  kind: "DN_OPEN" | "DN_UNBILLED" | "INV_DRAFT" | "PO_DRAFT" | "WO_DRAFT"
  label: string
  count: number
  /** 番号（最大 5 件） */
  numbers: string[]
}

const WARNING_NUMBERS_MAX = 5

function pickNumbers(nums: string[]): string[] {
  return [...new Set(nums)].slice(0, WARNING_NUMBERS_MAX)
}

/**
 * 残っている伝票の種類ごとの件数と番号（最大5件）。
 * - CLIENT: DRAFT / SHIPPED の納品書（deliveryDate が期間内）／納品完了なのに取消されていない請求書に載っていない明細
 *   （getInvoiceCandidates と同じ条件）／DRAFT の請求書（periodEndDate が期間内）
 * - SUPPLIER: DRAFT の PO（orderDate が期間内）／FACTORY・CONTRACTOR: DRAFT の WO（orderDate が期間内）
 */
async function computeCloseWarnings(
  companyId: string,
  counterpartType: PeriodCloseCounterpartType,
  counterpartId: string,
  periodStart: string,
  periodEnd: string,
): Promise<CloseWarning[]> {
  const range = { gte: fromYmd(periodStart), lte: fromYmd(periodEnd) }
  const out: CloseWarning[] = []

  if (counterpartType === CounterpartType.CLIENT) {
    const openNotes = await prisma.deliveryNote.findMany({
      where: {
        companyId,
        clientId: counterpartId,
        deletedAt: null,
        status: { in: [DeliveryNoteStatus.DRAFT, DeliveryNoteStatus.SHIPPED] },
        deliveryDate: range,
      },
      select: { deliveryNumber: true },
      orderBy: { deliveryNumber: "asc" },
    })
    if (openNotes.length > 0) {
      out.push({
        kind: "DN_OPEN",
        label: "納品書（ドラフト・出荷済み）",
        count: openNotes.length,
        numbers: pickNumbers(openNotes.map((n) => n.deliveryNumber)),
      })
    }

    // 納品完了以降の明細のうち、取消されていない請求書に載っていないもの（invoices.ts の候補と同じ条件・P6-D15）
    const delivered = await prisma.deliveryNote.findMany({
      where: {
        companyId,
        clientId: counterpartId,
        deletedAt: null,
        status: { in: DELIVERY_NOTE_DELIVERED_STATUSES },
        deliveryDate: range,
      },
      select: { deliveryNumber: true, items: { select: { id: true } } },
      orderBy: { deliveryNumber: "asc" },
    })
    const allItemIds = delivered.flatMap((n) => n.items.map((it) => it.id))
    if (allItemIds.length > 0) {
      const billed = await prisma.invoiceItem.findMany({
        where: {
          deliveryNoteItemId: { in: allItemIds },
          invoice: { companyId, deletedAt: null, status: { not: InvoiceStatus.CANCELLED } },
        },
        select: { deliveryNoteItemId: true },
      })
      const billedIds = new Set(billed.map((b) => b.deliveryNoteItemId))
      let count = 0
      const numbers: string[] = []
      for (const n of delivered) {
        const unbilled = n.items.filter((it) => !billedIds.has(it.id)).length
        if (unbilled > 0) {
          count += unbilled
          numbers.push(n.deliveryNumber)
        }
      }
      if (count > 0) {
        out.push({ kind: "DN_UNBILLED", label: "納品完了・請求書にまだ載っていない明細", count, numbers: pickNumbers(numbers) })
      }
    }

    const draftInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        clientId: counterpartId,
        deletedAt: null,
        status: InvoiceStatus.DRAFT,
        periodEndDate: range,
      },
      select: { invoiceNumber: true },
      orderBy: { invoiceNumber: "asc" },
    })
    if (draftInvoices.length > 0) {
      out.push({
        kind: "INV_DRAFT",
        label: "請求書（ドラフト）",
        count: draftInvoices.length,
        numbers: pickNumbers(draftInvoices.map((i) => i.invoiceNumber)),
      })
    }
    return out
  }

  if (counterpartType === CounterpartType.SUPPLIER) {
    const pos = await prisma.purchaseOrder.findMany({
      where: {
        companyId,
        supplierId: counterpartId,
        deletedAt: null,
        status: PurchaseOrderStatus.DRAFT,
        orderDate: range,
      },
      select: { poNumber: true },
      orderBy: { poNumber: "asc" },
    })
    if (pos.length > 0) {
      out.push({ kind: "PO_DRAFT", label: "PO（ドラフト）", count: pos.length, numbers: pickNumbers(pos.map((p) => p.poNumber)) })
    }
    return out
  }

  // FACTORY / CONTRACTOR
  const wos = await prisma.workOrder.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: WorkOrderStatus.DRAFT,
      orderDate: range,
      ...(counterpartType === CounterpartType.FACTORY
        ? { factoryId: counterpartId }
        : { contractorId: counterpartId }),
    },
    select: { woNumber: true },
    orderBy: { woNumber: "asc" },
  })
  if (wos.length > 0) {
    out.push({ kind: "WO_DRAFT", label: "WO（ドラフト）", count: wos.length, numbers: pickNumbers(wos.map((w) => w.woNumber)) })
  }
  return out
}

export async function getCloseWarnings(
  counterpartType: PeriodCloseCounterpartType,
  counterpartId: string,
  periodStart: string,
  periodEnd: string,
): Promise<ActionResult<CloseWarning[]>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }
    const w = await computeCloseWarnings(sess.companyId, counterpartType, counterpartId, periodStart, periodEnd)
    return { ok: true, data: w }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "取得に失敗しました" }
  }
}

// =============================================================================
// 一覧（§4・§5-2）
// =============================================================================
export type PeriodCloseListRow = {
  counterpartId: string
  counterpartName: string
  isActive: boolean
  closingDay: number | null
  /** その月の期間（P6-D4） */
  periodStart: string
  periodEnd: string
  state: PeriodCloseState
  /** 締め中 / 解除中の行の id（未締めは null） */
  closeId: string | null
  /** 締め中の行の期間（締め日の変更で今の期間とずれることがある・P6-D5） */
  closedPeriodStart: string | null
  closedPeriodEnd: string | null
  warnings: CloseWarning[]
  warningCount: number
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

export async function listPeriodCloses(input: unknown): Promise<ActionResult<PeriodCloseListRow[]>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }

    const parsed = periodCloseListSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const { month, counterpartType, state } = parsed.data
    const ym = parseYearMonth(month)
    if (!ym) return { ok: false, error: "月は YYYY-MM で指定してください" }

    // その種類の行（履歴を含む）。件数は少ないので取引先を絞らず読む
    const closes = await prisma.periodClose.findMany({
      where: { companyId: sess.companyId, deletedAt: null, counterpartType },
      select: {
        id: true,
        counterpartId: true,
        status: true,
        periodStartDate: true,
        periodEndDate: true,
        closedAt: true,
      },
      orderBy: { closedAt: "desc" },
    })
    const closeRows = closes.map((c) => ({
      id: c.id,
      counterpartId: c.counterpartId,
      status: c.status,
      start: toYmd(c.periodStartDate),
      end: toYmd(c.periodEndDate),
    }))

    // その月（暦の月）に期間の終わりがある行の取引先は、ACTIVE でなくても出す
    const monthStart = `${month}-01`
    const monthEnd = closingPeriodForMonth(ym.year, ym.month0, 31).end
    const extraIds = closeRows.filter((c) => c.end >= monthStart && c.end <= monthEnd).map((c) => c.counterpartId)

    const counterparts = await listCounterparts(sess.companyId, counterpartType, extraIds)

    const rows: PeriodCloseListRow[] = []
    for (const cp of counterparts) {
      const period = closingPeriodForMonth(ym.year, ym.month0, cp.closingDay)
      const mine = closeRows.filter((c) => c.counterpartId === cp.id)
      const closed = mine.find(
        (c) => c.status === PeriodCloseStatus.CLOSED && overlaps(c.start, c.end, period.start, period.end),
      )
      const reopened = closed
        ? undefined
        : mine.find(
            (c) => c.status === PeriodCloseStatus.REOPENED && overlaps(c.start, c.end, period.start, period.end),
          )
      const rowState: PeriodCloseState = closed ? "closed" : reopened ? "reopened" : "open"
      if (state && state !== rowState) continue
      const warnings = await computeCloseWarnings(sess.companyId, counterpartType, cp.id, period.start, period.end)
      rows.push({
        counterpartId: cp.id,
        counterpartName: cp.name,
        isActive: cp.isActive,
        closingDay: cp.closingDay,
        periodStart: period.start,
        periodEnd: period.end,
        state: rowState,
        closeId: closed?.id ?? reopened?.id ?? null,
        closedPeriodStart: closed?.start ?? null,
        closedPeriodEnd: closed?.end ?? null,
        warnings,
        warningCount: warnings.reduce((a, w) => a + w.count, 0),
      })
    }
    return { ok: true, data: rows }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "一覧取得に失敗しました" }
  }
}

// =============================================================================
// 締める（P6-D5・P6-D10・P6-D11）
// =============================================================================
class PeriodOverlapError extends Error {}

const AFFECTED_PATHS = ["/closings", "/deliveries", "/invoices", "/payments", "/purchase-orders", "/work-orders"]

export async function closePeriod(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }

    const parsed = closePeriodSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const { counterpartType, counterpartId, month } = parsed.data
    const ym = parseYearMonth(month)
    if (!ym) return { ok: false, error: "月は YYYY-MM で指定してください" }

    const cp = await findCounterpart(sess.companyId, counterpartType, counterpartId)
    if (!cp) return { ok: false, error: "取引先が見つかりません" }
    const period = closingPeriodForMonth(ym.year, ym.month0, cp.closingDay)

    // 残っている伝票（残っていても締められる・P6-D10）
    const warnings = await computeCloseWarnings(sess.companyId, counterpartType, cp.id, period.start, period.end)

    let createdId: string
    try {
      createdId = await prisma.$transaction(
        async (tx: TxClient) => {
          // P6-D5: 1日でも重なる CLOSED 行があれば締めない（同じ tx で確認）
          const dup = await tx.periodClose.findFirst({
            where: {
              companyId: sess.companyId,
              deletedAt: null,
              counterpartType,
              counterpartId: cp.id,
              status: PeriodCloseStatus.CLOSED,
              periodStartDate: { lte: fromYmd(period.end) },
              periodEndDate: { gte: fromYmd(period.start) },
            },
            select: { periodStartDate: true, periodEndDate: true },
          })
          if (dup) {
            throw new PeriodOverlapError(
              `${cp.name} は ${toYmd(dup.periodStartDate).replace(/-/g, "/")}〜${toYmd(dup.periodEndDate).replace(/-/g, "/")} を締め中です。重なる期間は締められません`,
            )
          }
          const row = await tx.periodClose.create({
            data: {
              companyId: sess.companyId,
              counterpartType,
              counterpartId: cp.id,
              periodStartDate: fromYmd(period.start),
              periodEndDate: fromYmd(period.end),
              status: PeriodCloseStatus.CLOSED,
              closedByUserId: sess.userId,
              closeWarnings: warnings.length > 0 ? warnings : undefined,
            },
            select: { id: true },
          })
          await tx.auditLog.create({
            data: {
              companyId: sess.companyId,
              userId: sess.userId,
              action: "CREATE",
              entityType: "PeriodClose",
              entityId: row.id,
              afterData: {
                counterpartType,
                counterpartId: cp.id,
                counterpartName: cp.name,
                month,
                periodStart: period.start,
                periodEnd: period.end,
                warnings,
              },
              description: `締め: ${cp.name} ${month}（${period.start}〜${period.end}）`,
            },
          })
          return row.id
        },
        { timeout: 15000 },
      )
    } catch (e) {
      if (e instanceof PeriodOverlapError) return { ok: false, error: e.message }
      throw e
    }

    for (const p of AFFECTED_PATHS) revalidatePath(p)
    return { ok: true, data: { id: createdId } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "締めに失敗しました" }
  }
}

// =============================================================================
// 解除（P6-D9・P6-D11）
// =============================================================================
export async function reopenPeriod(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }
    // ★UI で隠すだけでなくサーバで判定する
    if (!canReopenPeriod(sess.role)) return { ok: false, error: REOPEN_DENIED }

    const parsed = reopenPeriodSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const { id, reason } = parsed.data

    const existing = await prisma.periodClose.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: {
        id: true,
        status: true,
        counterpartType: true,
        counterpartId: true,
        periodStartDate: true,
        periodEndDate: true,
      },
    })
    if (!existing) return { ok: false, error: "締めの記録が見つかりません" }
    if (existing.status !== PeriodCloseStatus.CLOSED) {
      return { ok: false, error: "この記録は既に解除されています" }
    }
    const periodStart = toYmd(existing.periodStartDate)
    const periodEnd = toYmd(existing.periodEndDate)

    await prisma.$transaction(
      async (tx: TxClient) => {
        await tx.periodClose.update({
          where: { id },
          data: {
            status: PeriodCloseStatus.REOPENED,
            reopenedAt: new Date(),
            reopenedByUserId: sess.userId,
            reopenReason: reason,
          },
        })
        await tx.auditLog.create({
          data: {
            companyId: sess.companyId,
            userId: sess.userId,
            action: "UPDATE",
            entityType: "PeriodClose",
            entityId: id,
            beforeData: { status: PeriodCloseStatus.CLOSED },
            afterData: {
              status: PeriodCloseStatus.REOPENED,
              reason,
              counterpartType: existing.counterpartType,
              counterpartId: existing.counterpartId,
              periodStart,
              periodEnd,
            },
            description: `締めの解除: ${periodStart}〜${periodEnd}（${reason}）`,
          },
        })
      },
      { timeout: 15000 },
    )

    for (const p of AFFECTED_PATHS) revalidatePath(p)
    return { ok: true, data: { id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "締めの解除に失敗しました" }
  }
}
