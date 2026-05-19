import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { listBrands, listClientsForBrand } from "@/lib/actions/brands"
import { auth } from "@/lib/auth"
import { BrandsTable } from "./_components/brands-table"
import { BrandsSearch } from "./_components/brands-search"
import { BrandsPagination } from "./_components/brands-pagination"
import { BrandStatus } from "@prisma/client"

export const dynamic = "force-dynamic"

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    clientId?: string
    page?: string
  }>
}) {
  const sp = await searchParams
  const session = await auth()
  const isMasterAdmin = session?.user?.tenantType === "MASTER_ADMIN"
  const [result, clientOptions] = await Promise.all([
    listBrands({
      q: sp.q,
      status: sp.status as BrandStatus | undefined,
      clientId: sp.clientId,
      page: sp.page ? Number(sp.page) : 1,
    }),
    listClientsForBrand(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ブランド</h1>
          <p className="text-sm text-muted-foreground mt-1">
            クライアントが所有するブランドを管理します。ブランドコードは品番略号として使われます。
          </p>
        </div>
        <Button asChild>
          <Link href="/brands/new">
            <Plus className="mr-1 h-4 w-4" />
            新規ブランド
          </Link>
        </Button>
      </div>

      <BrandsSearch clientOptions={clientOptions} />

      <BrandsTable items={result.items} isMasterAdmin={isMasterAdmin} />

      <BrandsPagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
      />
    </div>
  )
}
