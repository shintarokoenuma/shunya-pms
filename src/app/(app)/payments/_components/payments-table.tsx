import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ClientPaymentRow } from "@/lib/billing/client-payments"
import { PAYMENT_METHOD_LABELS, fmtYen, fmtYmd } from "../../invoices/_components/labels"

/**
 * B-222 PR-2d ブリーフ §4-4: 列は 入金番号 / 入金日 / クライアント / 方法 / 摘要 / 金額。
 * - クライアント名は counterpartName のスナップショットをそのまま出す（clients を join しない）。
 * - 合計は絞り込み結果の全件合計（D-43）。ページの合計ではない。
 */
export function PaymentsTable({ items, total }: { items: ClientPaymentRow[]; total: number }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        この期間の入金の記録はありません。
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">入金番号</TableHead>
              <TableHead className="w-[110px]">入金日</TableHead>
              <TableHead>クライアント</TableHead>
              <TableHead className="w-[130px]">方法</TableHead>
              <TableHead>摘要</TableHead>
              <TableHead className="w-[140px] text-right">金額</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-sm">{p.paymentNumber}</TableCell>
                <TableCell className="text-sm tabular-nums">{fmtYmd(p.paymentDate)}</TableCell>
                <TableCell className="text-sm">
                  <Link href={`/clients/${p.counterpartId}`} className="hover:underline">
                    {p.counterpartName}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{PAYMENT_METHOD_LABELS[p.paymentMethod]}</TableCell>
                <TableCell className="text-sm">{p.description ?? "—"}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{fmtYen(p.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end gap-6 pr-3 text-sm">
        <span className="text-muted-foreground">合計</span>
        <span className="font-semibold tabular-nums">{fmtYen(total)}</span>
      </div>
    </div>
  )
}
