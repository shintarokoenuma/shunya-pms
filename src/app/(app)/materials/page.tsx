import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { canSeeAreaForSession } from "@/lib/area-access"
import { Button } from "@/components/ui/button"
import {
  listMaterials,
  listActiveSuppliersForMaterialSelect,
} from "@/lib/actions/materials"
import { MaterialsSearch } from "./_components/materials-search"
import { MaterialsTable } from "./_components/materials-table"
import { MaterialsPagination } from "./_components/materials-pagination"
import type { MaterialStatus, MaterialType } from "@prisma/client"

type SearchParams = Promise<{
  q?: string
  status?: string
  materialType?: string
  primarySupplierId?: string
  page?: string
}>

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const page = sp.page ? Number(sp.page) : 1

  // B-243 PR-4（D4-3）: マスターの取引条件・編集が見えない役割には「新規」と「単価」の列を出さない（単価は action も null で返す）
  const [result, suppliers, canEditMaster] = await Promise.all([
    listMaterials({
      q: sp.q,
      status: sp.status as MaterialStatus | undefined,
      materialType: sp.materialType as MaterialType | undefined,
      primarySupplierId: sp.primarySupplierId,
      page,
      pageSize: 20,
    }),
    listActiveSuppliersForMaterialSelect(),
    canSeeAreaForSession("masterTerms"),
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
          <h1 className="text-2xl font-semibold tracking-tight">素材</h1>
          <p className="text-sm text-muted-foreground">
            生地・副資材マスター（Phase 1A-13a：基本コア）
          </p>
        </div>
        {canEditMaster && (
          <Button asChild>
            <Link href="/materials/new">
              <Plus className="mr-1 h-4 w-4" />
              新規作成
            </Link>
          </Button>
        )}
      </div>

      <MaterialsSearch suppliers={suppliers} />
      <MaterialsTable items={items} showPrice={canEditMaster} />
      <MaterialsPagination
        page={currentPage}
        totalPages={totalPages}
        total={total}
      />
    </div>
  )
}
