import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  getModelCode,
  listActiveBrandsForModelCodeSelect,
} from "@/lib/actions/model-codes"
import { listAllActiveProductCategoriesForSelect } from "@/lib/actions/product-categories"
import { ModelCodeForm } from "../../_components/model-code-form"
import type { ModelCodeBaseInput } from "@/lib/validators/model-code"

type Params = Promise<{ id: string }>

export default async function EditModelCodePage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const [result, brands, categories] = await Promise.all([
    getModelCode(id),
    listActiveBrandsForModelCodeSelect(),
    listAllActiveProductCategoriesForSelect(),
  ])
  if (!result.ok) {
    notFound()
  }
  const item = result.data

  const defaultValues: ModelCodeBaseInput = {
    brandId: item.brandId,
    modelName: item.modelName,
    modelNameEn: item.modelNameEn ?? "",
    description: item.description ?? "",
    categoryId: item.categoryId,
    silhouette: item.silhouette ?? "",
    patternOwnership: item.patternOwnership,
    designOwnership: item.designOwnership,
    status: item.status,
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/model-codes/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">型番 編集</h1>
        <p className="text-sm text-muted-foreground">
          {item.modelName}（{item.modelCode}）
        </p>
      </div>
      <ModelCodeForm
        mode="edit"
        id={id}
        brands={brands}
        categories={categories}
        defaultValues={defaultValues}
        currentModelCode={item.modelCode}
        aggregates={{
          totalRepetitions: item.totalRepetitions,
          totalProductionQty: item.totalProductionQty,
          totalRevenue: item.totalRevenue,
          totalPatternCost: item.totalPatternCost,
          totalDesignCost: item.totalDesignCost,
          costPerUnit: item.costPerUnit,
          hasPattern: item.hasPattern,
          hasDesign: item.hasDesign,
          hasGrading: item.hasGrading,
          latestProductId: item.latestProductId,
        }}
      />
    </div>
  )
}
