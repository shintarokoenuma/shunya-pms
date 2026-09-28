import { CONFIGURABLE_ROLES, type ConfigurableRole } from "@/lib/constants/user-roles"
import { canManageCompany } from "@/lib/permissions"

/**
 * B-205 PR-2（D-13・D-16・D-20・P2-D7〜D-9）: 設定ページの項目を役割ごとに「見る／隠す」する純関数。
 * - 保存先は CompanySetting.securitySettings.rolePermissions.settings.{section}.{role} = "view" | "hidden"
 * - キーが無ければ "view"（D-16）。OWNER / ADMIN は保存せず常に見える・変更できる
 * - 「役割と権限」の画面そのものは表の行に無く、誰にでも見える（P2-D9）
 * - prisma 非依存（client component からも import できる）。DB を読む側は settings-visibility-db.ts
 * ★B-243（仮）で settings と並ぶ名前空間（cost・billing など）を足せる形にしてある
 */
export const SETTINGS_SECTIONS = ["company", "bank", "users", "display"] as const
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  company: "自社情報",
  bank: "振込先",
  users: "ユーザー",
  display: "表示設定",
}

export const SETTINGS_SECTION_HINTS: Record<SettingsSection, string> = {
  company: "帳票に載る情報",
  bank: "請求書に載る口座",
  users: "招待・役割・停止",
  display: "品番カルテのメモ",
}

export const ROLES_SECTION_PATH = "/settings/roles"

export type SectionVisibility = "view" | "hidden"

export type RolePermissions = {
  settings: Partial<Record<SettingsSection, Partial<Record<ConfigurableRole, SectionVisibility>>>>
}

export const EMPTY_ROLE_PERMISSIONS: RolePermissions = { settings: {} }

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
}

/**
 * securitySettings（Json）から rolePermissions を形を確かめて取り出す。
 * 壊れた値・未設定・知らないキーは捨てる（＝全員「見る」）。
 */
export function readRolePermissions(securitySettings: unknown): RolePermissions {
  const out: RolePermissions = { settings: {} }
  if (!isObject(securitySettings)) return out
  const rp = securitySettings.rolePermissions
  if (!isObject(rp) || !isObject(rp.settings)) return out
  for (const section of SETTINGS_SECTIONS) {
    const byRole = rp.settings[section]
    if (!isObject(byRole)) continue
    const entry: Partial<Record<ConfigurableRole, SectionVisibility>> = {}
    for (const role of CONFIGURABLE_ROLES) {
      const v = byRole[role]
      if (v === "view" || v === "hidden") entry[role] = v
    }
    if (Object.keys(entry).length > 0) out.settings[section] = entry
  }
  return out
}

export function canSeeSettingsSection(
  perms: RolePermissions,
  role: string | null | undefined,
  section: SettingsSection,
): boolean {
  if (canManageCompany(role)) return true
  if (!role || !(CONFIGURABLE_ROLES as readonly string[]).includes(role)) return false
  return perms.settings[section]?.[role as ConfigurableRole] !== "hidden"
}

export function visibleSettingsSections(perms: RolePermissions, role: string | null | undefined): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((s) => canSeeSettingsSection(perms, role, s))
}

export function settingsSectionPath(section: SettingsSection): string {
  return `/settings/${section}`
}

/** 見える最初の項目の URL。見える項目が無ければ「役割と権限」（誰にでも見える・P2-D9） */
export function firstVisibleSettingsPath(perms: RolePermissions, role: string | null | undefined): string {
  const first = visibleSettingsSections(perms, role)[0]
  return first ? settingsSectionPath(first) : ROLES_SECTION_PATH
}
