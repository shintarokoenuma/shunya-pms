"use server"

import { revalidatePath } from "next/cache"
import { UserRole, UserStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canManageCompany } from "@/lib/permissions"
import { STATUS_ORDER } from "@/lib/constants/user-roles"
import { canSeeSettingsSection } from "@/lib/settings-visibility"
import { getRolePermissions } from "@/lib/settings-visibility-db"
import {
  LAST_OWNER_ERROR,
  checkActorCanTouch,
  isLastOwnerViolation,
  nextUserStatus,
} from "@/lib/user-management"
import { changeUserStatusSchema, updateUserRoleSchema } from "@/lib/validators/user-management"

/**
 * B-205 PR-2（D-17〜D-19・P2-D2〜P2-D4・P2-D10〜P2-D12）: ユーザーの一覧・役割の変更・状態の変更。
 * - 一覧: 同じ会社・deletedAt なし・EXTERNAL でない・isExternalUser=false。アーカイブは includeArchived のときだけ
 * - D-19: email・lastLoginAt は OWNER / ADMIN にだけ返す（戻り値から落とす）
 * - 変更は OWNER / ADMIN だけ。自分は不可。オーナーに関わる操作はオーナーだけ（P2-D3）。最後のオーナーは守る（P2-D4・同じ tx）
 * - 状態の遷移は 4 つだけ（P2-D2・nextUserStatus）。deletedAt は使わない（D-18）
 * - 招待・メールは PR-3
 * ★User は TENANT_MODELS に無い。companyId を必ず手書きする
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

const EXTERNAL_DENIED = "外部ユーザーは設定を扱えません"
const SECTION_HIDDEN = "この項目はあなたの役割では表示されません"

async function requireSession() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, error: "認証されていません" }
  }
  return {
    ok: true as const,
    companyId: session.user.companyId,
    userId: session.user.id,
    role: session.user.role as UserRole,
  }
}

class UserActionError extends Error {}

/** 拡張クライアントの $transaction が渡す tx の型 */
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export type CompanyUserRow = {
  id: string
  name: string
  role: UserRole
  status: UserStatus
  isSelf: boolean
  /** D-19: OWNER / ADMIN にだけ入る */
  email?: string
  /** ISO 8601。D-19: OWNER / ADMIN にだけ入る（null＝未ログイン） */
  lastLoginAt?: string | null
}

function personName(u: { displayName: string | null; lastName: string; firstName: string }): string {
  return u.displayName ?? `${u.lastName} ${u.firstName}`
}

// =============================================================================
// 1. 一覧
// =============================================================================
export async function listCompanyUsers(
  opts: { includeArchived?: boolean } = {},
): Promise<ActionResult<{ users: CompanyUserRow[]; canManage: boolean; actorRole: UserRole }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }
    // P2-D8: 隠された項目は読み取り action も拒否する
    const perms = await getRolePermissions(sess.companyId)
    if (!canSeeSettingsSection(perms, sess.role, "users")) return { ok: false, error: SECTION_HIDDEN }

    const canManage = canManageCompany(sess.role)
    const rows = await prisma.user.findMany({
      where: {
        companyId: sess.companyId,
        deletedAt: null,
        isExternalUser: false,
        role: { not: UserRole.EXTERNAL },
        ...(opts.includeArchived ? {} : { status: { not: UserStatus.ARCHIVED } }),
      },
      select: {
        id: true,
        displayName: true,
        lastName: true,
        firstName: true,
        role: true,
        status: true,
        email: true,
        lastLoginAt: true,
      },
    })
    const users: CompanyUserRow[] = rows
      .map((u) => ({
        id: u.id,
        name: personName(u),
        role: u.role,
        status: u.status,
        isSelf: u.id === sess.userId,
        ...(canManage ? { email: u.email, lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null } : {}),
      }))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, "ja"))
    return { ok: true, data: { users, canManage, actorRole: sess.role } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ユーザーの取得に失敗しました" }
  }
}

