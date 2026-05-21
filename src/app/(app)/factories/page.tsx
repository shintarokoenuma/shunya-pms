import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { listFactories } from "@/lib/actions/factories"
import { auth } from "@/lib/auth"
import { FactoriesTable } from "./_components/factories-table"
import { FactoriesSearch } from "./_components/factories-search"
import { FactoriesPagination } from "./_components/factories-pagination"
import { FactoryStatus, FactoryType } from "@prisma/client"

export const dynamic = "force-dynamic"

export default async function FactoriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    factoryType?: string
    page?: string
  }>
}) {
  const sp = await searchParams
  const session = await auth()
  const isMasterAdmin = session?.user?.tenantType === "MASTER_ADMIN"
  const result = await listFactories({
    q: sp.q,
    status: sp.status as FactoryStatus | undefined,
    factoryType: sp.factoryType as FactoryType | undefined,
    page: sp.page ? Number(sp.page) : 1,
  })
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">工場</h1>
          <p className="text-sm text-muted-foreground mt-1">
            縫製・ニット・加工等の工場を管理します。
          </p>
        </div>
        <Button asChild>
          <Link href="/factories/new">
            <Plus className="mr-1 h-4 w-4" />
            新規工場
          </Link>
        </Button>
      </div>
      <FactoriesSearch />
      <FactoriesTable items={result.factories} isMasterAdmin={isMasterAdmin} />
      <FactoriesPagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
      />
    </div>
  )
}
