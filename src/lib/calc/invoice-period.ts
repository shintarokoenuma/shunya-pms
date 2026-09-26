/**
 * B-109 PR-2c: 請求の期間と支払期日の既定（純関数・prisma 非依存）。
 * - 日付は yyyy-MM-dd の文字列で受け渡す。@db.Date の列は delivery-notes と同じく
 *   new Date("yyyy-MM-dd")（UTC 0時）として保存・比較する。
 * - 期間の既定: 今月の締め日を終わり、前月の締め日の翌日を始まり（addendum v0.9 §2-2:
 *   月末締めなら 9/1〜9/30、20日締めなら 8/21〜9/20）。
 * - 締め日は Client.closingDay（1-31・31 または未設定＝月末）。
 * - ★Invoice に期間の列は無い（ブリーフ §3-1 は4列のみ）。締め日を invoiceDate に保存し、
 *   始まりは「直前の請求書の締め日の翌日」（無ければ本モジュールの既定）で導出する。
 */

export function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function fromYmd(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`)
}

export function addDaysYmd(s: string, days: number): string {
  const d = fromYmd(s)
  d.setUTCDate(d.getUTCDate() + days)
  return toYmd(d)
}

function lastDayOfMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
}

/** その年月の締め日（実日）。31 または未設定は月末。月末を超える日は月末に丸める。month0 は負や 12 以上でもよい。 */
export function closingDateOf(
  year: number,
  month0: number,
  closingDay: number | null | undefined,
): string {
  const norm = new Date(Date.UTC(year, month0, 1))
  const y = norm.getUTCFullYear()
  const m = norm.getUTCMonth()
  const last = lastDayOfMonth(y, m)
  const day =
    closingDay == null || closingDay >= 31
      ? last
      : Math.min(Math.max(closingDay, 1), last)
  return toYmd(new Date(Date.UTC(y, m, day)))
}

/** 期間の既定: 今月の締め日を終わり、前月の締め日の翌日を始まり。 */
export function defaultInvoicePeriod(
  closingDay: number | null | undefined,
  today: Date = new Date(),
): { start: string; end: string } {
  const y = today.getFullYear()
  const m = today.getMonth()
  return {
    start: addDaysYmd(closingDateOf(y, m - 1, closingDay), 1),
    end: closingDateOf(y, m, closingDay),
  }
}

/** 終わり（締め日）から始まりの既定を出す（前の締め日の翌日）。直前の請求書が無いときの導出用。 */
export function periodStartFromEnd(
  end: string,
  closingDay: number | null | undefined,
): string {
  const d = fromYmd(end)
  return addDaysYmd(
    closingDateOf(d.getUTCFullYear(), d.getUTCMonth() - 1, closingDay),
    1,
  )
}

/** 支払期日の既定: 締め日の月 + paymentMonthOffset（未設定=1）の paymentDay（未設定=月末）。 */
export function defaultPaymentDueDate(
  end: string,
  paymentMonthOffset: number | null | undefined,
  paymentDay: number | null | undefined,
): string {
  const d = fromYmd(end)
  return closingDateOf(
    d.getUTCFullYear(),
    d.getUTCMonth() + (paymentMonthOffset ?? 1),
    paymentDay ?? 31,
  )
}

/** 画面表示: 2026/09/01〜2026/09/30 */
export function formatPeriod(start: string, end: string): string {
  return `${start.replace(/-/g, "/")}〜${end.replace(/-/g, "/")}`
}

/**
 * B-109 PR-6（P6-D4）: 「YYYY-MM の締め」の期間＝期間の終わりがその月に入る期間。
 * 月末締め（31 または未設定）→ その月の1日〜末日／20 日締め → 前月21日〜当月20日。
 * defaultInvoicePeriod と同じ計算（today ではなく年月を受ける）。
 */
export function closingPeriodForMonth(
  year: number,
  month0: number,
  closingDay: number | null | undefined,
): { start: string; end: string } {
  return {
    start: addDaysYmd(closingDateOf(year, month0 - 1, closingDay), 1),
    end: closingDateOf(year, month0, closingDay),
  }
}

/** "YYYY-MM" → { year, month0 }（形式が違えば null） */
export function parseYearMonth(s: string): { year: number; month0: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(s)
  if (!m) return null
  const year = Number(m[1])
  const month0 = Number(m[2]) - 1
  if (month0 < 0 || month0 > 11) return null
  return { year, month0 }
}

/** { year, month0 } → "YYYY-MM"（month0 は負や 12 以上でもよい） */
export function formatYearMonth(year: number, month0: number): string {
  const d = new Date(Date.UTC(year, month0, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/**
 * B-109 PR-6（§3）: JST の今日（yyyy-MM-dd）。PO / WO の orderDate は @default(now()) で入るため、
 * 作成時の締めの判定はこの日付で行う。toYmd と同じく文字列で扱い、new Date() の生の比較はしない。
 */
export function todayYmdJst(now: Date = new Date()): string {
  return toYmd(new Date(now.getTime() + 9 * 60 * 60 * 1000))
}
