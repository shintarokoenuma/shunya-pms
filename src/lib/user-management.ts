import type { UserRole, UserStatus } from "@prisma/client"
import { ASSIGNABLE_ROLES } from "@/lib/constants/user-roles"
import { canManageCompany, isOwner } from "@/lib/permissions"

/**
 * B-205 PR-2（D-17・P2-D2〜P2-D4）: ユーザー管理の判定の純関数（prisma 非依存・テスト付き）。
 * action（src/lib/actions/users.ts）と画面（users-table.tsx）の両方がこれを使う。
 */

/** P2-D2: 状態の変更は 4 つだけ */
export type UserStatusAction = "suspend" | "resume" | "archive" | "unarchive"

export const USER_STATUS_ACTION_LABELS: Record<UserStatusAction, string> = {
  suspend: "停止",
  resume: "再開",
  archive: "アーカイブ",
  unarchive: "停止に戻す",
}

/** 有効→停止／停止→有効／停止→アーカイブ／アーカイブ→停止。それ以外は null（サーバで拒否） */
export function nextUserStatus(from: UserStatus, action: UserStatusAction): UserStatus | null {
  switch (action) {
    case "suspend":
      return from === "ACTIVE" ? "SUSPENDED" : null
    case "resume":
      return from === "SUSPENDED" ? "ACTIVE" : null
    case "archive":
      return from === "SUSPENDED" ? "ARCHIVED" : null
    case "unarchive":
      return from === "ARCHIVED" ? "SUSPENDED" : null
    default:
      return null
  }
}

/** その状態の行に出す操作（招待中は無し） */
export function availableStatusActions(status: UserStatus): UserStatusAction[] {
  switch (status) {
    case "ACTIVE":
      return ["suspend"]
    case "SUSPENDED":
      return ["resume", "archive"]
    case "ARCHIVED":
      return ["unarchive"]
    default:
      return []
  }
}

/** P2-D11: 「停止」と「アーカイブ」は確認を挟む */
export function statusActionNeedsConfirm(action: UserStatusAction): boolean {
  return action === "suspend" || action === "archive"
}

/** P2-D3: オーナーは 7 つ全部、管理者は「オーナー」を除く、それ以外は変えられない */
export function assignableRolesFor(actorRole: UserRole | string | null | undefined): UserRole[] {
  if (isOwner(actorRole)) return [...ASSIGNABLE_ROLES]
  if (canManageCompany(actorRole)) return ASSIGNABLE_ROLES.filter((r) => r !== "OWNER")
  return []
}

export type TouchCheck = { ok: true } | { ok: false; error: string }

/**
 * 操作する人が相手を扱えるか（D-17・P2-D3）。
 * - オーナー・管理者以外は拒否
 * - 自分は拒否
 * - 相手がオーナー、または新しい役割がオーナーなら、操作する人がオーナーでなければ拒否
 */
export function checkActorCanTouch(args: {
  actorRole: UserRole | string | null | undefined
  actorId: string
  targetId: string
  targetRole: UserRole
  newRole?: UserRole
}): TouchCheck {
  if (!canManageCompany(args.actorRole)) {
    return { ok: false, error: "ユーザーを変更できるのはオーナーと管理者だけです" }
  }
  if (args.actorId === args.targetId) {
    return { ok: false, error: args.newRole !== undefined ? "自分の役割は変更できません" : "自分の状態は変更できません" }
  }
  if (args.targetRole === "EXTERNAL" || args.newRole === "EXTERNAL") {
    return { ok: false, error: "社外ユーザーはここでは扱えません" }
  }
  if ((args.targetRole === "OWNER" || args.newRole === "OWNER") && !isOwner(args.actorRole)) {
    return { ok: false, error: "オーナーの変更はオーナーだけができます" }
  }
  return { ok: true }
}

/**
 * P2-D4: 「最後のオーナー」を守る。相手がオーナーで、この操作で有効なオーナーから外れ（役割をオーナー以外にする・停止・アーカイブ）、
 * その人以外の有効（ACTIVE・deletedAt なし）なオーナーが 0 人なら拒否。
 */
export function isLastOwnerViolation(args: {
  targetRole: UserRole
  targetStatus: UserStatus
  newRole?: UserRole
  action?: UserStatusAction
  otherActiveOwnerCount: number
}): boolean {
  if (args.targetRole !== "OWNER") return false
  const removesByRole = args.newRole !== undefined && args.newRole !== "OWNER"
  const removesByStatus =
    args.action !== undefined && args.targetStatus === "ACTIVE" && (args.action === "suspend" || args.action === "archive")
  if (!removesByRole && !removesByStatus) return false
  return args.otherActiveOwnerCount === 0
}

export const LAST_OWNER_ERROR = "最後のオーナーは変更できません"

/**
 * B-253（C-D4）: 招待のときの、同じメールの既存の行の分類。
 * - new: 行が無い → 今までどおり新しく作る
 * - revive: 同じ会社・INVITED・deletedAt あり（取り消した招待）→ その行を起こし直す
 * - pending: 同じ会社・INVITED・deletedAt なし → 止める（「招待を再送」を使ってもらう）
 * - in_use: それ以外（有効・停止・アーカイブ・他社・削除済みの有効な人）→ 止める
 */
export type InviteEmailClass = "new" | "revive" | "pending" | "in_use"

export function classifyInviteEmail(
  existing: { companyId: string; status: UserStatus; deletedAt: Date | null } | null,
  companyId: string,
): InviteEmailClass {
  if (!existing) return "new"
  if (existing.companyId !== companyId || existing.status !== "INVITED") return "in_use"
  return existing.deletedAt ? "revive" : "pending"
}
