import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import {
  listSampleProductions,
  type ListSampleProductionsParams,
} from "@/lib/actions/sample-productions"
import { SampleProductionsSearch } from "./_components/sample-productions-search"
import { SampleProductionsTable } from "./_components/sample-productions-table"
import { SampleProductionsPagination } from "./_components/sample-productions-pagination"
import type { SampleProductionStatus, SampleRound } from "@prisma/client"

type SearchParams = Promise<{
  q?: string
  status?: string
  round?: string
  page?: string
}>

export default async function SamplesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const page = sp.page ? Number(sp.page) : 1

  const params: ListSampleProductionsParams = {
    q: sp.q,
    status: sp.status as SampleProductionStatus | undefined,
    sampleRound: sp.round as SampleRound | undefined,
    page,
    pageSize: 20,
  }

  const result = await listSampleProductions(params)
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">サンプル製作</h1>
        <p className="text-sm text-muted-foreground">
          品番カルテ配下のサンプル製作セット（SP）。新規作成は品番カルテ詳細の
          「サンプル作成」から行います。
        </p>
      </div>

      <SampleProductionsSearch />
      <SampleProductionsTable items={items} />
      <SampleProductionsPagination
        page={currentPage}
        totalPages={totalPages}
        total={total}
      />
    </div>
  )
}
