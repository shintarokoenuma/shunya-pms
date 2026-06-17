import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import {
  listTextilePatterns,
  type ListTextilePatternsParams,
} from "@/lib/actions/textile-patterns"
import type { TextilePatternStatusValue } from "@/lib/types/textile-pattern"
import { TextilePatternsSearch } from "./_components/textile-patterns-search"
import { TextilePatternsTable } from "./_components/textile-patterns-table"
import { TextilePatternsPagination } from "./_components/textile-patterns-pagination"

type SearchParams = Promise<{
  q?: string
  status?: string
  page?: string
}>

export default async function TextilePatternsPage({
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

  const params: ListTextilePatternsParams = {}
  if (sp.q && sp.q.trim() !== "") params.q = sp.q
  if (sp.status === "ACTIVE" || sp.status === "ARCHIVED") {
    params.status = sp.status as TextilePatternStatusValue
  }
  if (sp.page) {
    const p = Number(sp.page)
    if (Number.isFinite(p) && p >= 1) params.page = p
  }

  const { patterns, total, page, totalPages } = await listTextilePatterns(params)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">柄マスター</h1>
          <p className="text-sm text-muted-foreground">
            自社の柄共通言語（D#）。種別（柄種別マスター）に紐づく具体的な1柄を管理。
            構成色・ピッチは持ちません（色は発注書側）。
          </p>
        </div>
        <Button asChild>
          <Link href="/textile-patterns/new">
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Link>
        </Button>
      </div>

      <TextilePatternsSearch />

      <TextilePatternsTable items={patterns} isMasterAdmin={isMasterAdmin} />

      <TextilePatternsPagination page={page} totalPages={totalPages} total={total} />
    </div>
  )
}
