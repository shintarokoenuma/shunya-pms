import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import {
  listTextilePatternTypes,
  type ListTextilePatternTypesParams,
} from "@/lib/actions/textile-pattern-types"
import type { TextilePatternTypeStatusValue } from "@/lib/validators/textile-pattern-type"
import { TextilePatternTypesSearch } from "./_components/textile-pattern-types-search"
import { TextilePatternTypesTable } from "./_components/textile-pattern-types-table"
import { TextilePatternTypesPagination } from "./_components/textile-pattern-types-pagination"

type SearchParams = Promise<{
  q?: string
  status?: string
  page?: string
}>

export default async function TextilePatternTypesPage({
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

  const params: ListTextilePatternTypesParams = {}
  if (sp.q && sp.q.trim() !== "") params.q = sp.q
  if (sp.status === "ACTIVE" || sp.status === "ARCHIVED") {
    params.status = sp.status as TextilePatternTypeStatusValue
  }
  if (sp.page) {
    const p = Number(sp.page)
    if (Number.isFinite(p) && p >= 1) params.page = p
  }

  const { patternTypes, total, page, totalPages } =
    await listTextilePatternTypes(params)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">柄種別</h1>
          <p className="text-sm text-muted-foreground">
            柄の分類共通言語。無地・ボーダー・ストライプ等の種別を管理。
            個別柄（構成色・ピッチ等）は持ちません。
          </p>
        </div>
        <Button asChild>
          <Link href="/textile-pattern-types/new">
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Link>
        </Button>
      </div>

      <TextilePatternTypesSearch />

      <TextilePatternTypesTable
        items={patternTypes}
        isMasterAdmin={isMasterAdmin}
      />

      <TextilePatternTypesPagination
        page={page}
        totalPages={totalPages}
        total={total}
      />
    </div>
  )
}
