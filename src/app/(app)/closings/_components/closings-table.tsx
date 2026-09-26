import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { PeriodCloseListRow } from "@/lib/actions/period-closes"
import type { PERIOD_CLOSE_COUNTERPART_VALUES } from "@/lib/validators/period-close"
import { ClosePeriodDialog } from "./close-period-dialog"
import { ReopenPeriodDialog } from "./reopen-period-dialog"
import {
  PERIOD_CLOSE_STATE_BADGE_VARIANT,
  PERIOD_CLOSE_STATE_LABELS,
  fmtClosingDay,
  fmtMd,
} from "./labels"

/**
 * B-109 PR-6（§5-2）: 締めの一覧の表（参考画面の案B の右側）。
 * 列: 取引先／締め日／期間／状態／残っている伝票／操作。
 * 操作: 未締め＝「締める」、締め中＝「解除する」（OWNER / ADMIN にだけ出す）、解除中＝「締め直す」。
 */
export function ClosingsTable({
  rows,
  month,
  counterpartType,
  canReopen,
}: {
  rows: PeriodCloseListRow[]
  month: string
  counterpartType: (typeof PERIOD_CLOSE_COUNTERPART_VALUES)[number]
  canReopen: boolean
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        この条件の取引先はありません。
      </div>
    )
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>取引先</TableHead>
            <TableHead className="w-[110px]">締め日</TableHead>
            <TableHead className="w-[150px]">期間</TableHead>
            <TableHead className="w-[100px]">状態</TableHead>
            <TableHead className="w-[200px]">残っている伝票</TableHead>
            <TableHead className="w-[120px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.counterpartId}>
              <TableCell className="text-sm">
                {r.counterpartName}
                {!r.isActive && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    休止・終了
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm">{fmtClosingDay(r.closingDay)}</TableCell>
              <TableCell className="text-sm tabular-nums">
                {fmtMd(r.periodStart)}〜{fmtMd(r.periodEnd)}
                {r.state === "closed" &&
                  r.closedPeriodStart &&
                  r.closedPeriodEnd &&
                  (r.closedPeriodStart !== r.periodStart || r.closedPeriodEnd !== r.periodEnd) && (
                    <div className="text-[10px] text-muted-foreground">
                      締め中の期間: {fmtMd(r.closedPeriodStart)}〜{fmtMd(r.closedPeriodEnd)}
                    </div>
                  )}
              </TableCell>
              <TableCell>
                <Badge variant={PERIOD_CLOSE_STATE_BADGE_VARIANT[r.state]}>{PERIOD_CLOSE_STATE_LABELS[r.state]}</Badge>
              </TableCell>
              <TableCell className="text-sm">
                {r.warnings.length === 0 ? (
                  <span className="text-muted-foreground">なし</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {r.warnings.map((w) => (
                      <Badge key={w.kind} variant="secondary" title={w.numbers.join("、")}>
                        {w.label} {w.count}
                      </Badge>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right">
                {r.state === "open" && (
                  <ClosePeriodDialog
                    label="締める"
                    counterpartType={counterpartType}
                    counterpartId={r.counterpartId}
                    counterpartName={r.counterpartName}
                    month={month}
                    periodStart={r.periodStart}
                    periodEnd={r.periodEnd}
                    warnings={r.warnings}
                  />
                )}
                {r.state === "closed" &&
                  (canReopen && r.closeId ? (
                    <ReopenPeriodDialog
                      closeId={r.closeId}
                      counterpartName={r.counterpartName}
                      month={month}
                      periodStart={r.closedPeriodStart ?? r.periodStart}
                      periodEnd={r.closedPeriodEnd ?? r.periodEnd}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  ))}
                {r.state === "reopened" && (
                  <ClosePeriodDialog
                    label="締め直す"
                    counterpartType={counterpartType}
                    counterpartId={r.counterpartId}
                    counterpartName={r.counterpartName}
                    month={month}
                    periodStart={r.periodStart}
                    periodEnd={r.periodEnd}
                    warnings={r.warnings}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
