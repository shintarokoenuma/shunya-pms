import Link from "next/link"
import { SupplierForm } from "../_components/supplier-form"
import { listAssignableUsers } from "@/lib/actions/clients"

export const dynamic = "force-dynamic"

export default async function NewSupplierPage() {
  const assignableUsers = await listAssignableUsers()

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link
          href="/suppliers"
          className="text-muted-foreground hover:text-foreground"
        >
          &lt; 仕入先一覧へ
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">仕入先の新規登録</h1>
        <p className="text-sm text-muted-foreground mt-1">
          生地・付属・糸などの仕入先を登録します。海外仕入先にも対応しています。
        </p>
      </div>

      <SupplierForm mode="create" assignableUsers={assignableUsers} />
    </div>
  )
}
