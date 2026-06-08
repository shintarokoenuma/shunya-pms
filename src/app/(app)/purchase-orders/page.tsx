import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import {
  listPurchaseOrders,
  listActiveSuppliersForPoSelect,
} from "@/lib/actions/purchase-orders"
import { PurchaseOrdersSearch } from "./_components/purchase-orders-search"
import { PurchaseOrdersTable } from "./_components/purchase-orders-table"
import { PurchaseOrdersPagination } from "./_components/purchase-orders-pagination"
import type { PurchaseOrderStatus } from "@prisma/client"

type SearchParams = Promise<{
  q?: string
  status?: string
  supplierId?: string
  page?: string
}>

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const page = sp.page ? Number(sp.page) : 1

  const [result, suppliers] = await Promise.all([
    listPurchaseOrders({
      q: sp.q ?? "",
      status: sp.status as PurchaseOrderStatus | undefined,
      supplierId: sp.supplierId,
      page,
      pageSize: 20,
    }),
    listActiveSuppliersForPoSelect(),
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">発注（仕入先 PO）</h1>
        <p className="text-sm text-muted-foreground">
          仕入先への発注。サンプル製作の進行チェックリスト（生地/付属/ボディ）から起票します。
        </p>
      </div>
      <PurchaseOrdersSearch suppliers={suppliers} />
      <PurchaseOrdersTable items={items} />
      <PurchaseOrdersPagination page={currentPage} totalPages={totalPages} total={total} />
    </div>
  )
}
