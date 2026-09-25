import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { ClientPaymentRow } from "@/lib/billing/client-payments"
import { PAYMENT_METHOD_LABELS, fmtYen, fmtYmd } from "../../invoices/_components/labels"
import { PaymentCancelDialog } from "./payment-cancel-dialog"

/**
 * B-222 PR-2d ブリーフ §4-4: 列は 入金番号 / 入金日 / クライアント / 方法 / 摘要 / 金額。
 * - クライアント名は counterpartName のスナップショットをそのまま出す（clients を join しない）。
 * - 合計は絞り込み結果の全件合計（D-43）。ページの合計ではない。
 * - B-225（D-4・D-5）: 右端に「取消」（CONFIRMED の行だけ）。取消済みの行は「取消済み」バッジ・取消ボタン無し。
 *   状態の絞り込みが「取消済み」のときは合計の見出しを「取消済みの合計」にする。
 */
export function PaymentsTable({
  items,
  total,
  statusFilter = "active",
}: {
  items: ClientPaymentRow[]
  total: number
  statusFilter?: "active" | "cancelled"
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        {statusFilter === "cancelled" ? "取消済みの入金はありません。" : "この期間の入金の記録はありません。"}
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
              <TableHead className="w-[88px]" />
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
                <TableCell className="text-right">
                  {p.status === "CANCELLED" ? (
                    <Badge variant="destructive">取消済み</Badge>
                  ) : p.status === "CONFIRMED" ? (
                    <PaymentCancelDialog paymentId={p.id} paymentNumber={p.paymentNumber} />
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end gap-6 pr-3 text-sm">
        <span className="text-muted-foreground">
          {statusFilter === "cancelled" ? "取消済みの合計" : "合計"}
        </span>
        <span className="font-semibold tabular-nums">{fmtYen(total)}</span>
      </div>
    </div>
  )
}
