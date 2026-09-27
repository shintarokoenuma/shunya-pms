import { listCompanyUsers } from "@/lib/actions/users"
import { requireSettingsSection } from "../_lib/access"
import { UsersTable } from "../_components/users-table"

type SearchParams = Promise<{ archived?: string }>

/**
 * B-205 PR-2（§4-6・P2-D10）: /settings/users ユーザー。アーカイブは ?archived=1 のときだけ出す。
 * 隠された役割は見える最初の項目へ。読み取り action 側でも拒否する
 */
export default async function SettingsUsersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSettingsSection("users")
  const sp = await searchParams
  const showArchived = sp.archived === "1"
  const r = await listCompanyUsers({ includeArchived: showArchived })
  if (!r.ok) {
    return <p className="text-sm text-destructive">{r.error}</p>
  }
  return (
    <UsersTable users={r.data.users} canManage={r.data.canManage} actorRole={r.data.actorRole} showArchived={showArchived} />
  )
}
