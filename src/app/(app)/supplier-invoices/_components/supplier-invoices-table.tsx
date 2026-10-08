import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { SupplierInvoiceListRow } from "@/lib/actions/supplier-invoices"
import { POSTING_TYPE_LABELS, fmtAmount } from "./labels"

/**
 * B-212 PR-1（P1-D8）: 列は 番号 / 月度 / 相手先 / 書類種別 / 書類No / 税込（通貨） / 計上・参照 / 明細の当て方の件数。
 * 下の合計は計上の書類だけを通貨ごとに（参照は入れない・D-4）。絞り込み結果の全件の合計
 */
export function SupplierInvoicesTable({ items, totals }: { items: SupplierInvoiceListRow[]; totals: Record<string, string> }) {
  if (items.length === 0) {
    return <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">仕入請求書はありません。右上の「CSV を取り込む」から取り込みます。</div>
  }
  return (
    <div className="space-y-2">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">番号</TableHead>
              <TableHead className="w-[80px]">月度</TableHead>
              <TableHead>相手先</TableHead>
              <TableHead className="w-[110px]">書類種別</TableHead>
              <TableHead className="w-[130px]">書類No</TableHead>
              <TableHead className="w-[150px] text-right">税込</TableHead>
              <TableHead className="w-[70px]">区分</TableHead>
              <TableHead className="w-[220px]">明細の当て方</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm"><Link href={`/supplier-invoices/${r.id}`} className="hover:underline">{r.invoiceNumber}</Link></TableCell>
                <TableCell className="text-sm tabular-nums">{r.periodMonth}</TableCell>
                <TableCell className="text-sm">
                  {r.counterpartName}
                  {r.counterpartId ? null : <span className="ml-1 text-xs text-muted-foreground">（マスター未当て）</span>}
                </TableCell>
                <TableCell className="text-sm">{r.documentType}</TableCell>
                <TableCell className="font-mono text-sm">{r.documentNumber}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {fmtAmount(r.totalAmount, r.currency)}
                  {r.currency !== "JPY" ? <span className="ml-1 text-xs text-muted-foreground">（円は未確定）</span> : null}
                </TableCell>
                <TableCell><Badge variant={r.postingType === "COUNTED" ? "secondary" : "outline"}>{POSTING_TYPE_LABELS[r.postingType]}</Badge></TableCell>
                <TableCell className="text-xs tabular-nums">
                  一致 {r.counts.matched}
                  {r.counts.pending > 0 ? <span className="ml-2 font-medium text-amber-700">要確認 {r.counts.pending}</span> : <span className="ml-2 text-muted-foreground">要確認 0</span>}
                  {r.counts.unmatched > 0 ? <span className="ml-2 font-medium text-destructive">未一致 {r.counts.unmatched}</span> : <span className="ml-2 text-muted-foreground">未一致 0</span>}
                  <span className="ml-2 text-muted-foreground">品番なし {r.counts.noProduct}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap justify-end gap-6 pr-3 text-sm">
        <span className="text-muted-foreground">合計（計上の書類だけ・参照は含まない）</span>
        {Object.keys(totals).length === 0 ? <span className="tabular-nums">—</span> : null}
        {Object.entries(totals).map(([cur, amt]) => (
          <span key={cur} className="font-semibold tabular-nums">
            {fmtAmount(amt, cur)}
            {cur !== "JPY" ? <span className="ml-1 font-normal text-xs text-muted-foreground">（円は未確定）</span> : null}
          </span>
        ))}
      </div>
    </div>
  )
}
