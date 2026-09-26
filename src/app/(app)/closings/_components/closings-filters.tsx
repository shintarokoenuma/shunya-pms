"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatYearMonth, parseYearMonth } from "@/lib/calc/invoice-period"
import {
  PERIOD_CLOSE_COUNTERPART_VALUES,
  PERIOD_CLOSE_STATE_VALUES,
  type PeriodCloseState,
} from "@/lib/validators/period-close"
import { PERIOD_CLOSE_STATE_LABELS } from "./labels"

const COUNTERPART_LABELS: Record<(typeof PERIOD_CLOSE_COUNTERPART_VALUES)[number], string> = {
  CLIENT: "クライアント",
  SUPPLIER: "仕入先",
  FACTORY: "工場",
  CONTRACTOR: "外注先",
}

/**
 * B-109 PR-6（§5-2）: 月の切り替え（◀ YYYY-MM ▶）・取引先の種類・状態の絞り込み。
 * URL params を push する形は payments-search と同じ（既定はサーバ側で決める）。
 */
export function ClosingsFilters({
  month,
  counterpartType,
  state,
}: {
  month: string
  counterpartType: (typeof PERIOD_CLOSE_COUNTERPART_VALUES)[number]
  state: PeriodCloseState | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const push = (next: { month?: string; type?: string; state?: string | null }) => {
    const params = new URLSearchParams()
    params.set("month", next.month ?? month)
    params.set("type", next.type ?? counterpartType)
    const st = next.state === undefined ? state : next.state
    if (st) params.set("state", st)
    startTransition(() => router.push(`/closings?${params.toString()}`))
  }

  const shift = (delta: number) => {
    const ym = parseYearMonth(month)
    if (!ym) return
    push({ month: formatYearMonth(ym.year, ym.month0 + delta) })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="sm" onClick={() => shift(-1)} disabled={isPending} aria-label="前の月">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[88px] text-center font-mono text-sm tabular-nums">{month}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => shift(1)} disabled={isPending} aria-label="次の月">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <Select value={counterpartType} onValueChange={(v) => push({ type: v })} disabled={isPending}>
        <SelectTrigger className="w-full sm:w-[180px]" aria-label="取引先の種類">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_CLOSE_COUNTERPART_VALUES.map((t) => (
            <SelectItem key={t} value={t}>
              {COUNTERPART_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={state ?? "all"}
        onValueChange={(v) => push({ state: v === "all" ? null : v })}
        disabled={isPending}
      >
        <SelectTrigger className="w-full sm:w-[150px]" aria-label="状態">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべて</SelectItem>
          {PERIOD_CLOSE_STATE_VALUES.map((s) => (
            <SelectItem key={s} value={s}>
              {PERIOD_CLOSE_STATE_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
