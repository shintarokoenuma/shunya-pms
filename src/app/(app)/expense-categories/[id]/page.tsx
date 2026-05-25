import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, Pencil } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getExpenseCategory } from "@/lib/actions/expense-categories"
import { ExpenseCategoryDeleteButton } from "../_components/expense-category-delete-button"
import {
  EXPENSE_CATEGORY_STATUS_LABELS,
  EXPENSE_CATEGORY_STATUS_BADGE_VARIANT,
  EXPENSE_TYPE_LABELS,
  CALCULATION_TYPE_LABELS,
  CALCULATION_TYPE_DESCRIPTIONS,
} from "../_components/labels"

type Params = Promise<{ id: string }>

/**
 * Decimal | null を「¥30,000」のような表示に整形
 */
function formatAmount(
  amount: { toNumber?: () => number } | number | null,
  currency: string,
): string {
  if (amount === null || amount === undefined) return "—"
  const n =
    typeof amount === "object" && amount && "toNumber" in amount && amount.toNumber
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

export default async function ExpenseCategoryDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const result = await getExpenseCategory(id)
  if (!result.ok) {
    notFound()
  }
  const item = result.data

  // MASTER_ADMIN 判定（tenantType で判定）
  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { tenantType: true },
  })
  const isMasterAdmin = company?.tenantType === "MASTER_ADMIN"

  return (
    <div className="space-y-6 p-6">
      {/* ヘッダー */}
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/expense-categories">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {item.expenseName}
              </h1>
              <Badge
                variant={
                  EXPENSE_CATEGORY_STATUS_BADGE_VARIANT[item.status]
                }
              >
                {EXPENSE_CATEGORY_STATUS_LABELS[item.status]}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono">{item.expenseCode}</span>
              {item.expenseNameEn && (
                <>
                  <span>·</span>
                  <span>{item.expenseNameEn}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/expense-categories/${id}/edit`}>
                <Pencil className="mr-1 h-4 w-4" />
                編集
              </Link>
            </Button>
            <ExpenseCategoryDeleteButton
              id={item.id}
              expenseName={item.expenseName}
              status={item.status}
              isMasterAdmin={isMasterAdmin}
            />
          </div>
        </div>
      </div>

      {/* 分類 */}
      <Card>
        <CardHeader>
          <CardTitle>分類</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow label="費用種別" value={EXPENSE_TYPE_LABELS[item.expenseType]} />
        </CardContent>
      </Card>

      {/* 標準金額・計算方法 */}
      <Card>
        <CardHeader>
          <CardTitle>標準金額・計算方法</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DetailRow
            label="計算方法"
            value={
              <>
                <div>{CALCULATION_TYPE_LABELS[item.calculationType]}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {CALCULATION_TYPE_DESCRIPTIONS[item.calculationType]}
                </div>
              </>
            }
          />
          <DetailRow
            label="標準金額"
            value={
              item.calculationType === "PERCENTAGE" && item.standardAmount !== null
                ? `${item.standardAmount}%`
                : formatAmount(item.standardAmount, item.currency)
            }
          />
          {item.calculationType !== "PERCENTAGE" && (
            <DetailRow label="通貨" value={item.currency} />
          )}
        </CardContent>
      </Card>

      {/* メモ */}
      {item.notes && (
        <Card>
          <CardHeader>
            <CardTitle>メモ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{item.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* メタ情報 */}
      <Card>
        <CardHeader>
          <CardTitle>メタ情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <DetailRow
            label="作成日時"
            value={new Date(item.createdAt).toLocaleString("ja-JP")}
          />
          <DetailRow
            label="最終更新"
            value={new Date(item.updatedAt).toLocaleString("ja-JP")}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  )
}
