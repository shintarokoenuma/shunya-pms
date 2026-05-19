import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { listClients } from "@/lib/actions/clients"
import { ClientsTable } from "./_components/clients-table"
import { auth } from "@/lib/auth"
import { ClientsSearch } from "./_components/clients-search"
import { ClientsPagination } from "./_components/clients-pagination"

type SearchParams = Promise<{
  q?: string
  status?: string
  businessType?: string
  country?: string
  page?: string
  perPage?: string
  sort?: string
  order?: string
}>

export default async function ClientsListPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const session = await auth()
  const isMasterAdmin = session?.user?.tenantType === "MASTER_ADMIN"

  const result = await listClients({
    q: sp.q,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: sp.status as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    businessType: sp.businessType as any,
    country: sp.country,
    page: sp.page ? Number(sp.page) : undefined,
    perPage: sp.perPage ? Number(sp.perPage) : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sort: sp.sort as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    order: sp.order as any,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">クライアント</h1>
          <p className="text-sm text-muted-foreground mt-1">
            OEM 発注元のマスター管理
          </p>
        </div>
        <Button asChild>
          <Link href="/clients/new">
            <Plus className="size-4" />
            新規作成
          </Link>
        </Button>
      </div>

      <ClientsSearch />

      <ClientsTable items={result.items} isMasterAdmin={isMasterAdmin} />

      <ClientsPagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
      />
    </div>
  )
}
