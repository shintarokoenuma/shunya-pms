import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  listModelCodes,
  listActiveBrandsForModelCodeSelect,
} from "@/lib/actions/model-codes"
import { ModelCodesSearch } from "./_components/model-codes-search"
import { ModelCodesTable } from "./_components/model-codes-table"
import { ModelCodesPagination } from "./_components/model-codes-pagination"
import type { ModelCodeStatus } from "@prisma/client"

type SearchParams = Promise<{
  q?: string
  status?: string
  brandId?: string
  categoryId?: string
  page?: string
}>

export default async function ModelCodesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const page = sp.page ? Number(sp.page) : 1

  const [result, brands] = await Promise.all([
    listModelCodes({
      q: sp.q,
      status: sp.status as ModelCodeStatus | undefined,
      brandId: sp.brandId,
      categoryId: sp.categoryId,
      page,
      pageSize: 20,
    }),
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
          <h1 className="text-2xl font-semibold tracking-tight">型番</h1>
          <p className="text-sm text-muted-foreground">
            商品の「型」を表す不変 ID。Brand 配下で自動採番（M-{`{ブランド略号}`}
            -{`{連番}`}）。
          </p>
        </div>
        <Button asChild>
          <Link href="/model-codes/new">
            <Plus className="mr-1 h-4 w-4" />
            新規作成
          </Link>
        </Button>
      </div>

      <ModelCodesSearch brands={brands} />
      <ModelCodesTable items={items} />
      <ModelCodesPagination
        page={currentPage}
        totalPages={totalPages}
        total={total}
      />
    </div>
  )
}
