import type { UserRole } from "@prisma/client"

/**
 * B-205 PR-2（spec v1.0 §5-1・P2-D5）: 「オーナー・管理者か」の判定の 1 か所。
 * 以前 ui-preferences.ts（会社の表示設定）と period-close/lock.ts（締めの解除）に分かれていた判定をここに一本化した。
 * 画面の出し分けとサーバ（action）の拒否の両方がこれを使う。
 */
export const MANAGER_ROLES = ["OWNER", "ADMIN"] as const

export function canManageCompany(role: UserRole | string | null | undefined): boolean {
  return !!role && (MANAGER_ROLES as readonly string[]).includes(role)
}

export function isOwner(role: UserRole | string | null | undefined): boolean {
  return role === "OWNER"
}
