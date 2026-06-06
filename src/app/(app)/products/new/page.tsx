import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { listActiveBrandsForModelCodeSelect } from "@/lib/actions/model-codes"
import { listAllActiveProductCategoriesForSelect } from "@/lib/actions/product-categories"
import { listAssignableUsers } from "@/lib/actions/clients"
import { ProductForm } from "../_components/product-form"

type SearchParams = Promise<{ brandId?: string }>

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const [brands, categories, users] = await Promise.all([
    listActiveBrandsForModelCodeSelect(),
    listAllActiveProductCategoriesForSelect(),
    listAssignableUsers(),
  ])

  const initialBrandId =
    sp.brandId && brands.some((b) => b.id === sp.brandId)
      ? sp.brandId
      : undefined

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/products">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          品番カルテ 新規作成
        </h1>
      </div>
      <ProductForm
        mode="create"
        brands={brands}
        categories={categories}
        users={users}
        defaultValues={initialBrandId ? { brandId: initialBrandId } : undefined}
      />
    </div>
  )
}
