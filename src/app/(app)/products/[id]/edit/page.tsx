import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  getProduct,
  listActiveBrandsForProductSelect,
  listActiveProductCategoriesForProductSelect,
} from "@/lib/actions/products"
import { ProductForm } from "../../_components/product-form"
import type { ProductBaseInput } from "@/lib/validators/product"

type Params = Promise<{ id: string }>

export default async function EditProductPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const [result, brands, categories] = await Promise.all([
    getProduct(id),
    listActiveBrandsForProductSelect(),
    listActiveProductCategoriesForProductSelect(),
  ])
  if (!result.ok) notFound()
  const product = result.data
  if (!product.modelCode) notFound()

  const defaultValues: ProductBaseInput = {
    productName: product.productName,
    productNameEn: product.productNameEn ?? "",
    description: product.description ?? "",
    clientProductCode: product.clientProductCode ?? "",
    clientId: product.clientId,
    brandId: product.brandId,
    categoryId: product.categoryId,
    modelCodeMode: "existing",
    modelCodeId: product.modelCodeId,
    newModelCodeModelName: "",
    season: product.season,
    year: product.year,
    status: product.status,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/products/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細へ戻る
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">品番カルテ 編集</h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          {product.productCode} / {product.productName}
        </p>
      </div>
      <ProductForm
        mode="edit"
        id={id}
        brands={brands}
        categories={categories}
        defaultValues={defaultValues}
        currentProductCode={product.productCode}
        currentModelCode={product.modelCode}
      />
    </div>
  )
}
