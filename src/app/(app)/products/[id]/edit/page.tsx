import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { getProduct } from "@/lib/actions/products"
import { listActiveBrandsForModelCodeSelect } from "@/lib/actions/model-codes"
import { listAllActiveProductCategoriesForSelect } from "@/lib/actions/product-categories"
import { listAssignableUsers } from "@/lib/actions/clients"
import { ProductForm } from "../../_components/product-form"
import type { ProductFormValues } from "@/lib/validators/product"
import { parseSeasonType } from "@/lib/constants/season-types"

type Params = Promise<{ id: string }>

/** Date | null を <input type="date"> 用の YYYY-MM-DD 文字列に変換 */
function toDateInput(value: Date | null): string {
  if (!value) return ""
  return new Date(value).toISOString().slice(0, 10)
}

export default async function EditProductPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const [result, brands, categories, users] = await Promise.all([
    getProduct(id),
    listActiveBrandsForModelCodeSelect(),
    listAllActiveProductCategoriesForSelect(),
    listAssignableUsers(),
  ])
  if (!result.ok) {
    notFound()
  }
  const item = result.data

  const defaultValues: ProductFormValues = {
    brandId: item.brandId,
    categoryId: item.categoryId ?? "",
    clientProductCode: item.clientProductCode ?? "",
    productName: item.productName,
    productNameEn: item.productNameEn ?? "",
    description: item.description ?? "",
    silhouette: item.silhouette ?? "",
    // seasonType が NULL の旧行（移行前）は season 文字列末尾から逆引きして初期表示。未確定なら未選択。
    seasonType: (item.seasonType ??
      parseSeasonType(item.season) ??
      undefined) as ProductFormValues["seasonType"],
    year: item.year,
    expectedQuantity: item.expectedQuantity ?? "",
    desiredDeliveryDate: toDateInput(item.desiredDeliveryDate),
    assignedToUserId: item.assignedToUserId,
    designerId: item.designerId,
    patternMakerId: item.patternMakerId,
    internalNotes: item.internalNotes ?? "",
    status: item.status,
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/products/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          品番カルテ 編集
        </h1>
        <p className="text-sm text-muted-foreground">
          {item.productName}（{item.productCode}）
        </p>
      </div>
      <ProductForm
        mode="edit"
        id={id}
        brands={brands}
        categories={categories}
        users={users}
        defaultValues={defaultValues}
        currentProductCode={item.productCode}
      />
    </div>
  )
}
