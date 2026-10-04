import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { listClients } from "@/lib/actions/clients"
import { ClientsTable } from "./_components/clients-table"
import { clientMissingFields } from "@/lib/master-completeness"
import { auth } from "@/lib/auth"
import { canSeeAreaForSession } from "@/lib/area-access"
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
  // B-243 PR-4（D4-3）: マスターの取引条件・編集が見えない役割には「新規」と行の「編集」を出さない
  const canEditMaster = await canSeeAreaForSession("masterTerms")

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
        {canEditMaster && (
          <Button asChild>
            <Link href="/clients/new">
              <Plus className="size-4" />
              新規作成
            </Link>
          </Button>
        )}
      </div>

      <ClientsSearch />

      {/* B-252（D-7）: 未入力の項目数を一覧に出す。B-243 PR-4: 編集できない人には数も計算しない（編集を促さない・取引条件の未入力が漏れない） */}
      <ClientsTable
        items={result.items.map((c) => ({ ...c, missingFields: canEditMaster ? clientMissingFields({ ...c, hasPrimaryContact: c.contacts.length > 0 }) : undefined }))}
        isMasterAdmin={isMasterAdmin}
        canEdit={canEditMaster}
      />

      <ClientsPagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
      />
    </div>
  )
}
