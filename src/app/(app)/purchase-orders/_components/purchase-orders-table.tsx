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
import type { PurchaseOrderListItem } from "@/lib/actions/purchase-orders"
import {
  PURCHASE_ORDER_STATUS_LABELS,
  PURCHASE_ORDER_STATUS_BADGE_VARIANT,
} from "./labels"

export function PurchaseOrdersTable({ items }: { items: PurchaseOrderListItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        発注がありません
      </div>
    )
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[170px]">PO番号</TableHead>
            <TableHead>発注先</TableHead>
            <TableHead className="w-[120px]">ステータス</TableHead>
            <TableHead className="w-[120px]">発注日</TableHead>
            <TableHead className="w-[90px]">紐付け</TableHead>
            <TableHead className="w-[70px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-sm">{item.poNumber}</TableCell>
              <TableCell className="text-sm">
                {item.supplier ? (
                  <span>
                    <span className="font-mono text-xs text-muted-foreground mr-1">
                      {item.supplier.supplierCode}
                    </span>
                    {item.supplier.companyName}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={PURCHASE_ORDER_STATUS_BADGE_VARIANT[item.status]}>
                  {PURCHASE_ORDER_STATUS_LABELS[item.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {new Date(item.orderDate).toLocaleDateString("ja-JP")}
              </TableCell>
              <TableCell className="text-sm">
                {item.progressTaskId ? (
                  <Badge variant="outline" className="text-xs">タスク</Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Link
                  href={`/purchase-orders/${item.id}`}
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
