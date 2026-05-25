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
import type { ExpenseCategoryListItem } from "@/lib/actions/expense-categories"
import {
  EXPENSE_CATEGORY_STATUS_LABELS,
  EXPENSE_CATEGORY_STATUS_BADGE_VARIANT,
  EXPENSE_TYPE_LABELS,
  CALCULATION_TYPE_LABELS,
} from "./labels"

type Props = {
  items: ExpenseCategoryListItem[]
}

/**
 * Decimal | null を「¥30,000」「USD 50」のような表示に整形
 * standardAmount が null のときは「—」
 */
function formatAmount(
  amount: ExpenseCategoryListItem["standardAmount"],
  currency: ExpenseCategoryListItem["currency"],
): string {
  if (amount === null || amount === undefined) return "—"
  // Prisma.Decimal は toNumber() を持つ
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

export function ExpenseCategoriesTable({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        諸経費カテゴリがありません
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">コード</TableHead>
            <TableHead>名称</TableHead>
            <TableHead className="w-[160px]">費用種別</TableHead>
            <TableHead className="w-[140px]">計算方法</TableHead>
            <TableHead className="w-[140px] text-right">標準金額</TableHead>
            <TableHead className="w-[100px]">ステータス</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-sm">
                {item.expenseCode}
              </TableCell>
              <TableCell>
                <div className="font-medium">{item.expenseName}</div>
                {item.expenseNameEn && (
                  <div className="text-xs text-muted-foreground">
                    {item.expenseNameEn}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {EXPENSE_TYPE_LABELS[item.expenseType]}
              </TableCell>
              <TableCell className="text-sm">
                {CALCULATION_TYPE_LABELS[item.calculationType]}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatAmount(item.standardAmount, item.currency)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    EXPENSE_CATEGORY_STATUS_BADGE_VARIANT[item.status]
                  }
                >
                  {EXPENSE_CATEGORY_STATUS_LABELS[item.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <Link
                  href={`/expense-categories/${item.id}`}
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
