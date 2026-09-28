import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getRolePermissions } from "@/lib/settings-visibility-db"
import {
  canSeeSettingsSection,
  firstVisibleSettingsPath,
  visibleSettingsSections,
  type RolePermissions,
  type SettingsSection,
} from "@/lib/settings-visibility"

/**
 * B-205 PR-2（P2-D8）: 設定ページの server component で使う、見える項目の解決と「隠す」の効かせ方。
 * - 未ログインは /login、EXTERNAL は /dashboard
 * - 隠された項目の URL を開いたら、見える最初の項目へ redirect（見える項目が無ければ「役割と権限」）
 */
export type SettingsAccess = {
  role: string
  companyId: string
  perms: RolePermissions
  visible: SettingsSection[]
  firstPath: string
}

export async function getSettingsAccess(): Promise<SettingsAccess> {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role === "EXTERNAL") redirect("/dashboard")
  const perms = await getRolePermissions(session.user.companyId)
  return {
    role: session.user.role,
    companyId: session.user.companyId,
    perms,
    visible: visibleSettingsSections(perms, session.user.role),
    firstPath: firstVisibleSettingsPath(perms, session.user.role),
  }
}

export async function requireSettingsSection(section: SettingsSection): Promise<SettingsAccess> {
  const access = await getSettingsAccess()
  if (!canSeeSettingsSection(access.perms, access.role, section)) redirect(access.firstPath)
  return access
}
