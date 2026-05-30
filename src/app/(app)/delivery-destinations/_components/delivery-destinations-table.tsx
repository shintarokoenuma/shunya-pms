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
import type { DeliveryDestinationListItem } from "@/lib/actions/delivery-destinations"
import {
  DELIVERY_DESTINATION_STATUS_LABELS,
  DELIVERY_DESTINATION_STATUS_BADGE_VARIANT,
} from "./labels"

type Props = {
  items: DeliveryDestinationListItem[]
}

export function DeliveryDestinationsTable({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        納品先がありません
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>納品先名</TableHead>
            <TableHead className="w-[180px]">コード</TableHead>
            <TableHead className="w-[200px]">クライアント</TableHead>
            <TableHead className="w-[180px]">バイヤー</TableHead>
            <TableHead className="w-[120px]">所在地</TableHead>
            <TableHead className="w-[100px]">ステータス</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="font-medium">{item.destinationName}</div>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {item.destinationCode}
              </TableCell>
              <TableCell className="text-sm">
                {item.buyer.client ? (
                  <Link
                    href={`/clients/${item.buyer.client.id}`}
                    className="hover:underline"
                  >
                    <span className="font-mono text-xs text-muted-foreground mr-1">
                      {item.buyer.client.clientCode}
                    </span>
                    {item.buyer.client.companyName}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                <Link
                  href={`/buyers/${item.buyer.id}`}
                  className="hover:underline"
                >
                  <span className="font-mono text-xs text-muted-foreground mr-1">
                    {item.buyer.buyerCode}
                  </span>
                  {item.buyer.buyerName}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                {item.country === "JP"
                  ? item.prefecture ?? "—"
                  : item.country}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    DELIVERY_DESTINATION_STATUS_BADGE_VARIANT[item.status]
                  }
                >
                  {DELIVERY_DESTINATION_STATUS_LABELS[item.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <Link
                  href={`/delivery-destinations/${item.id}`}
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
