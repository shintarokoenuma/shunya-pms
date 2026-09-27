import type { UserRole, UserStatus } from "@prisma/client"

/**
 * B-205 PR-2（P2-D6・D-14）: 役割と状態の日本語名。
 * - ASSIGNABLE_ROLES: ユーザー一覧の役割のプルダウンに出す 7 つ（EXTERNAL は出さない・B-172）
 * - CONFIGURABLE_ROLES: 「役割と権限」で見る／隠すを切り替えられる役割（OWNER / ADMIN は常に「変更できる」）
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "オーナー",
  ADMIN: "管理者",
  PRODUCTION: "生産管理",
  ACCOUNTING: "経理",
  SALES: "営業",
  DESIGNER: "デザイナー",
  STAFF: "一般スタッフ",
  EXTERNAL: "社外ユーザー",
}

export const ASSIGNABLE_ROLES = ["OWNER", "ADMIN", "PRODUCTION", "ACCOUNTING", "SALES", "DESIGNER", "STAFF"] as const
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

export const CONFIGURABLE_ROLES = ["PRODUCTION", "ACCOUNTING", "SALES", "DESIGNER", "STAFF"] as const
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number]

export const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "有効",
  INVITED: "招待中",
  SUSPENDED: "停止",
  ARCHIVED: "アーカイブ",
}

/** 一覧の並び: 有効 → 招待中 → 停止 → アーカイブ */
export const STATUS_ORDER: Record<UserStatus, number> = {
  ACTIVE: 0,
  INVITED: 1,
  SUSPENDED: 2,
  ARCHIVED: 3,
}
