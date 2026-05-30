import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { listCostCategories } from "@/lib/actions/cost-categories"
import { CostCategoriesSearch } from "./_components/cost-categories-search"
import { CostCategoriesTable } from "./_components/cost-categories-table"
import { CostCategoriesPagination } from "./_components/cost-categories-pagination"
import type {
  CostCategoryStatus,
  ExternalCostCategory,
} from "@prisma/client"

type SearchParams = Promise<{
  q?: string
  status?: string
  externalCategory?: string
  page?: string
}>

export default async function CostCategoriesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const page = sp.page ? Number(sp.page) : 1

  const result = await listCostCategories({
    q: sp.q,
    status: sp.status as CostCategoryStatus | undefined,
    externalCategory: sp.externalCategory as ExternalCostCategory | undefined,
    page,
    pageSize: 20,
  })

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
          <h1 className="text-2xl font-semibold tracking-tight">
            原価費目
          </h1>
          <p className="text-sm text-muted-foreground">
            材料費・縫製費・加工費・諸経費の階層マスター（Lv1 予約 4 / Lv2 葉ノード）
          </p>
        </div>
        <Button asChild>
          <Link href="/cost-categories/new">
            <Plus className="mr-1 h-4 w-4" />
            新規作成 (Lv2)
          </Link>
        </Button>
      </div>

      <CostCategoriesSearch />
      <CostCategoriesTable items={items} />
      <CostCategoriesPagination
        page={currentPage}
        totalPages={totalPages}
        total={total}
      />
    </div>
  )
}
