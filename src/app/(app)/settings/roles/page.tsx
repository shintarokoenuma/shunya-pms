import { getRolePermissionsView } from "@/lib/actions/role-permissions"
import { getSettingsAccess } from "../_lib/access"
import { RolePermissionsForm } from "../_components/role-permissions-form"

/** B-205 PR-2（§4-4・P2-D9）: /settings/roles 役割と権限。誰にでも見える（変更は OWNER / ADMIN） */
export default async function SettingsRolesPage() {
  await getSettingsAccess()
  const r = await getRolePermissionsView()
  if (!r.ok) {
    return <p className="text-sm text-destructive">{r.error}</p>
  }
  return <RolePermissionsForm perms={r.data.perms} canManage={r.data.canManage} />
}
