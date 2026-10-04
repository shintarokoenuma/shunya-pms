import { CONFIGURABLE_ROLES, type ConfigurableRole } from "@/lib/constants/user-roles"
import { canManageCompany } from "@/lib/permissions"

/**
 * B-205 PR-2（D-13・D-16・D-20・P2-D7〜D-9）: 設定ページの項目を役割ごとに「見る／隠す」する純関数。
 * - 保存先は CompanySetting.securitySettings.rolePermissions.settings.{section}.{role} = "view" | "hidden"
 * - キーが無ければ "view"（D-16）。OWNER / ADMIN は保存せず常に見える・変更できる
 * - 「役割と権限」の画面そのものは表の行に無く、誰にでも見える（P2-D9）
 * - prisma 非依存（client component からも import できる）。DB を読む側は settings-visibility-db.ts
 * B-243 PR-1（C-D1〜C-D3）: settings と並ぶ名前空間 areas（画面の領域）。PR-1 は orders（発注）だけ。
 * - 未設定は area ごとの既定値（AREA_DEFAULTS）で解く。書かれていない役割は "view"。settings の既定（キーが無ければ見る・D-16）は変えない
 * - OWNER / ADMIN は常に見える。EXTERNAL・未ログイン・知らない役割は常に見えない
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

// ---- B-243 PR-1: 画面の領域（areas）
// B-243 PR-2（D2-1）: cost（原価・見積）・sales（受注）を足す
// B-243 PR-3（D3-1）: delivery（納品）・accounting（経理）を足す
// B-243 PR-4（D4-1）: masterTerms（マスターの取引条件・編集）を足す
export const AREA_KEYS = ["orders", "cost", "sales", "delivery", "accounting", "masterTerms"] as const
export type AreaKey = (typeof AREA_KEYS)[number]

export const AREA_LABELS: Record<AreaKey, string> = {
  orders: "発注",
  cost: "原価・見積",
  sales: "受注",
  delivery: "納品",
  accounting: "経理",
  masterTerms: "マスターの取引条件・編集",
}

export const AREA_HINTS: Record<AreaKey, string> = {
  orders: "仕入 PO・作業 WO",
  cost: "量産見積・概算見積・原価・BOM の単価",
  sales: "受注の一覧・詳細・作成",
  delivery: "納品書の一覧・詳細・作成・PDF",
  accounting: "請求・入金・締め",
  masterTerms: "クライアント・仕入先・工場・外注先・素材",
}

/** C-D2: 未設定のときの既定。書かれていない役割は "view" */
export const AREA_DEFAULTS: Record<AreaKey, Partial<Record<ConfigurableRole, SectionVisibility>>> = {
  orders: { STAFF: "hidden" },
  cost: { STAFF: "hidden" },
  sales: { STAFF: "hidden" },
  delivery: { STAFF: "hidden" },
  accounting: { STAFF: "hidden" },
  masterTerms: { STAFF: "hidden" },
}

/** C-D5: action・API 共通の拒否の文言 */
export const AREA_DENIED_MESSAGES: Record<AreaKey, string> = {
  orders: "この役割では発注を扱えません",
  cost: "この役割では原価・見積を扱えません",
  sales: "この役割では受注を扱えません",
  delivery: "この役割では納品を扱えません",
  accounting: "この役割では経理を扱えません",
  masterTerms: "この役割ではマスターの取引条件・編集を扱えません",
}

export type RolePermissions = {
  settings: Partial<Record<SettingsSection, Partial<Record<ConfigurableRole, SectionVisibility>>>>
  areas: Partial<Record<AreaKey, Partial<Record<ConfigurableRole, SectionVisibility>>>>
}

export const EMPTY_ROLE_PERMISSIONS: RolePermissions = { settings: {}, areas: {} }

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
}

/**
 * securitySettings（Json）から rolePermissions を形を確かめて取り出す。
 * 壊れた値・未設定・知らないキーは捨てる（＝全員「見る」）。
 */
export function readRolePermissions(securitySettings: unknown): RolePermissions {
  const out: RolePermissions = { settings: {}, areas: {} }
  if (!isObject(securitySettings)) return out
  const rp = securitySettings.rolePermissions
  if (!isObject(rp)) return out
  if (isObject(rp.settings)) {
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
  }
  // B-243 PR-1: areas も同じ作法（壊れた値・知らないキーは捨てる）
  if (isObject(rp.areas)) {
    for (const area of AREA_KEYS) {
      const byRole = rp.areas[area]
      if (!isObject(byRole)) continue
      const entry: Partial<Record<ConfigurableRole, SectionVisibility>> = {}
      for (const role of CONFIGURABLE_ROLES) {
        const v = byRole[role]
        if (v === "view" || v === "hidden") entry[role] = v
      }
      if (Object.keys(entry).length > 0) out.areas[area] = entry
    }
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

// ---- B-243 PR-1: 画面の領域の判定（C-D3）

/** 役割ごとの保存値 → 既定値 → "view" の順で解いた値（画面の初期表示にも使う・C-D2） */
export function areaVisibilityFor(perms: RolePermissions, area: AreaKey, role: ConfigurableRole): SectionVisibility {
  return perms.areas[area]?.[role] ?? AREA_DEFAULTS[area][role] ?? "view"
}

export function canSeeArea(perms: RolePermissions, role: string | null | undefined, area: AreaKey): boolean {
  if (canManageCompany(role)) return true
  if (!role || !(CONFIGURABLE_ROLES as readonly string[]).includes(role)) return false
  return areaVisibilityFor(perms, area, role as ConfigurableRole) !== "hidden"
}

export function visibleAreas(perms: RolePermissions, role: string | null | undefined): AreaKey[] {
  return AREA_KEYS.filter((a) => canSeeArea(perms, role, a))
}
