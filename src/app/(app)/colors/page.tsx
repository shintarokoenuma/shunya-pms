import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { listColors, type ListColorsParams } from "@/lib/actions/colors"
import type { ColorStatusValue } from "@/lib/validators/color"
import { ColorsSearch } from "./_components/colors-search"
import { ColorsTable } from "./_components/colors-table"
import { ColorsPagination } from "./_components/colors-pagination"

type SearchParams = Promise<{
  q?: string
  status?: string
  hueGroup?: string
  page?: string
}>

export default async function ColorsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const companyId = session.user.companyId
  if (!companyId) redirect("/login")

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { tenantType: true },
  })
  const isMasterAdmin = company?.tenantType === "MASTER_ADMIN"

  const sp = await searchParams

  const params: ListColorsParams = {}
  if (sp.q && sp.q.trim() !== "") params.q = sp.q
  if (sp.status === "ACTIVE" || sp.status === "ARCHIVED") {
    params.status = sp.status as ColorStatusValue
  }
  if (sp.hueGroup) {
    const hg = Number(sp.hueGroup)
    if (Number.isInteger(hg) && hg >= 0 && hg <= 9) params.hueGroup = hg
  }
  if (sp.page) {
    const p = Number(sp.page)
    if (Number.isFinite(p) && p >= 1) params.page = p
  }

  const { colors, total, page, totalPages } = await listColors(params)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">カラー</h1>
          <p className="text-sm text-muted-foreground">
            自社カラーマスター。番号 2 桁体系（十の位=色相 / 一の位=トーン）。
            「00」はマルチ／プリント等の単色指定なしを表します。
          </p>
        </div>
        <Button asChild>
          <Link href="/colors/new">
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Link>
        </Button>
      </div>

      <ColorsSearch />

      <ColorsTable items={colors} isMasterAdmin={isMasterAdmin} />

      <ColorsPagination page={page} totalPages={totalPages} total={total} />
    </div>
  )
}
