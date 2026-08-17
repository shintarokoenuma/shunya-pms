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
import type { SalesOrderListRow } from "@/lib/actions/sales-orders"
import {
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_STATUS_BADGE_VARIANT,
} from "./labels"

export function SalesOrdersTable({ rows }: { rows: SalesOrderListRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        受注がありません
      </div>
    )
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px]">SO番号</TableHead>
            <TableHead>クライアント</TableHead>
            <TableHead className="w-[130px]">先方発注番号</TableHead>
            <TableHead className="w-[80px] text-right">品番数</TableHead>
            <TableHead className="w-[90px] text-right">総数量</TableHead>
            <TableHead className="w-[110px]">ステータス</TableHead>
            <TableHead className="w-[110px]">受注日</TableHead>
            <TableHead className="w-[70px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-sm">{r.soNumber}</TableCell>
              <TableCell className="text-sm">{r.clientName}</TableCell>
              <TableCell className="text-sm">
                {r.buyerOrderNumber ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right text-sm">{r.productCount}</TableCell>
              <TableCell className="text-right text-sm">
                {r.totalQuantity.toLocaleString("ja-JP")}
              </TableCell>
              <TableCell>
                <Badge variant={SALES_ORDER_STATUS_BADGE_VARIANT[r.status]}>
                  {SALES_ORDER_STATUS_LABELS[r.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {new Date(r.orderDate).toLocaleDateString("ja-JP")}
              </TableCell>
              <TableCell>
                <Link
                  href={`/sales-orders/${r.id}`}
                  className="inline-flex items-center text-sm text-primary hover:underline"
                >
                  詳細
                  <ChevronRight className="ml-0.5 h-4 w-4" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
