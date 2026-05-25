import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  listBuyers,
  listActiveClientsForBuyerSelect,
} from "@/lib/actions/buyers"
import { BuyersSearch } from "./_components/buyers-search"
import { BuyersTable } from "./_components/buyers-table"
import { BuyersPagination } from "./_components/buyers-pagination"
import type { BuyerStatus } from "@prisma/client"

type SearchParams = Promise<{
  q?: string
  status?: string
  clientId?: string
  page?: string
}>

export default async function BuyersPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const page = sp.page ? Number(sp.page) : 1

  const [result, clients] = await Promise.all([
    listBuyers({
      q: sp.q,
      status: sp.status as BuyerStatus | undefined,
      clientId: sp.clientId,
      page,
      pageSize: 20,
    }),
    listActiveClientsForBuyerSelect(),
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
          <h1 className="text-2xl font-semibold tracking-tight">バイヤー</h1>
          <p className="text-sm text-muted-foreground">
            ブランド OEM の卸先・直接 OEM の事業部単位として登録される購買主体
          </p>
        </div>
        <Button asChild>
          <Link href="/buyers/new">
            <Plus className="mr-1 h-4 w-4" />
            新規作成
          </Link>
        </Button>
      </div>

      <BuyersSearch clients={clients} />
      <BuyersTable items={items} />
      <BuyersPagination
        page={currentPage}
        totalPages={totalPages}
        total={total}
      />
    </div>
  )
}
