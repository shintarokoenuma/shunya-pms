import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  listProcessingTypes,
  type ListProcessingTypesParams,
} from "@/lib/actions/processing-types"
import { ProcessingTypesSearch } from "./_components/processing-types-search"
import { ProcessingTypesTable } from "./_components/processing-types-table"
import { ProcessingTypesPagination } from "./_components/processing-types-pagination"
import type { ProcessingTypeStatus, WorkOrderType } from "@prisma/client"

type SearchParams = Promise<{
  q?: string
  status?: string
  workType?: string
  page?: string
}>

export default async function ProcessingTypesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const page = sp.page ? Number(sp.page) : 1

  const params: ListProcessingTypesParams = {
    q: sp.q,
    status: sp.status as ProcessingTypeStatus | undefined,
    workType: sp.workType as WorkOrderType | undefined,
    page,
    pageSize: 20,
  }

  const result = await listProcessingTypes(params)
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
          <h1 className="text-2xl font-semibold tracking-tight">加工種別</h1>
          <p className="text-sm text-muted-foreground">
            洗い・プリント・刺繍・染め 等の加工工程の種別マスター。コードは
            PRC-NNN で自動採番されます。
          </p>
        </div>
        <Button asChild>
          <Link href="/processing-types/new">
            <Plus className="mr-1 h-4 w-4" />
            新規作成
          </Link>
        </Button>
      </div>

      <ProcessingTypesSearch />
      <ProcessingTypesTable items={items} />
      <ProcessingTypesPagination
        page={currentPage}
        totalPages={totalPages}
        total={total}
      />
    </div>
  )
}
