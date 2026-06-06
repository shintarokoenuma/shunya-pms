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
import type { ProductListItem } from "@/lib/actions/products"
import {
  primaryProductCode,
  secondaryProductCode,
} from "@/lib/utils/product-code"
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_BADGE_VARIANT,
} from "./labels"

type Props = {
  items: ProductListItem[]
}

export function ProductsTable({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        品番カルテがありません
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>品名</TableHead>
            <TableHead className="w-[200px]">品番</TableHead>
            <TableHead className="w-[160px]">ブランド</TableHead>
            <TableHead className="w-[120px]">カテゴリ</TableHead>
            <TableHead className="w-[90px]">シーズン</TableHead>
            <TableHead className="w-[120px]">ステータス</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const primary = primaryProductCode(item)
            const secondary = secondaryProductCode(item)
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.productName}</div>
                  {item.productNameEn && (
                    <div className="text-xs text-muted-foreground">
                      {item.productNameEn}
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  <div>{primary}</div>
                  {secondary && (
                    <div className="text-xs text-muted-foreground">
                      社内: {secondary}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {item.brand ? (
                    <span>
                      <span className="font-mono text-xs text-muted-foreground mr-1">
                        {item.brand.brandCode}
                      </span>
                      {item.brand.brandName}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {item.category ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.category.categoryCode}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{item.season}</TableCell>
                <TableCell>
                  <Badge variant={PRODUCT_STATUS_BADGE_VARIANT[item.status]}>
                    {PRODUCT_STATUS_LABELS[item.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/products/${item.id}`}
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
