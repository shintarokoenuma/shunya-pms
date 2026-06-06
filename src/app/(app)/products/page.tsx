import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  listProducts,
  type ListProductsParams,
} from "@/lib/actions/products"
import { listActiveBrandsForModelCodeSelect } from "@/lib/actions/model-codes"
import { ProductsSearch } from "./_components/products-search"
import { ProductsTable } from "./_components/products-table"
import { ProductsPagination } from "./_components/products-pagination"
import type { ProductStatus } from "@prisma/client"

type SearchParams = Promise<{
  q?: string
  status?: string
  brandId?: string
  season?: string
  page?: string
}>

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const page = sp.page ? Number(sp.page) : 1

  const params: ListProductsParams = {
    q: sp.q,
    status: sp.status as ProductStatus | undefined,
    brandId: sp.brandId,
    season: sp.season,
    page,
    pageSize: 20,
  }

  const [result, brands] = await Promise.all([
    listProducts(params),
    listActiveBrandsForModelCodeSelect(),
  ])

  if (!result.ok) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    )
  }

  const { items, total, totalPages, page: currentPage } = result.data

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">品番カルテ</h1>
          <p className="text-sm text-muted-foreground">
            案件の背骨となる品番（Product）。社内品番は ブランド × シーズン ×
            カテゴリ で自動採番されます。
          </p>
        </div>
        <Button asChild>
          <Link href="/products/new">
            <Plus className="mr-1 h-4 w-4" />
            新規作成
          </Link>
        </Button>
      </div>

      <ProductsSearch brands={brands} />
      <ProductsTable items={items} />
      <ProductsPagination
        page={currentPage}
        totalPages={totalPages}
        total={total}
      />
    </div>
  )
}
