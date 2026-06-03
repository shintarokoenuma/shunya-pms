import Link from "next/link"
import { redirect } from "next/navigation"
import { Info, Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import {
  listModelCodes,
  listActiveBrandsForModelCodeSelect,
} from "@/lib/actions/model-codes"
import { ModelCodesSearch } from "./_components/model-codes-search"
import { ModelCodesTable } from "./_components/model-codes-table"
import { ModelCodesPagination } from "./_components/model-codes-pagination"
import type { ModelCodeStatus } from "@prisma/client"

type SearchParams = Promise<{
  q?: string
  status?: string
  brandId?: string
  categoryId?: string
  page?: string
}>

export default async function ModelCodesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const companyId = session.user.companyId
  if (!companyId) redirect("/login")

  const sp = await searchParams
  const page = sp.page ? Number(sp.page) : 1

  const [result, brands, company] = await Promise.all([
    listModelCodes({
      q: sp.q,
      status: sp.status as ModelCodeStatus | undefined,
      brandId: sp.brandId,
      categoryId: sp.categoryId,
      page,
      pageSize: 20,
    }),
    listActiveBrandsForModelCodeSelect(),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { tenantType: true },
    }),
  ])
  const isMasterAdmin = company?.tenantType === "MASTER_ADMIN"

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
          <h1 className="text-2xl font-semibold tracking-tight">型番</h1>
          <p className="text-sm text-muted-foreground">
            商品の「型」を表す不変 ID。Brand 配下で自動採番（M-{`{ブランド略号}`}
            -{`{連番}`}）。
          </p>
        </div>
        {/* S-1: 一般導線の「新規作成」は非表示。MASTER_ADMIN のみ移行期の保険として残す */}
        {isMasterAdmin && (
          <Button asChild variant="outline">
            <Link href="/model-codes/new">
              <Plus className="mr-1 h-4 w-4" />
              新規作成（管理者）
            </Link>
          </Button>
        )}
      </div>

      {/* S-1: ModelCode は今後 Product 作成（モードB）から発番される運用への移行案内 */}
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            モデルコードは、品番カルテ（
            <Link href="/products/new" className="underline font-medium">
              /products/new
            </Link>
            ）の「新規モデルコードを発番する」モードから自動採番されます。
            通常の運用では本ページからの手動発番は不要です。
          </div>
        </div>
      </div>

      <ModelCodesSearch brands={brands} />
      <ModelCodesTable items={items} />
      <ModelCodesPagination
        page={currentPage}
        totalPages={totalPages}
        total={total}
      />
    </div>
  )
}
