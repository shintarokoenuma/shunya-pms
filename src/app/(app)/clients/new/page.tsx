import Link from "next/link"
import { ClientForm } from "../_components/client-form"
import { listAssignableUsers } from "@/lib/actions/clients"

export const dynamic = "force-dynamic"

export default async function NewClientPage() {
  const assignableUsers = await listAssignableUsers()

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link href="/clients" className="text-muted-foreground hover:text-foreground">
          &lt; クライアント一覧へ
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">クライアント新規登録</h1>
        <p className="text-sm text-muted-foreground mt-1">
          新規取引先の情報を登録します。先方主担当者の連絡先も同時に登録できます。
        </p>
      </div>

      <ClientForm mode="create" assignableUsers={assignableUsers} />
    </div>
  )
}
