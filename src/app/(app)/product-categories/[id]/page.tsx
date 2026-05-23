import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getProductCategory } from "@/lib/actions/product-categories"
import { ProductCategoryActions } from "../_components/product-category-delete-button"
import {
  PRODUCT_CATEGORY_STATUS_LABELS,
  PRODUCT_CATEGORY_STATUS_BADGE_VARIANT,
  PRODUCT_CATEGORY_LEVEL_LABELS,
} from "../_components/labels"

type Params = Promise<{ id: string }>

function levelLabel(level: number): string {
  if (level === 1 || level === 2 || level === 3) {
    return PRODUCT_CATEGORY_LEVEL_LABELS[level as 1 | 2 | 3]
  }
  return `レベル ${level}`
}

function formatDecimal(value: unknown): string {
  if (value === null || value === undefined) return "—"
  // Prisma.Decimal は toString() で文字列化
  const s = typeof value === "object" && value !== null && "toString" in value
    ? (value as { toString(): string }).toString()
    : String(value)
  return s
}

export default async function ProductCategoryDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const companyId = session.user.companyId
  if (!companyId) redirect("/login")

  const { id } = await params

  let category
  try {
    category = await getProductCategory(id)
  } catch {
    notFound()
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { tenantType: true },
  })
  const isMasterAdmin = company?.tenantType === "MASTER_ADMIN"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/product-categories">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧へ戻る
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/product-categories/${category.id}/edit`}>
              <Pencil className="mr-1 h-4 w-4" />
              編集
            </Link>
          </Button>
          <ProductCategoryActions
            id={category.id}
            name={category.categoryName}
            status={category.status}
            isMasterAdmin={isMasterAdmin}
            variant="menu"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold">{category.categoryName}</h1>
          <Badge variant={PRODUCT_CATEGORY_STATUS_BADGE_VARIANT[category.status]}>
            {PRODUCT_CATEGORY_STATUS_LABELS[category.status]}
          </Badge>
          <Badge variant="outline">{levelLabel(category.level)}</Badge>
        </div>
        <div className="text-sm text-muted-foreground font-mono">
          {category.categoryCode}
          {category.categoryNameEn && (
            <span className="ml-3 not-italic">
              <span className="font-sans">/ {category.categoryNameEn}</span>
            </span>
          )}
        </div>
        {category.parent && (
          <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <span>階層:</span>
            <Link
              href={`/product-categories/${category.parent.id}`}
              className="hover:underline"
            >
              <span className="font-mono text-xs mr-1">
                {category.parent.categoryCode}
              </span>
              {category.parent.categoryName}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-foreground">
              {category.categoryName}
            </span>
          </div>
        )}
      </div>

      {/* ───────── 基本情報 ───────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="カテゴリコード" value={category.categoryCode} mono />
          <Row label="カテゴリ名" value={category.categoryName} />
          <Row
            label="カテゴリ名(英)"
            value={category.categoryNameEn ?? "—"}
          />
          <Row label="階層レベル" value={levelLabel(category.level)} />
          <Row
            label="親カテゴリ"
            value={
              category.parent ? (
                <Link
                  href={`/product-categories/${category.parent.id}`}
                  className="hover:underline"
                >
                  <span className="font-mono text-xs mr-1">
                    {category.parent.categoryCode}
                  </span>
                  {category.parent.categoryName}
                </Link>
              ) : (
                "—"
              )
            }
          />
        </CardContent>
      </Card>

      {/* ───────── 標準値 ───────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">標準値（業務支援）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row
            label="標準用尺(m/枚)"
            value={formatDecimal(category.standardFabricUsage)}
          />
          <Row
            label="標準ロス率(%)"
            value={formatDecimal(category.standardLossRate)}
          />
          <Row
            label="標準縫製工賃(円)"
            value={formatDecimal(category.standardSewingFee)}
          />
        </CardContent>
      </Card>

      {/* ───────── 子カテゴリ一覧 ───────── */}
      {category.children && category.children.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              子カテゴリ（{category.children.length} 件）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {category.children.map((child) => (
                <li
                  key={child.id}
                  className="py-2 flex items-center justify-between"
                >
                  <Link
                    href={`/product-categories/${child.id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {child.categoryCode}
                    </span>
                    <span className="font-medium">{child.categoryName}</span>
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {levelLabel(child.level)}
                    </Badge>
                    <Badge
                      variant={PRODUCT_CATEGORY_STATUS_BADGE_VARIANT[child.status]}
                    >
                      {PRODUCT_CATEGORY_STATUS_LABELS[child.status]}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3">
      <div className="text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono" : ""}>{value}</div>
    </div>
  )
}
