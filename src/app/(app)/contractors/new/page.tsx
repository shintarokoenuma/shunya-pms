import Link from "next/link"
import { ContractorForm } from "../_components/contractor-form"
import { listAssignableUsers } from "@/lib/actions/clients"

export const dynamic = "force-dynamic"

export default async function NewContractorPage() {
  const assignableUsers = await listAssignableUsers()
  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link
          href="/contractors"
          className="text-muted-foreground hover:text-foreground"
        >
          &lt; 外注先一覧へ
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">外注先の新規登録</h1>
        <p className="text-sm text-muted-foreground mt-1">
          パタンナー・グレーダー・デザイナー等の専門業者を登録します。
          個人事業主・法人どちらにも対応しています。
        </p>
      </div>
      <ContractorForm mode="create" assignableUsers={assignableUsers} />
    </div>
  )
}
