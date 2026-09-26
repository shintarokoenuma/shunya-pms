import type { PeriodCloseState } from "@/lib/validators/period-close"

/** B-109 PR-6（§5-2）: 締めの一覧の語（参考画面の案B の文言） */
export const PERIOD_CLOSE_STATE_LABELS: Record<PeriodCloseState, string> = {
  open: "未締め",
  closed: "締め中",
  reopened: "解除中",
}

export const PERIOD_CLOSE_STATE_BADGE_VARIANT: Record<
  PeriodCloseState,
  "default" | "secondary" | "destructive" | "outline"
> = {
  open: "outline",
  closed: "default",
  reopened: "secondary",
}

/** yyyy-MM-dd → MM/DD */
export function fmtMd(s: string): string {
  return s.slice(5).replace("-", "/")
}

/** 「YYYY-MM（MM/DD〜MM/DD）」 */
export function fmtMonthPeriod(month: string, start: string, end: string): string {
  return `${month}（${fmtMd(start)}〜${fmtMd(end)}）`
}

/** 締め日の表示（空なら「未設定→月末」） */
export function fmtClosingDay(d: number | null): string {
  if (d == null) return "未設定→月末"
  if (d >= 31) return "月末"
  return `${d}日`
}
