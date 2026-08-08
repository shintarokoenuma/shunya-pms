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
import type { DeliveryNoteListItem } from "@/lib/actions/delivery-notes"
import {
  DELIVERY_NOTE_STATUS_LABELS,
  DELIVERY_NOTE_STATUS_BADGE_VARIANT,
} from "./labels"

export function DeliveryNotesTable({ items }: { items: DeliveryNoteListItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        納品書がありません
      </div>
    )
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[170px]">DLV番号</TableHead>
            <TableHead>クライアント</TableHead>
            <TableHead className="w-[120px]">ステータス</TableHead>
            <TableHead className="w-[120px]">納品日</TableHead>
            <TableHead className="w-[90px] text-right">数量</TableHead>
            <TableHead className="w-[70px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-sm">
                {item.deliveryNumber}
              </TableCell>
              <TableCell className="text-sm">
                {item.clientName ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={DELIVERY_NOTE_STATUS_BADGE_VARIANT[item.status]}>
                  {DELIVERY_NOTE_STATUS_LABELS[item.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {new Date(item.deliveryDate).toLocaleDateString("ja-JP")}
              </TableCell>
              <TableCell className="text-right text-sm">
                {item.totalQuantity.toLocaleString("ja-JP")}
              </TableCell>
              <TableCell>
                <Link
                  href={`/deliveries/${item.id}`}
                  className="flex items-center justify-end text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
