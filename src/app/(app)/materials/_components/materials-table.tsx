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
import type { Prisma } from "@prisma/client"
import type { MaterialListItem } from "@/lib/actions/materials"
import {
  MATERIAL_STATUS_LABELS,
  MATERIAL_STATUS_BADGE_VARIANT,
  MATERIAL_TYPE_LABELS,
  MATERIAL_TYPE_BADGE_VARIANT,
} from "./labels"

type Props = {
  items: MaterialListItem[]
}

function formatPrice(
  price: Prisma.Decimal | number | null,
  currency: string,
  unit: string,
): string {
  if (price === null || price === undefined) return "—"
  const n =
    typeof price === "number"
      ? price
      : "toNumber" in price
        ? price.toNumber()
        : Number(price)
  if (!Number.isFinite(n)) return "—"
  return `${n.toLocaleString("ja-JP", { maximumFractionDigits: 4 })} ${currency}/${unit}`
}

export function MaterialsTable({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        素材がありません
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">コード</TableHead>
            <TableHead>素材名</TableHead>
            <TableHead className="w-[110px]">タイプ</TableHead>
            <TableHead className="w-[200px]">仕入先</TableHead>
            <TableHead className="w-[180px]">単価</TableHead>
            <TableHead className="w-[110px]">ステータス</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-sm">
                {item.materialCode}
              </TableCell>
              <TableCell>
                <div className="font-medium">{item.materialName}</div>
                {item.materialNameEn && (
                  <div className="text-xs text-muted-foreground">
                    {item.materialNameEn}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={MATERIAL_TYPE_BADGE_VARIANT[item.materialType]}>
                  {MATERIAL_TYPE_LABELS[item.materialType]}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {item.supplier ? (
                  <Link
                    href={`/suppliers/${item.supplier.id}`}
                    className="hover:underline"
                  >
                    <span className="font-mono text-xs text-muted-foreground mr-1">
                      {item.supplier.supplierCode}
                    </span>
                    {item.supplier.companyName}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm tabular-nums">
                {formatPrice(item.unitPrice, item.currency, item.unit)}
              </TableCell>
              <TableCell>
                <Badge variant={MATERIAL_STATUS_BADGE_VARIANT[item.status]}>
                  {MATERIAL_STATUS_LABELS[item.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <Link
                  href={`/materials/${item.id}`}
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
