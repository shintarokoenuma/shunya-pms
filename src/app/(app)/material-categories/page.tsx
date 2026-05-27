import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import {
  listMaterialCategories,
  type ListMaterialCategoriesParams,
} from "@/lib/actions/material-categories"
import { MaterialCategoriesSearch } from "./_components/material-categories-search"
import { MaterialCategoriesTable } from "./_components/material-categories-table"
import { MaterialCategoriesPagination } from "./_components/material-categories-pagination"
import type { MaterialCategoryStatus } from "@prisma/client"

type SearchParams = Promise<{
  q?: string
  status?: string
  level?: string
  page?: string
}>

export default async function MaterialCategoriesPage({
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

  const params: ListMaterialCategoriesParams = {}
  if (sp.q && sp.q.trim() !== "") params.q = sp.q
  if (sp.status) params.status = sp.status as MaterialCategoryStatus
  if (sp.level) {
    const lv = Number(sp.level)
    if (lv === 1 || lv === 2 || lv === 3) params.level = lv
  }
  if (sp.page) {
    const p = Number(sp.page)
    if (Number.isFinite(p) && p >= 1) params.page = p
  }

  const { categories, total, page, totalPages } =
    await listMaterialCategories(params)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">素材カテゴリ</h1>
          <p className="text-sm text-muted-foreground">
            素材マスターの分類軸。大分類 → 中分類 → 小分類の 3 階層で管理。
            素材コード命名のサジェスト辞書付き。
          </p>
        </div>
        <Button asChild>
          <Link href="/material-categories/new">
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Link>
        </Button>
      </div>

      <MaterialCategoriesSearch />

      <MaterialCategoriesTable
        items={categories}
        isMasterAdmin={isMasterAdmin}
      />

      <MaterialCategoriesPagination
        page={page}
        totalPages={totalPages}
        total={total}
      />
    </div>
  )
}
