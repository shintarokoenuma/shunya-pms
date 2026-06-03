import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { ProductStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import {
  listProducts,
  listActiveBrandsForProductSelect,
  listActiveProductCategoriesForProductSelect,
  type ListProductsParams,
} from "@/lib/actions/products"
import { ProductsSearch } from "./_components/products-search"
import { ProductsTable } from "./_components/products-table"
import { ProductsPagination } from "./_components/products-pagination"

type SearchParams = Promise<{
  q?: string
  brandId?: string
  categoryId?: string
  status?: string
  season?: string
  page?: string
}>

const PRODUCT_STATUS_VALUES = Object.values(ProductStatus) as ProductStatus[]

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const companyId = session.user.companyId
  if (!companyId) redirect("/login")

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { tenantType: true },
  })
  const isMasterAdmin = company?.tenantType === "MASTER_ADMIN"

  const sp = await searchParams

  const params: ListProductsParams = {}
  if (sp.q && sp.q.trim() !== "") params.q = sp.q
  if (sp.brandId) params.brandId = sp.brandId
  if (sp.categoryId) params.categoryId = sp.categoryId
  if (sp.status && PRODUCT_STATUS_VALUES.includes(sp.status as ProductStatus)) {
    params.status = sp.status as ProductStatus
  }
  if (sp.season && sp.season.trim() !== "") params.season = sp.season
  if (sp.page) {
    const p = Number(sp.page)
    if (Number.isFinite(p) && p >= 1) params.page = p
  }

  const [{ products, total, page, totalPages }, brands, categories] =
    await Promise.all([
      listProducts(params),
      listActiveBrandsForProductSelect(),
      listActiveProductCategoriesForProductSelect(),
    ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">品番カルテ</h1>
          <p className="text-sm text-muted-foreground">
            案件の器となる品番。ブランド・カテゴリ・シーズンから社内品番を自動採番します。
          </p>
        </div>
        <Button asChild>
          <Link href="/products/new">
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Link>
        </Button>
      </div>

      <ProductsSearch brands={brands} categories={categories} />

      <ProductsTable items={products} isMasterAdmin={isMasterAdmin} />

      <ProductsPagination page={page} totalPages={totalPages} total={total} />
    </div>
  )
}
