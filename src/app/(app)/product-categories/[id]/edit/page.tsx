import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { getProductCategory } from "@/lib/actions/product-categories"
import { ProductCategoryForm } from "../../_components/product-category-form"
import type { ProductCategoryFormValues } from "@/lib/validators/product-category"

type Params = Promise<{ id: string }>

export default async function EditProductCategoryPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params

  let category
  try {
    category = await getProductCategory(id)
  } catch {
    notFound()
  }

  // Prisma.Decimal → number に変換するヘルパー
  const decimalToNumber = (v: unknown): number | null => {
    if (v === null || v === undefined) return null
    if (typeof v === "number") return v
    if (typeof v === "object" && v !== null && "toString" in v) {
      const n = Number((v as { toString(): string }).toString())
      return Number.isFinite(n) ? n : null
    }
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  const initialValues: Partial<ProductCategoryFormValues> = {
    categoryCode: category.categoryCode,
    categoryName: category.categoryName,
    categoryNameEn: category.categoryNameEn ?? "",
    parentCategoryId: category.parentCategoryId,
    level: category.level as 1 | 2 | 3,
    standardFabricUsage: decimalToNumber(category.standardFabricUsage),
    standardLossRate: decimalToNumber(category.standardLossRate),
    standardSewingFee: decimalToNumber(category.standardSewingFee),
    defaultSizeOptions: Array.isArray(category.defaultSizeOptions)
      ? category.defaultSizeOptions.filter(
          (v): v is string => typeof v === "string",
        )
      : [],
    status: category.status,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/product-categories/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細へ戻る
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">商品カテゴリ 編集</h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          {category.categoryCode} / {category.categoryName}
        </p>
      </div>
      <ProductCategoryForm
        mode="edit"
        initialId={id}
        initialValues={initialValues}
      />
    </div>
  )
}
