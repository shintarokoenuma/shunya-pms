/**
 * B-202 PR-4（v1.0 D-8 段階1）: 品番カルテ メモ欄の表示スイッチ（会社の既定）の共有型。
 * 中立モジュール（"use server"/prisma 非依存）。client component はここから型を import する。
 * - 保存先は CompanySetting.uiPreferences.productKarte.memo.*（段階3＝人ごとの上書きは B-203 へ移せる名前空間）
 * - 対象は PR-3 で実装済みの3つ（時刻・書いた人・「編集済み」の印）。既定は3つともオン＝現状維持。
 *   ★D-8 の「既定オフ」は Comment の未実装機能（返信・添付・ピン留め等）の規定で、対象が違う（慎太郎さん確認 2026-09-18）。
 */
export type MemoUiPreferences = {
  showTimestamp: boolean
  showAuthor: boolean
  showEditedMark: boolean
}

export const MEMO_UI_PREFERENCES_DEFAULT: MemoUiPreferences = {
  showTimestamp: true,
  showAuthor: true,
  showEditedMark: true,
}

/** 会社の既定を更新できる role（管理者相当）。UserRole の実値 OWNER / ADMIN（2026-09-18 実測）。 */
export const COMPANY_SETTING_MANAGER_ROLES = ["OWNER", "ADMIN"] as const

export function canManageCompanySettings(role: string | null | undefined): boolean {
  return (COMPANY_SETTING_MANAGER_ROLES as readonly string[]).includes(role ?? "")
}
