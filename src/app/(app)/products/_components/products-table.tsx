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
import type { ProductListRow } from "@/lib/actions/products"
import { ProductActions } from "./product-delete-button"
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_BADGE_VARIANT,
} from "./labels"

export function ProductsTable({
  items,
  isMasterAdmin,
}: {
  items: ProductListRow[]
  isMasterAdmin: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        品番がありません。新規作成ボタンから登録してください。
      </div>
    )
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>商品名</TableHead>
            <TableHead className="w-[180px]">社内品番</TableHead>
            <TableHead className="w-[160px]">ブランド</TableHead>
            <TableHead className="w-[160px]">カテゴリ</TableHead>
            <TableHead className="w-[100px]">シーズン</TableHead>
            <TableHead className="w-[140px]">ステータス</TableHead>
            <TableHead className="w-[120px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <Link
                  href={`/products/${p.id}`}
                  className="font-medium hover:underline"
                >
                  {p.productName}
                </Link>
                {p.clientProductCode && (
                  <div className="text-xs text-muted-foreground font-mono">
                    先方: {p.clientProductCode}
                  </div>
                )}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {p.productCode}
              </TableCell>
              <TableCell>
                {p.brand ? (
                  <span className="text-sm">
                    <span className="font-mono text-xs text-muted-foreground mr-1">
                      {p.brand.brandCode}
                    </span>
                    {p.brand.brandName}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {p.category ? (
                  <span className="text-sm">
                    <span className="font-mono text-xs text-muted-foreground mr-1">
                      {p.category.categoryCode}
                    </span>
                    {p.category.categoryName}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">{p.season}</TableCell>
              <TableCell>
                <Badge variant={PRODUCT_STATUS_BADGE_VARIANT[p.status]}>
                  {PRODUCT_STATUS_LABELS[p.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    aria-label="編集"
                  >
                    <Link href={`/products/${p.id}/edit`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <ProductActions
                    id={p.id}
                    productCode={p.productCode}
                    productName={p.productName}
                    status={p.status}
                    isMasterAdmin={isMasterAdmin}
                    variant="icon"
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
