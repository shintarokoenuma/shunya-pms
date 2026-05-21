import Link from "next/link"
import { FactoryForm } from "../_components/factory-form"
import { listAssignableUsers } from "@/lib/actions/clients"

export const dynamic = "force-dynamic"

export default async function NewFactoryPage() {
  const assignableUsers = await listAssignableUsers()
  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link
          href="/factories"
          className="text-muted-foreground hover:text-foreground"
        >
          &lt; 工場一覧へ
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">工場の新規登録</h1>
        <p className="text-sm text-muted-foreground mt-1">
          縫製・ニット・加工等の工場を登録します。海外工場にも対応しています。
        </p>
      </div>
      <FactoryForm mode="create" assignableUsers={assignableUsers} />
    </div>
  )
}
