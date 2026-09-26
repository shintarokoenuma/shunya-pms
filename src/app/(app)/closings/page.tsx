import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { listPeriodCloses } from "@/lib/actions/period-closes"
import { canReopenPeriod } from "@/lib/period-close/lock"
import { formatYearMonth, parseYearMonth, todayYmdJst } from "@/lib/calc/invoice-period"
import {
  PERIOD_CLOSE_COUNTERPART_VALUES,
  PERIOD_CLOSE_STATE_VALUES,
  type PeriodCloseState,
} from "@/lib/validators/period-close"
import { ClosingsFilters } from "./_components/closings-filters"
import { ClosingsTable } from "./_components/closings-table"

type SearchParams = Promise<{ month?: string; type?: string; state?: string }>

type CounterpartValue = (typeof PERIOD_CLOSE_COUNTERPART_VALUES)[number]

/** 既定は今日（JST）の前月 */
function defaultMonth(): string {
  const t = todayYmdJst()
  const year = Number(t.slice(0, 4))
  const month0 = Number(t.slice(5, 7)) - 1
  return formatYearMonth(year, month0 - 1)
}

/**
 * B-109 PR-6（§5-2）: 締めの一覧 /closings。参考画面の案B の右側と同じ構成・同じ文言。
 * - 月の切り替え・取引先の種類・状態の絞り込み。表の下に注記（D-16）。
 * - 「解除する」は OWNER / ADMIN にだけ出す（サーバ側でも判定する・P6-D9）。
 */
export default async function ClosingsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const month = sp.month && parseYearMonth(sp.month) ? sp.month : defaultMonth()
  const counterpartType: CounterpartValue = (PERIOD_CLOSE_COUNTERPART_VALUES as readonly string[]).includes(
    sp.type ?? "",
  )
    ? (sp.type as CounterpartValue)
    : "CLIENT"
  const state: PeriodCloseState | null = (PERIOD_CLOSE_STATE_VALUES as readonly string[]).includes(sp.state ?? "")
    ? (sp.state as PeriodCloseState)
    : null

  const result = await listPeriodCloses({ month, counterpartType, state: state ?? undefined })
  const canReopen = canReopenPeriod(session.user.role)

  return (
    <div className="space-y-6 p-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">締め</h1>
        <p className="text-sm text-muted-foreground">
          取引先ごとに期間を締めます。締めた期間の日付の伝票は、作成・編集・状態の変更・削除ができなくなります。
        </p>
      </div>
      <ClosingsFilters month={month} counterpartType={counterpartType} state={state} />
      {result.ok ? (
        <ClosingsTable rows={result.data} month={month} counterpartType={counterpartType} canReopen={canReopen} />
      ) : (
        <p className="text-sm text-destructive">{result.error}</p>
      )}
      <p className="text-xs text-muted-foreground">
        締めの単位は「取引先 × その締め日の期間」です（D-16）。締め日が空の取引先は月末締めとして扱います。「解除する」は
        OWNER / ADMIN にだけ出ます。
      </p>
    </div>
  )
}
