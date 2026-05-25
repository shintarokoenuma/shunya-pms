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
import type { BuyerListItem } from "@/lib/actions/buyers"
import {
  BUYER_STATUS_LABELS,
  BUYER_STATUS_BADGE_VARIANT,
} from "./labels"

type Props = {
  items: BuyerListItem[]
}

export function BuyersTable({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        バイヤーがありません
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">コード</TableHead>
            <TableHead>バイヤー名</TableHead>
            <TableHead className="w-[220px]">関連クライアント</TableHead>
            <TableHead className="w-[80px]">国</TableHead>
            <TableHead className="w-[100px]">ステータス</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-sm">
                {item.buyerCode}
              </TableCell>
              <TableCell>
                <div className="font-medium">{item.buyerName}</div>
                {item.buyerNameEn && (
                  <div className="text-xs text-muted-foreground">
                    {item.buyerNameEn}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {item.client ? (
                  <Link
                    href={`/clients/${item.client.id}`}
                    className="hover:underline"
                  >
                    <span className="font-mono text-xs text-muted-foreground mr-1">
                      {item.client.clientCode}
                    </span>
                    {item.client.companyName}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm">{item.country}</TableCell>
              <TableCell>
                <Badge variant={BUYER_STATUS_BADGE_VARIANT[item.status]}>
                  {BUYER_STATUS_LABELS[item.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <Link
                  href={`/buyers/${item.id}`}
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
