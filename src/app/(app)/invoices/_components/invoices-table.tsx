import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { InvoiceListItem } from "@/lib/actions/invoices"
import { formatPeriod } from "@/lib/calc/invoice-period"
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_BADGE_VARIANT,
  fmtYen,
  fmtYmd,
} from "./labels"

/**
 * addendum v0.9 §2-1: 列は 請求書番号 / クライアント / 期間 / 繰越金額 / 今回御請求額 / 支払期日 / 状態。
 * - 繰越金額が 0 でない行だけ色を付ける。
 * - 今回御請求額がマイナスの行は赤系（赤伝だけの請求書・D-26）。
 * - 並べ替え（未収のあるクライアントを上にまとめる等）は作らない（D-37）。
 */
export function InvoicesTable({ items }: { items: InvoiceListItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        請求書がありません
      </div>
    )
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px]">請求書番号</TableHead>
            <TableHead>クライアント</TableHead>
            <TableHead className="w-[210px]">期間</TableHead>
            <TableHead className="w-[130px] text-right">繰越金額</TableHead>
            <TableHead className="w-[140px] text-right">今回御請求額</TableHead>
            <TableHead className="w-[110px]">支払期日</TableHead>
            <TableHead className="w-[100px]">状態</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const hasCarry = item.carriedForwardAmount !== 0
            const negative = item.totalAmount < 0
            return (
              <TableRow key={item.id} className={negative ? "bg-red-50/60" : undefined}>
                <TableCell className="font-mono text-sm">{item.invoiceNumber}</TableCell>
                <TableCell className="text-sm">
                  {item.clientName ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {formatPeriod(item.periodStart, item.periodEnd)}
                </TableCell>
                <TableCell
                  className={
                    hasCarry
                      ? "text-right text-sm tabular-nums font-medium bg-amber-50 text-amber-900"
                      : "text-right text-sm tabular-nums"
                  }
                >
                  {fmtYen(item.carriedForwardAmount)}
                </TableCell>
                <TableCell
                  className={
                    negative
                      ? "text-right text-sm tabular-nums font-medium text-red-700"
                      : "text-right text-sm tabular-nums"
                  }
                >
                  {fmtYen(item.totalAmount)}
                </TableCell>
                <TableCell className="text-sm tabular-nums">{fmtYmd(item.paymentDueDate)}</TableCell>
                <TableCell>
                  <Badge variant={INVOICE_STATUS_BADGE_VARIANT[item.status]}>
                    {INVOICE_STATUS_LABELS[item.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/invoices/${item.id}`}
                    className="flex items-center justify-end text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
