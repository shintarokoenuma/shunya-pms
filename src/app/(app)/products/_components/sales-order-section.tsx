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
import type { SalesOrderKarteSection } from "@/lib/actions/sales-orders"
import {
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_STATUS_BADGE_VARIANT,
  SKU_MOQ_STATUS_LABELS,
} from "../../sales-orders/_components/labels"

/**
 * B-148 R-11: 品番カルテの受注セクション（集約表示・入力はしない）。
 * この品番に紐づく SKU 別受注数（Sku.orderedQuantity＝CONFIRMED 以降の合計）・
 * MOQ 判定・元 SO へのリンクを表示する。
 */
export function SalesOrderSection({
  section,
}: {
  section: SalesOrderKarteSection
}) {
  const { skus, orders } = section
  const hasOrdered = skus.some((s) => s.orderedQuantity > 0)

  return (
    <div className="space-y-4">
      {orders.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">紐づく受注:</span>
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/sales-orders/${o.id}`}
              className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs hover:bg-muted"
            >
              <span className="font-mono">{o.soNumber}</span>
              <Badge
                variant={SALES_ORDER_STATUS_BADGE_VARIANT[o.status]}
                className="ml-1 text-[10px]"
              >
                {SALES_ORDER_STATUS_LABELS[o.status]}
              </Badge>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          この品番に紐づく受注はまだありません。
        </p>
      )}

      {skus.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>カラー / サイズ</TableHead>
                <TableHead className="w-[120px] text-right">
                  受注数（合計）
                </TableHead>
                <TableHead className="w-[180px]">MOQ 判定</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skus.map((s) => (
                <TableRow key={s.skuId}>
                  <TableCell className="text-sm">
                    {s.colorName} / {s.size}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {s.orderedQuantity.toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {SKU_MOQ_STATUS_LABELS[s.moqStatus]}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {!hasOrdered && orders.length > 0 && (
        <p className="text-xs text-muted-foreground">
          受注数は確定受注（CONFIRMED）以降で集計されます。入力途中（TENTATIVE）の受注は含みません。
        </p>
      )}
      <div className="flex justify-end">
        <Link
          href="/sales-orders/new"
          className="inline-flex items-center text-sm text-primary hover:underline"
        >
          受注を作成
          <ChevronRight className="ml-0.5 h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
