import { CounterpartType, PeriodCloseStatus, type UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { formatPeriod, fromYmd, toYmd } from "@/lib/calc/invoice-period"

/**
 * B-109 PR-6（B-123・P6-D6）: 締めの判定はこの 1 か所に集める。
 * - 引数は client（prisma か tx）・companyId・取引先の種類・取引先 id・日付（yyyy-MM-dd）。
 * - 締め中（CLOSED・deletedAt null）の行の期間に日付が入っていればロック。
 * - 日付の比較は invoice-period.ts の fromYmd / toYmd を使う（new Date() の生の比較をしない）。
 * - transaction の中で書き込む action は、同じ tx を渡して判定する。
 * - 画面の帯・ボタンの無効化も同じ関数を server component から呼ぶ（サーバ側の判定が正・画面は案内）。
 * ★PeriodClose は TENANT_MODELS に無い。companyId / deletedAt を必ず手書きする（AGENTS.md）。
 */

/** 拡張クライアント（src/lib/prisma.ts）の $transaction が渡す tx の型。prisma 本体も渡せる */
export type LockDb = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export type ClosedPeriod = {
  id: string
  /** yyyy-MM-dd */
  periodStart: string
  periodEnd: string
}

export type PeriodLockResult =
  | { locked: false }
  | { locked: true; error: string; period: ClosedPeriod; counterpartName: string }

/** 締めの対象になる取引先の種類（P6-D2） */
export const PERIOD_CLOSE_COUNTERPART_TYPES = [
  CounterpartType.CLIENT,
  CounterpartType.SUPPLIER,
  CounterpartType.FACTORY,
  CounterpartType.CONTRACTOR,
] as const

export type PeriodCloseCounterpartType = (typeof PERIOD_CLOSE_COUNTERPART_TYPES)[number]

/** 解除できる role（P6-D9）。画面の出し分けとサーバの判定の両方がこれを使う */
export const PERIOD_REOPEN_ROLES: readonly UserRole[] = ["OWNER", "ADMIN"]

export function canReopenPeriod(role: UserRole | null | undefined): boolean {
  return !!role && PERIOD_REOPEN_ROLES.includes(role)
}

export const COUNTERPART_TYPE_LABELS: Record<PeriodCloseCounterpartType, string> = {
  CLIENT: "クライアント",
  SUPPLIER: "仕入先",
  FACTORY: "工場",
  CONTRACTOR: "外注先",
}

/** 締め中の行のうち、日付を含むもの（無ければ null） */
export async function findClosedPeriod(
  db: LockDb,
  companyId: string,
  counterpartType: CounterpartType,
  counterpartId: string,
  ymd: string,
): Promise<ClosedPeriod | null> {
  const d = fromYmd(ymd)
  const row = await db.periodClose.findFirst({
    where: {
      companyId,
      deletedAt: null,
      counterpartType,
      counterpartId,
      status: PeriodCloseStatus.CLOSED,
      periodStartDate: { lte: d },
      periodEndDate: { gte: d },
    },
    orderBy: { closedAt: "desc" },
    select: { id: true, periodStartDate: true, periodEndDate: true },
  })
  if (!row) return null
  return { id: row.id, periodStart: toYmd(row.periodStartDate), periodEnd: toYmd(row.periodEndDate) }
}

/** 取引先の表示名（エラー文と一覧用・companyId で絞る）。見つからなければ空文字 */
export async function counterpartDisplayName(
  db: LockDb,
  companyId: string,
  counterpartType: CounterpartType,
  counterpartId: string,
): Promise<string> {
  switch (counterpartType) {
    case CounterpartType.CLIENT: {
      const r = await db.client.findFirst({ where: { id: counterpartId, companyId }, select: { companyName: true } })
      return r?.companyName ?? ""
    }
    case CounterpartType.SUPPLIER: {
      const r = await db.supplier.findFirst({ where: { id: counterpartId, companyId }, select: { companyName: true } })
      return r?.companyName ?? ""
    }
    case CounterpartType.FACTORY: {
      const r = await db.factory.findFirst({ where: { id: counterpartId, companyId }, select: { factoryName: true } })
      return r?.factoryName ?? ""
    }
    case CounterpartType.CONTRACTOR: {
      const r = await db.contractor.findFirst({
        where: { id: counterpartId, companyId },
        select: { contractorName: true },
      })
      return r?.contractorName ?? ""
    }
    default:
      return ""
  }
}

/** P6-D6 のエラー文 */
export function periodLockMessage(ymd: string, counterpartName: string, p: ClosedPeriod): string {
  return `${ymd.replace(/-/g, "/")} は ${counterpartName || "この取引先"} の締め済みの期間（${formatPeriod(p.periodStart, p.periodEnd)}）です。変更するには管理者が締めを解除してください。`
}

/** 画面の帯の文言（§5-3） */
export function periodLockBannerMessage(p: ClosedPeriod): string {
  const ym = p.periodEnd.slice(0, 7)
  return `${ym}（${p.periodStart.slice(5).replace("-", "/")}〜${p.periodEnd.slice(5).replace("-", "/")}）は締め済みです。変更するには管理者が締めを解除してください。`
}

/**
 * 締めの判定（P6-D6）。締め中なら error を返す。書き込みの前に呼び、locked なら何も書かない。
 * @param ymd 判定する日付（yyyy-MM-dd）。null / "" は判定しない（日付の無い行は締めの対象にならない）
 */
export async function checkPeriodLock(
  db: LockDb,
  companyId: string,
  counterpartType: CounterpartType,
  counterpartId: string | null | undefined,
  ymd: string | null | undefined,
): Promise<PeriodLockResult> {
  if (!counterpartId || !ymd) return { locked: false }
  const period = await findClosedPeriod(db, companyId, counterpartType, counterpartId, ymd)
  if (!period) return { locked: false }
  const counterpartName = await counterpartDisplayName(db, companyId, counterpartType, counterpartId)
  return { locked: true, error: periodLockMessage(ymd, counterpartName, period), period, counterpartName }
}

/**
 * 一覧向け: 取引先 id 群の締め中の行をまとめて読む（1 クエリ）。行ごとの判定は closedPeriodFor。
 */
export async function loadClosedPeriods(
  db: LockDb,
  companyId: string,
  counterpartType: CounterpartType,
  counterpartIds: string[],
): Promise<Map<string, ClosedPeriod[]>> {
  const ids = [...new Set(counterpartIds.filter((v): v is string => !!v))]
  const map = new Map<string, ClosedPeriod[]>()
  if (ids.length === 0) return map
  const rows = await db.periodClose.findMany({
    where: {
      companyId,
      deletedAt: null,
      counterpartType,
      counterpartId: { in: ids },
      status: PeriodCloseStatus.CLOSED,
    },
    select: { id: true, counterpartId: true, periodStartDate: true, periodEndDate: true },
  })
  for (const r of rows) {
    const list = map.get(r.counterpartId) ?? []
    list.push({ id: r.id, periodStart: toYmd(r.periodStartDate), periodEnd: toYmd(r.periodEndDate) })
    map.set(r.counterpartId, list)
  }
  return map
}

/** loadClosedPeriods の結果から、日付を含む締め中の行を返す（文字列比較・yyyy-MM-dd） */
export function closedPeriodFor(
  map: Map<string, ClosedPeriod[]>,
  counterpartId: string,
  ymd: string,
): ClosedPeriod | null {
  const list = map.get(counterpartId)
  if (!list) return null
  return list.find((p) => p.periodStart <= ymd && ymd <= p.periodEnd) ?? null
}
