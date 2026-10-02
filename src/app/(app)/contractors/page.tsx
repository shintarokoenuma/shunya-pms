import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { listContractors } from "@/lib/actions/contractors"
import { auth } from "@/lib/auth"
import { ContractorsTable } from "./_components/contractors-table"
import { contractorMissingFields } from "@/lib/master-completeness"
import { ContractorsSearch } from "./_components/contractors-search"
import { ContractorsPagination } from "./_components/contractors-pagination"
import {
  ContractorStatus,
  ContractorSpecialty,
  ContractorContractType,
} from "@prisma/client"

export const dynamic = "force-dynamic"

export default async function ContractorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    specialty?: string
    contractType?: string
    isIndividual?: string
    page?: string
  }>
}) {
  const sp = await searchParams
  const session = await auth()
  const isMasterAdmin = session?.user?.tenantType === "MASTER_ADMIN"

  // isIndividual パラメータは "true" / "false" の文字列でやってくるので boolean に変換
  let isIndividualFilter: boolean | undefined
  if (sp.isIndividual === "true") isIndividualFilter = true
  else if (sp.isIndividual === "false") isIndividualFilter = false

  const result = await listContractors({
    q: sp.q,
    status: sp.status as ContractorStatus | undefined,
    specialty: sp.specialty as ContractorSpecialty | undefined,
    contractType: sp.contractType as ContractorContractType | undefined,
    isIndividual: isIndividualFilter,
    page: sp.page ? Number(sp.page) : 1,
  })
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">外注先</h1>
          <p className="text-sm text-muted-foreground mt-1">
            パタンナー・グレーダー・デザイナー等の専門業者を管理します。
          </p>
        </div>
        <Button asChild>
          <Link href="/contractors/new">
            <Plus className="mr-1 h-4 w-4" />
            新規外注先
          </Link>
        </Button>
      </div>
      <ContractorsSearch />
      {/* B-252（D-7）: 未入力の項目数を一覧に出す */}
      <ContractorsTable
        items={result.contractors.map((c) => ({ ...c, missingFields: contractorMissingFields({ ...c, hasPrimaryContact: c.contacts.length > 0 }) }))}
        isMasterAdmin={isMasterAdmin}
      />
      <ContractorsPagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
      />
    </div>
  )
}
