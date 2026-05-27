import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  listDeliveryDestinations,
  listActiveBuyersForDestinationSelect,
  listActiveClientsForDestinationFilter,
} from "@/lib/actions/delivery-destinations"
import { DeliveryDestinationsSearch } from "./_components/delivery-destinations-search"
import { DeliveryDestinationsTable } from "./_components/delivery-destinations-table"
import { DeliveryDestinationsPagination } from "./_components/delivery-destinations-pagination"
import type { DeliveryDestinationStatus } from "@prisma/client"

type SearchParams = Promise<{
  q?: string
  status?: string
  buyerId?: string
  clientId?: string
  page?: string
}>

export default async function DeliveryDestinationsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const page = sp.page ? Number(sp.page) : 1

  const [result, buyers, clients] = await Promise.all([
    listDeliveryDestinations({
      q: sp.q,
      status: sp.status as DeliveryDestinationStatus | undefined,
      buyerId: sp.buyerId,
      clientId: sp.clientId,
      page,
      pageSize: 20,
    }),
    listActiveBuyersForDestinationSelect(),
    listActiveClientsForDestinationFilter(),
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
          <h1 className="text-2xl font-semibold tracking-tight">納品先</h1>
          <p className="text-sm text-muted-foreground">
            バイヤー配下の物理拠点（店舗・倉庫・物流センター等）
          </p>
        </div>
        <Button asChild>
          <Link href="/delivery-destinations/new">
            <Plus className="mr-1 h-4 w-4" />
            新規作成
          </Link>
        </Button>
      </div>

      <DeliveryDestinationsSearch clients={clients} buyers={buyers} />
      <DeliveryDestinationsTable items={items} />
      <DeliveryDestinationsPagination
        page={currentPage}
        totalPages={totalPages}
        total={total}
      />
    </div>
  )
}
