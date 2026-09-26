/**
 * B-109 PR-6（P6-D4）: invoice-period の締めの期間・年月・JST の今日の検証（テストランナー非依存）。
 * 手動実行: `npx tsx src/lib/calc/invoice-period.test.ts`
 */

import {
  closingPeriodForMonth,
  formatYearMonth,
  parseYearMonth,
  todayYmdJst,
} from "./invoice-period"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

// ① 月末締め（31 または未設定）→ その月の1日〜末日
{
  const p = closingPeriodForMonth(2026, 8, 31) // 2026-09
  assert(p.start === "2026-09-01" && p.end === "2026-09-30", "① 31 → 9/1〜9/30")
  const q = closingPeriodForMonth(2026, 8, null)
  assert(q.start === "2026-09-01" && q.end === "2026-09-30", "①' 未設定 → 9/1〜9/30")
  const r = closingPeriodForMonth(2026, 1, 31) // 2026-02（うるう年でない）
  assert(r.start === "2026-02-01" && r.end === "2026-02-28", "①'' 2月は 28 日まで")
}

// ② 20 日締め → 前月21日〜当月20日
{
  const p = closingPeriodForMonth(2026, 8, 20)
  assert(p.start === "2026-08-21" && p.end === "2026-09-20", "② 20 → 8/21〜9/20")
  const j = closingPeriodForMonth(2026, 0, 20) // 2026-01 → 前年 12/21〜1/20
  assert(j.start === "2025-12-21" && j.end === "2026-01-20", "②' 年またぎ")
}

// ③ 30 日締めで 2 月 → 2/28 に丸める。3 月は 2/29?→ 前月の締め日（2/28）の翌日
{
  const p = closingPeriodForMonth(2026, 1, 30)
  assert(p.start === "2026-01-31" && p.end === "2026-02-28", "③ 30 → 1/31〜2/28")
  const q = closingPeriodForMonth(2026, 2, 30)
  assert(q.start === "2026-03-01" && q.end === "2026-03-30", "③' 3月は 3/1〜3/30")
}

// ④ 年月の解析と整形
{
  assert(JSON.stringify(parseYearMonth("2026-09")) === JSON.stringify({ year: 2026, month0: 8 }), "④ parse")
  assert(parseYearMonth("2026-13") === null && parseYearMonth("2026-9") === null && parseYearMonth("") === null, "④' 不正は null")
  assert(formatYearMonth(2026, 8) === "2026-09" && formatYearMonth(2026, -1) === "2025-12" && formatYearMonth(2026, 12) === "2027-01", "④'' format（負や 12 以上も）")
}

// ⑤ JST の今日: UTC 15:00 は JST の翌日 0:00
{
  assert(todayYmdJst(new Date("2026-09-25T15:00:00.000Z")) === "2026-09-26", "⑤ UTC 15:00 → JST 翌日")
  assert(todayYmdJst(new Date("2026-09-25T14:59:59.000Z")) === "2026-09-25", "⑤' UTC 14:59 → JST 同日")
}

console.log("invoice-period.test.ts: all assertions passed")
