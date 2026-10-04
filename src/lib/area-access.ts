import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getRolePermissions } from "@/lib/settings-visibility-db"
import { AREA_DENIED_MESSAGES, canSeeArea, type AreaKey, type RolePermissions } from "@/lib/settings-visibility"

/**
 * B-243 PR-1（§2-2・C-D3〜C-D5）: 画面の領域（areas）の判定。server 専用（auth と prisma を使う）。
 * - checkArea: Server Action の先頭で使う。見えなければ { ok: false, error }（文言は AREA_DENIED_MESSAGES）
 * - requireAreaPage: ページ・layout で使う。未ログインは /login、見えなければ /dashboard へ redirect（設定の P2-D8 と同じく無言）
 * - canSeeAreaForSession: ページで「見えるか」を boolean で取る（未ログインは false）
 * 純関数は settings-visibility.ts（canSeeArea）。既定値（一般スタッフは発注が見えない）はそちらで解く
 */
export type AreaAccess = { role: string; companyId: string; perms: RolePermissions }

export async function getAreaAccess(): Promise<AreaAccess | null> {
  const session = await auth()
  if (!session?.user) return null
  const perms = await getRolePermissions(session.user.companyId)
  return { role: session.user.role, companyId: session.user.companyId, perms }
}

export async function checkArea(area: AreaKey): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getAreaAccess()
  if (!access) return { ok: false, error: "認証されていません" }
  if (!canSeeArea(access.perms, access.role, area)) return { ok: false, error: AREA_DENIED_MESSAGES[area] }
  return { ok: true }
}

export async function canSeeAreaForSession(area: AreaKey): Promise<boolean> {
  const access = await getAreaAccess()
  return !!access && canSeeArea(access.perms, access.role, area)
}

export async function requireAreaPage(area: AreaKey): Promise<void> {
  const access = await getAreaAccess()
  if (!access) redirect("/login")
  if (!canSeeArea(access.perms, access.role, area)) redirect("/dashboard")
}
