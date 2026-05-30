import Link from "next/link"
import { ChevronRight, Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CostCategoryListItem } from "@/lib/actions/cost-categories"
import {
  COST_CATEGORY_STATUS_LABELS,
  COST_CATEGORY_STATUS_BADGE_VARIANT,
  EXTERNAL_COST_CATEGORY_LABELS,
  CALCULATION_TYPE_LABELS,
} from "./labels"

type Props = {
  items: CostCategoryListItem[]
}

function formatAmount(
  amount: CostCategoryListItem["standardAmount"],
  currency: CostCategoryListItem["currency"],
): string {
  if (amount === null || amount === undefined) return "—"
  const n =
    typeof amount === "object" && "toNumber" in amount
      ? amount.toNumber()
      : Number(amount)
  if (!Number.isFinite(n)) return "—"
  if (currency === "JPY") {
    return `¥${n.toLocaleString("ja-JP")}`
  }
  return `${currency} ${n.toLocaleString("ja-JP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function CostCategoriesTable({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        原価費目がありません
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">階層</TableHead>
            <TableHead className="w-[160px]">コード</TableHead>
            <TableHead>名称</TableHead>
            <TableHead className="w-[120px]">大分類</TableHead>
            <TableHead className="w-[140px]">計算方法</TableHead>
            <TableHead className="w-[140px] text-right">標準金額</TableHead>
            <TableHead className="w-[100px]">ステータス</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="text-xs text-muted-foreground">
                Lv{item.level}
              </TableCell>
              <TableCell className="font-mono text-sm">
                <div className="flex items-center gap-1.5">
                  {item.isSystemReserved && (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  )}
                  {item.categoryCode}
                </div>
              </TableCell>
              <TableCell>
                <div className="font-medium">{item.categoryName}</div>
                {item.parent && (
                  <div className="text-xs text-muted-foreground">
                    親: {item.parent.categoryName}
                  </div>
                )}
                {item.categoryNameEn && !item.parent && (
                  <div className="text-xs text-muted-foreground">
                    {item.categoryNameEn}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {EXTERNAL_COST_CATEGORY_LABELS[item.externalCategory]}
              </TableCell>
              <TableCell className="text-sm">
                {CALCULATION_TYPE_LABELS[item.calculationType]}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatAmount(item.standardAmount, item.currency)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={COST_CATEGORY_STATUS_BADGE_VARIANT[item.status]}
                >
                  {COST_CATEGORY_STATUS_LABELS[item.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <Link
                  href={`/cost-categories/${item.id}`}
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
