import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { listWorkOrders } from "@/lib/actions/work-orders"
import { WorkOrdersTable } from "./_components/work-orders-table"
import { WorkOrdersPagination } from "./_components/work-orders-pagination"
import type { WorkOrderStatus } from "@prisma/client"

type SearchParams = Promise<{
  q?: string
  status?: string
  page?: string
}>

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const page = sp.page ? Number(sp.page) : 1

  const result = await listWorkOrders({
    q: sp.q ?? "",
    status: sp.status as WorkOrderStatus | undefined,
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          発注（作業 WO）
        </h1>
        <p className="text-sm text-muted-foreground">
          工場・外注先への作業発注。サンプル製作の進行チェックリスト（パターン/縫製/加工/グレーディング）から起票します。
        </p>
      </div>
      <WorkOrdersTable items={items} />
      <WorkOrdersPagination
        page={currentPage}
        totalPages={totalPages}
        total={total}
      />
    </div>
  )
}
