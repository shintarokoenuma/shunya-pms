import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, Lock, Pencil } from "lucide-react"
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
import { getCostCategory } from "@/lib/actions/cost-categories"
import { CostCategoryDeleteButton } from "../_components/cost-category-delete-button"
import {
  COST_CATEGORY_STATUS_LABELS,
  COST_CATEGORY_STATUS_BADGE_VARIANT,
  EXTERNAL_COST_CATEGORY_LABELS,
  CALCULATION_TYPE_LABELS,
  CALCULATION_TYPE_DESCRIPTIONS,
} from "../_components/labels"

type Params = Promise<{ id: string }>

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

export default async function CostCategoryDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const result = await getCostCategory(id)
  if (!result.ok) {
    notFound()
  }
  const item = result.data

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
          <Link href="/cost-categories">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {item.categoryName}
              </h1>
              <Badge variant={COST_CATEGORY_STATUS_BADGE_VARIANT[item.status]}>
                {COST_CATEGORY_STATUS_LABELS[item.status]}
              </Badge>
              {item.isSystemReserved && (
                <Badge variant="outline" className="gap-1">
                  <Lock className="h-3 w-3" />
                  予約
                </Badge>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono">{item.categoryCode}</span>
              <span>·</span>
              <span>Lv{item.level}</span>
              {item.categoryNameEn && (
                <>
                  <span>·</span>
                  <span>{item.categoryNameEn}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/cost-categories/${id}/edit`}>
                <Pencil className="mr-1 h-4 w-4" />
                編集
              </Link>
            </Button>
            <CostCategoryDeleteButton
              id={item.id}
              categoryName={item.categoryName}
              status={item.status}
              isSystemReserved={item.isSystemReserved}
              isMasterAdmin={isMasterAdmin}
            />
          </div>
        </div>
      </div>

      {/* 階層・大分類 */}
      <Card>
        <CardHeader>
          <CardTitle>階層・大分類</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <DetailRow label="階層レベル" value={`Lv${item.level}`} />
          <DetailRow
            label="大分類"
            value={EXTERNAL_COST_CATEGORY_LABELS[item.externalCategory]}
          />
          {item.parent && (
            <DetailRow
              label="親カテゴリ"
              value={
                <Link
                  href={`/cost-categories/${item.parent.id}`}
                  className="text-primary hover:underline"
                >
                  <span className="font-mono text-xs text-muted-foreground mr-2">
                    {item.parent.categoryCode}
                  </span>
                  {item.parent.categoryName}
                </Link>
              }
            />
          )}
          {item.children.length > 0 && (
            <DetailRow
              label="子カテゴリ"
              value={
                <ul className="space-y-1">
                  {item.children.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/cost-categories/${c.id}`}
                        className="text-primary hover:underline"
                      >
                        <span className="font-mono text-xs text-muted-foreground mr-2">
                          {c.categoryCode}
                        </span>
                        {c.categoryName}
                      </Link>
                    </li>
                  ))}
                </ul>
              }
            />
          )}
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
