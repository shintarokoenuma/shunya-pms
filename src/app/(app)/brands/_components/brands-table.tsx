import Link from "next/link"
import { Pencil } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BrandActions } from "./brand-delete-button"
import { BRAND_STATUS_LABEL, BRAND_STATUS_BADGE_VARIANT } from "./labels"

type BrandRow = {
  id: string
  brandCode: string
  brandName: string
  brandNameEn: string | null
  status: "ACTIVE" | "PAUSED" | "ARCHIVED"
  client: {
    id: string
    clientCode: string
    companyName: string
  }
}

export function BrandsTable({
  items,
  isMasterAdmin,
}: {
  items: BrandRow[]
  isMasterAdmin: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        ブランドがありません。新規作成ボタンから登録してください。
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ブランド名</TableHead>
            <TableHead className="w-[80px]">コード</TableHead>
            <TableHead>クライアント</TableHead>
            <TableHead className="w-[100px]">ステータス</TableHead>
            <TableHead className="w-[120px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((b) => (
            <TableRow key={b.id}>
              <TableCell>
                <Link
                  href={`/brands/${b.id}`}
                  className="font-medium hover:underline"
                >
                  {b.brandName}
                </Link>
                {b.brandNameEn && (
                  <div className="text-xs text-muted-foreground">{b.brandNameEn}</div>
                )}
              </TableCell>
              <TableCell className="font-mono">{b.brandCode}</TableCell>
              <TableCell>
                <Link
                  href={`/clients/${b.client.id}`}
                  className="text-sm hover:underline"
                >
                  {b.client.companyName}
                </Link>
                <div className="text-xs text-muted-foreground font-mono">
                  {b.client.clientCode}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={BRAND_STATUS_BADGE_VARIANT[b.status]}>
                  {BRAND_STATUS_LABEL[b.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button asChild variant="ghost" size="icon" aria-label="編集">
                    <Link href={`/brands/${b.id}/edit`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <BrandActions id={b.id} name={b.brandName} status={b.status} isMasterAdmin={isMasterAdmin} variant="icon" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
