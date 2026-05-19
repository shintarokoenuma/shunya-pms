import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { listSuppliers } from "@/lib/actions/suppliers"
import { auth } from "@/lib/auth"
import { SuppliersTable } from "./_components/suppliers-table"
import { SuppliersSearch } from "./_components/suppliers-search"
import { SuppliersPagination } from "./_components/suppliers-pagination"
import { SupplierStatus, SupplierType } from "@prisma/client"

export const dynamic = "force-dynamic"

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    supplierType?: string
    page?: string
  }>
}) {
  const sp = await searchParams
  const session = await auth()
  const isMasterAdmin = session?.user?.tenantType === "MASTER_ADMIN"

  const result = await listSuppliers({
    q: sp.q,
    status: sp.status as SupplierStatus | undefined,
    supplierType: sp.supplierType as SupplierType | undefined,
    page: sp.page ? Number(sp.page) : 1,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">仕入先</h1>
          <p className="text-sm text-muted-foreground mt-1">
            生地・付属・糸などの仕入先を管理します。
          </p>
        </div>
        <Button asChild>
          <Link href="/suppliers/new">
            <Plus className="mr-1 h-4 w-4" />
            新規仕入先
          </Link>
        </Button>
      </div>

      <SuppliersSearch />

      <SuppliersTable items={result.suppliers} isMasterAdmin={isMasterAdmin} />

      <SuppliersPagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
      />
    </div>
  )
}
