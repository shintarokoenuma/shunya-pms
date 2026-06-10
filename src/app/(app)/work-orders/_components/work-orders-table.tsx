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
import type { WorkOrderListItem } from "@/lib/actions/work-orders"
import { WORK_ORDER_TYPE_LABELS } from "@/lib/constants/work-order-types"
import {
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUS_BADGE_VARIANT,
} from "./labels"

export function WorkOrdersTable({ items }: { items: WorkOrderListItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        作業発注がありません
      </div>
    )
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[170px]">WO番号</TableHead>
            <TableHead>発注先</TableHead>
            <TableHead className="w-[120px]">作業タイプ</TableHead>
            <TableHead className="w-[120px]">ステータス</TableHead>
            <TableHead className="w-[120px]">発注日</TableHead>
            <TableHead className="w-[70px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const orderTo = item.factory
              ? { code: item.factory.factoryCode, name: item.factory.factoryName }
              : item.contractor
                ? {
                    code: item.contractor.contractorCode,
                    name: item.contractor.contractorName,
                  }
                : null
            return (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-sm">{item.woNumber}</TableCell>
                <TableCell className="text-sm">
                  {orderTo ? (
                    <span>
                      <span className="font-mono text-xs text-muted-foreground mr-1">
                        {orderTo.code}
                      </span>
                      {orderTo.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {WORK_ORDER_TYPE_LABELS[item.workType]}
                </TableCell>
                <TableCell>
                  <Badge variant={WORK_ORDER_STATUS_BADGE_VARIANT[item.status]}>
                    {WORK_ORDER_STATUS_LABELS[item.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {new Date(item.orderDate).toLocaleDateString("ja-JP")}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/work-orders/${item.id}`}
                    className="inline-flex items-center text-sm text-primary hover:underline"
                  >
                    詳細
                    <ChevronRight className="ml-0.5 h-4 w-4" />
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
