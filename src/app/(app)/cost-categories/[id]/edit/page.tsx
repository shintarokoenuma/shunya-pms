import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { getCostCategory } from "@/lib/actions/cost-categories"
import { CostCategoryForm } from "../../_components/cost-category-form"

type Params = Promise<{ id: string }>

export default async function EditCostCategoryPage({
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

  const standardAmount =
    item.standardAmount === null
      ? null
      : typeof item.standardAmount === "object" &&
          "toNumber" in item.standardAmount
        ? item.standardAmount.toNumber()
        : Number(item.standardAmount)

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/cost-categories/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">原価費目 編集</h1>
        <p className="text-sm text-muted-foreground">
          {item.categoryName}（{item.categoryCode}） / Lv{item.level}
        </p>
      </div>
      <CostCategoryForm
        mode="edit"
        initialId={id}
        initialValues={{
          categoryCode: item.categoryCode,
          categoryName: item.categoryName,
          categoryNameEn: item.categoryNameEn ?? "",
          parentCategoryId: item.parentCategoryId,
          level: item.level as 1 | 2,
          externalCategory: item.externalCategory,
          standardAmount,
          currency: item.currency,
          calculationType: item.calculationType,
          notes: item.notes ?? "",
          status: item.status,
          isSystemReserved: item.isSystemReserved,
        }}
      />
    </div>
  )
}