// =============================================================================
// 2. 役割の変更（役割はプルダウンを変えた時点で保存・P2-D11）
// =============================================================================
export async function updateUserRole(input: unknown): Promise<ActionResult<{ id: string; role: UserRole }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }
    if (!canManageCompany(sess.role)) return { ok: false, error: "ユーザーを変更できるのはオーナーと管理者だけです" }

    const parsed = updateUserRoleSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const { userId, role: newRole } = parsed.data

    const result = await prisma.$transaction(
      async (tx: TxClient) => {
        const target = await tx.user.findFirst({
          where: { id: userId, companyId: sess.companyId, deletedAt: null, isExternalUser: false },
          select: { id: true, role: true, status: true, email: true, displayName: true, lastName: true, firstName: true },
        })
        if (!target) throw new UserActionError("ユーザーが見つかりません")
        const touch = checkActorCanTouch({
          actorRole: sess.role,
          actorId: sess.userId,
          targetId: target.id,
          targetRole: target.role,
          newRole,
        })
        if (!touch.ok) throw new UserActionError(touch.error)
        if (target.role === newRole) return { id: target.id, role: target.role, changed: false }

        // P2-D4: 最後のオーナー（同じ tx で数える）
        if (target.role === UserRole.OWNER && newRole !== UserRole.OWNER) {
          const others = await tx.user.count({
            where: {
              companyId: sess.companyId,
              role: UserRole.OWNER,
              status: UserStatus.ACTIVE,
              deletedAt: null,
              id: { not: target.id },
            },
          })
          if (isLastOwnerViolation({ targetRole: target.role, targetStatus: target.status, newRole, otherActiveOwnerCount: others })) {
            throw new UserActionError(LAST_OWNER_ERROR)
          }
        }

        await tx.user.update({ where: { id: target.id }, data: { role: newRole } })
        await tx.auditLog.create({
          data: {
            companyId: sess.companyId,
            userId: sess.userId,
            action: "UPDATE",
            entityType: "User",
            entityId: target.id,
            beforeData: { role: target.role },
            afterData: { role: newRole },
            description: `ユーザーの役割を変更: ${personName(target)} ${target.role} → ${newRole}`,
          },
        })
        return { id: target.id, role: newRole, changed: true }
      },
      { timeout: 15000 },
    )

    if (result.changed) revalidatePath("/settings", "layout")
    return { ok: true, data: { id: result.id, role: result.role } }
  } catch (e) {
    if (e instanceof UserActionError) return { ok: false, error: e.message }
    return { ok: false, error: e instanceof Error ? e.message : "役割の変更に失敗しました" }
  }
}

// =============================================================================
// 3. 状態の変更（停止／再開／アーカイブ／停止に戻す・P2-D2）
// =============================================================================
export async function changeUserStatus(input: unknown): Promise<ActionResult<{ id: string; status: UserStatus }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }
    if (!canManageCompany(sess.role)) return { ok: false, error: "ユーザーを変更できるのはオーナーと管理者だけです" }

    const parsed = changeUserStatusSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const { userId, action } = parsed.data

    const result = await prisma.$transaction(
      async (tx: TxClient) => {
        const target = await tx.user.findFirst({
          where: { id: userId, companyId: sess.companyId, deletedAt: null, isExternalUser: false },
          select: { id: true, role: true, status: true, displayName: true, lastName: true, firstName: true },
        })
        if (!target) throw new UserActionError("ユーザーが見つかりません")
        const touch = checkActorCanTouch({
          actorRole: sess.role,
          actorId: sess.userId,
          targetId: target.id,
          targetRole: target.role,
        })
        if (!touch.ok) throw new UserActionError(touch.error)

        const next = nextUserStatus(target.status, action)
        if (!next) throw new UserActionError("この状態からその操作はできません")

        // P2-D4: 最後のオーナー（停止・アーカイブで有効なオーナーから外れるとき）
        if (target.role === UserRole.OWNER) {
          const others = await tx.user.count({
            where: {
              companyId: sess.companyId,
              role: UserRole.OWNER,
              status: UserStatus.ACTIVE,
              deletedAt: null,
              id: { not: target.id },
            },
          })
          if (isLastOwnerViolation({ targetRole: target.role, targetStatus: target.status, action, otherActiveOwnerCount: others })) {
            throw new UserActionError(LAST_OWNER_ERROR)
          }
        }

        await tx.user.update({ where: { id: target.id }, data: { status: next } })
        await tx.auditLog.create({
          data: {
            companyId: sess.companyId,
            userId: sess.userId,
            action: "STATUS_CHANGE",
            entityType: "User",
            entityId: target.id,
            beforeData: { status: target.status },
            afterData: { status: next, action },
            description: `ユーザーの状態を変更: ${personName(target)} ${target.status} → ${next}`,
          },
        })
        return { id: target.id, status: next }
      },
      { timeout: 15000 },
    )

    revalidatePath("/settings", "layout")
    return { ok: true, data: result }
  } catch (e) {
    if (e instanceof UserActionError) return { ok: false, error: e.message }
    return { ok: false, error: e instanceof Error ? e.message : "状態の変更に失敗しました" }
  }
}
