"use server"

import { revalidatePath } from "next/cache"
import { Prisma, UserRole, UserStatus } from "@prisma/client"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canManageCompany, isOwner } from "@/lib/permissions"
import { MailConfigError, getAppBaseUrl, getMailConfig } from "@/lib/mail/config"
import { MAIL_NOT_CONFIGURED_MESSAGE, sendMail } from "@/lib/mail/send"
import { buildInviteMail } from "@/lib/mail/templates"
import { generateToken, issueUserToken, revokeUnusedUserTokens } from "@/lib/user-tokens"
import { STATUS_ORDER } from "@/lib/constants/user-roles"
import { canSeeSettingsSection } from "@/lib/settings-visibility"
import { getRolePermissions } from "@/lib/settings-visibility-db"
import {
  LAST_OWNER_ERROR,
  checkActorCanTouch,
  classifyInviteEmail,
  isLastOwnerViolation,
  nextUserStatus,
} from "@/lib/user-management"
import {
  cancelInvitationSchema,
  changeUserStatusSchema,
  inviteUserSchema,
  resendInvitationSchema,
  updateUserRoleSchema,
} from "@/lib/validators/user-management"

/**
 * B-205 PR-2（D-17〜D-19・P2-D2〜P2-D4・P2-D10〜P2-D12）: ユーザーの一覧・役割の変更・状態の変更。
 * - 一覧: 同じ会社・deletedAt なし・EXTERNAL でない・isExternalUser=false。アーカイブは includeArchived のときだけ
 * - D-19: email・lastLoginAt は OWNER / ADMIN にだけ返す（戻り値から落とす）
 * - 変更は OWNER / ADMIN だけ。自分は不可。オーナーに関わる操作はオーナーだけ（P2-D3）。最後のオーナーは守る（P2-D4・同じ tx）
 * - 状態の遷移は 4 つだけ（P2-D2・nextUserStatus）。deletedAt は使わない（D-18）
 * B-205 PR-3（P3-D9〜P3-D15・P3-D18）: 招待（inviteUser）と招待の再送（resendInvitation）。
 * - User を INVITED で作り、トークンを発行し、AuditLog を書き、最後にメールを送る。送信に失敗したらトランザクションを戻す（P3-D14）
 * - 一覧の招待中の行には、最後に送った日時と期限を OWNER / ADMIN にだけ返す
 * B-253（C-D1〜C-D7）: 招待の取り消し（cancelInvitation＝未使用の招待トークンを無効にして行に deletedAt）と、
 * 取り消した招待と同じ会社・同じアドレスを招待し直したときの行の使い回し（inviteUser の revive）
 * ★User は TENANT_MODELS に無い。companyId を必ず手書きする（deletedAt ありの行も findUnique で返る）
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

/** P3-D14: トランザクションの最後でメールが送れなかったときに投げ、全体を戻す */
class MailSendError extends Error {
  constructor(public readonly reason: "NOT_CONFIGURED" | "SEND_FAILED") {
    super(reason)
  }
}

const EMAIL_IN_USE = "このメールアドレスは既に使われています"
const INVITE_PENDING = "このアドレスには招待中です。「招待を再送」を使ってください"
const INVITE_SEND_FAILED = "招待メールを送れませんでした。時間をおいてもう一度試してください"
const OWNER_INVITE_ONLY = "役割「オーナー」で招待できるのはオーナーだけです"

/** P3-D13: 本番でキー・APP_BASE_URL が無ければ、User もトークンも作らずに止める（dev はコンソールに出すので通す） */
function mailNotConfiguredInProduction(): boolean {
  if (process.env.NODE_ENV !== "production") return false
  const cfg = getMailConfig()
  return !cfg.apiKey || !cfg.appBaseUrl
}

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
  /** B-205 PR-3: 招待中の行だけ・OWNER / ADMIN にだけ入る。最後に送った招待（未使用）の送信日時と期限（ISO 8601）。無ければ null */
  invite?: { sentAt: string; expiresAt: string } | null
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
    // B-205 PR-3: 招待中の行の「最後に送った招待」（未使用・最新）を OWNER / ADMIN にだけ付ける
    const invitedIds = rows.filter((u) => u.status === UserStatus.INVITED).map((u) => u.id)
    const inviteByUser = new Map<string, { sentAt: string; expiresAt: string }>()
    if (canManage && invitedIds.length > 0) {
      const tokens = await prisma.userToken.findMany({
        where: { companyId: sess.companyId, purpose: "INVITE", userId: { in: invitedIds }, usedAt: null, revokedAt: null },
        select: { userId: true, createdAt: true, expiresAt: true },
        orderBy: { createdAt: "desc" },
      })
      for (const t of tokens) {
        if (!inviteByUser.has(t.userId)) inviteByUser.set(t.userId, { sentAt: t.createdAt.toISOString(), expiresAt: t.expiresAt.toISOString() })
      }
    }
    const users: CompanyUserRow[] = rows
      .map((u) => ({
        id: u.id,
        name: personName(u),
        role: u.role,
        status: u.status,
        isSelf: u.id === sess.userId,
        ...(canManage ? { email: u.email, lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null } : {}),
        ...(canManage && u.status === UserStatus.INVITED ? { invite: inviteByUser.get(u.id) ?? null } : {}),
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

// =============================================================================
// 4. 招待（B-205 PR-3・P3-D9〜P3-D14・P2-D3）
// =============================================================================
export async function inviteUser(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }
    if (!canManageCompany(sess.role)) return { ok: false, error: "ユーザーを招待できるのはオーナーと管理者だけです" }

    const parsed = inviteUserSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const { lastName, firstName, email, role } = parsed.data
    if (role === UserRole.OWNER && !isOwner(sess.role)) return { ok: false, error: OWNER_INVITE_ONLY }

    if (mailNotConfiguredInProduction()) return { ok: false, error: MAIL_NOT_CONFIGURED_MESSAGE }
    const appBaseUrl = getAppBaseUrl()
    const inviteTtlMs = getMailConfig().inviteTtlHours * 60 * 60 * 1000

    // P3-D9: email は全体で @unique。B-253（C-D4）: 同じメールの既存の行を4通りに分ける
    // （User は TENANT_MODELS に無いので、取り消した招待＝deletedAt ありの行も findUnique で返る・§2 ①で実測）
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, companyId: true, status: true, deletedAt: true },
    })
    const emailClass = classifyInviteEmail(existing, sess.companyId)
    if (emailClass === "in_use") return { ok: false, error: EMAIL_IN_USE }
    if (emailClass === "pending") return { ok: false, error: INVITE_PENDING }
    const reviveId = emailClass === "revive" && existing ? existing.id : null

    const [actor, company] = await Promise.all([
      prisma.user.findFirst({
        where: { id: sess.userId, companyId: sess.companyId, deletedAt: null },
        select: { displayName: true, lastName: true, firstName: true },
      }),
      prisma.company.findUnique({ where: { id: sess.companyId }, select: { companyName: true } }),
    ])
    if (!actor || !company) return { ok: false, error: "会社の情報が見つかりません" }

    // P3-D10: passwordHash は NOT NULL。誰も知らない乱数のハッシュを入れる（INVITED は authorize で弾かれる）
    const placeholderHash = await bcrypt.hash(generateToken(), 12)
    const inviteeName = `${lastName} ${firstName}`

    const result = await prisma.$transaction(
      async (tx: TxClient) => {
        let userId: string
        if (reviveId) {
          // B-253（C-D5）: 取り消した招待の行を起こし直す。where で状態を確かめ、count が 1 でなければ戻す
          const revived = await tx.user.updateMany({
            where: { id: reviveId, companyId: sess.companyId, status: UserStatus.INVITED, deletedAt: { not: null } },
            data: {
              firstName,
              lastName,
              displayName: inviteeName,
              role,
              passwordHash: placeholderHash,
              deletedAt: null,
              failedLoginAttempts: 0,
              lockedUntil: null,
            },
          })
          if (revived.count !== 1) throw new UserActionError(EMAIL_IN_USE)
          userId = reviveId
        } else {
          const created = await tx.user.create({
            data: {
              companyId: sess.companyId,
              email,
              firstName,
              lastName,
              // authorize は displayName を session の name にする（auth.ts）。無いとダッシュボードの挨拶が空・右上がメールの @ の前になる。
              // dev の確認用ユーザー（dev-create-test-users.ts）と同じ「姓 名」の形で入れる
              displayName: inviteeName,
              role,
              status: UserStatus.INVITED,
              passwordHash: placeholderHash,
              isExternalUser: false,
            },
            select: { id: true },
          })
          userId = created.id
        }
        const issued = await issueUserToken(tx, {
          companyId: sess.companyId,
          userId,
          purpose: "INVITE",
          ttlMs: inviteTtlMs,
          createdByUserId: sess.userId,
        })
        await tx.auditLog.create({
          data: {
            companyId: sess.companyId,
            userId: sess.userId,
            action: reviveId ? "UPDATE" : "CREATE",
            entityType: "User",
            entityId: userId,
            afterData: { email, role, status: UserStatus.INVITED, ...(reviveId ? { revived: true } : {}) },
            description: reviveId
              ? `ユーザーを再招待（取り消した招待を使い直し）: ${inviteeName}（${email}）${role}`
              : `ユーザーを招待: ${inviteeName}（${email}）${role}`,
          },
        })
        // P3-D14: 送信は最後。失敗したら throw して全体を戻す
        const mail = buildInviteMail({
          companyName: company.companyName,
          inviteeName,
          inviterName: personName(actor),
          appBaseUrl,
          token: issued.token,
          expiresAt: issued.expiresAt,
        })
        const sent = await sendMail({ to: email, ...mail })
        if (!sent.ok) throw new MailSendError(sent.reason)
        return { id: userId }
      },
      { timeout: 30000 },
    )

    revalidatePath("/settings", "layout")
    return { ok: true, data: result }
  } catch (e) {
    if (e instanceof MailSendError) {
      return { ok: false, error: e.reason === "NOT_CONFIGURED" ? MAIL_NOT_CONFIGURED_MESSAGE : INVITE_SEND_FAILED }
    }
    if (e instanceof MailConfigError) return { ok: false, error: MAIL_NOT_CONFIGURED_MESSAGE }
    if (e instanceof UserActionError) return { ok: false, error: e.message }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: EMAIL_IN_USE }
    return { ok: false, error: e instanceof Error ? e.message : "招待に失敗しました" }
  }
}

// =============================================================================
// 5. 招待の再送（B-205 PR-3・P3-D5・P3-D15・P2-D3）
// =============================================================================
export async function resendInvitation(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }
    if (!canManageCompany(sess.role)) return { ok: false, error: "招待を再送できるのはオーナーと管理者だけです" }

    const parsed = resendInvitationSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const { userId } = parsed.data

    if (mailNotConfiguredInProduction()) return { ok: false, error: MAIL_NOT_CONFIGURED_MESSAGE }
    const appBaseUrl = getAppBaseUrl()
    const inviteTtlMs = getMailConfig().inviteTtlHours * 60 * 60 * 1000

    const [actor, company] = await Promise.all([
      prisma.user.findFirst({
        where: { id: sess.userId, companyId: sess.companyId, deletedAt: null },
        select: { displayName: true, lastName: true, firstName: true },
      }),
      prisma.company.findUnique({ where: { id: sess.companyId }, select: { companyName: true } }),
    ])
    if (!actor || !company) return { ok: false, error: "会社の情報が見つかりません" }

    const result = await prisma.$transaction(
      async (tx: TxClient) => {
        const target = await tx.user.findFirst({
          where: { id: userId, companyId: sess.companyId, deletedAt: null, isExternalUser: false },
          select: { id: true, role: true, status: true, email: true, displayName: true, lastName: true, firstName: true },
        })
        if (!target) throw new UserActionError("ユーザーが見つかりません")
        if (target.status !== UserStatus.INVITED) throw new UserActionError("招待を再送できるのは招待中のユーザーだけです")
        if (target.role === UserRole.OWNER && !isOwner(sess.role)) throw new UserActionError("オーナーの変更はオーナーだけができます")

        const issued = await issueUserToken(tx, {
          companyId: sess.companyId,
          userId: target.id,
          purpose: "INVITE",
          ttlMs: inviteTtlMs,
          createdByUserId: sess.userId,
        })
        await tx.auditLog.create({
          data: {
            companyId: sess.companyId,
            userId: sess.userId,
            action: "UPDATE",
            entityType: "User",
            entityId: target.id,
            afterData: { email: target.email, status: target.status, resend: true },
            description: `招待を再送: ${personName(target)}（${target.email}）`,
          },
        })
        const mail = buildInviteMail({
          companyName: company.companyName,
          inviteeName: personName(target),
          inviterName: personName(actor),
          appBaseUrl,
          token: issued.token,
          expiresAt: issued.expiresAt,
        })
        const sent = await sendMail({ to: target.email, ...mail })
        if (!sent.ok) throw new MailSendError(sent.reason)
        return { id: target.id }
      },
      { timeout: 30000 },
    )

    revalidatePath("/settings", "layout")
    return { ok: true, data: result }
  } catch (e) {
    if (e instanceof MailSendError) {
      return { ok: false, error: e.reason === "NOT_CONFIGURED" ? MAIL_NOT_CONFIGURED_MESSAGE : INVITE_SEND_FAILED }
    }
    if (e instanceof MailConfigError) return { ok: false, error: MAIL_NOT_CONFIGURED_MESSAGE }
    if (e instanceof UserActionError) return { ok: false, error: e.message }
    return { ok: false, error: e instanceof Error ? e.message : "招待の再送に失敗しました" }
  }
}

// =============================================================================
// 6. 招待の取り消し（B-253・C-D1〜C-D3・C-D6）
// =============================================================================
export async function cancelInvitation(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }
    if (!canManageCompany(sess.role)) return { ok: false, error: "招待を取り消せるのはオーナーと管理者だけです" }

    const parsed = cancelInvitationSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const { userId } = parsed.data

    const result = await prisma.$transaction(
      async (tx: TxClient) => {
        // C-D3: 条件は「招待を再送」と同じ
        const target = await tx.user.findFirst({
          where: { id: userId, companyId: sess.companyId, deletedAt: null, isExternalUser: false },
          select: { id: true, role: true, status: true, email: true, displayName: true, lastName: true, firstName: true },
        })
        if (!target) throw new UserActionError("ユーザーが見つかりません")
        if (target.status !== UserStatus.INVITED) throw new UserActionError("招待を取り消せるのは招待中のユーザーだけです")
        if (target.role === UserRole.OWNER && !isOwner(sess.role)) throw new UserActionError("オーナーの変更はオーナーだけができます")

        // C-D2: 未使用の招待トークンを無効にする → 行に deletedAt（status は INVITED のまま）→ AuditLog。物理削除はしない
        const now = new Date()
        const revokedTokens = await revokeUnusedUserTokens(tx, { companyId: sess.companyId, userId: target.id, purpose: "INVITE" }, now)
        const updated = await tx.user.updateMany({
          where: { id: target.id, companyId: sess.companyId, status: UserStatus.INVITED, deletedAt: null },
          data: { deletedAt: now },
        })
        if (updated.count !== 1) throw new UserActionError("招待の取り消しに失敗しました。画面を開き直してください")
        await tx.auditLog.create({
          data: {
            companyId: sess.companyId,
            userId: sess.userId,
            action: "DELETE",
            entityType: "User",
            entityId: target.id,
            beforeData: { status: UserStatus.INVITED },
            afterData: { deletedAt: now.toISOString(), revokedTokens },
            description: `招待を取り消し: ${personName(target)}（${target.email}）`,
          },
        })
        return { id: target.id }
      },
      { timeout: 15000 },
    )

    revalidatePath("/settings", "layout")
    return { ok: true, data: result }
  } catch (e) {
    if (e instanceof UserActionError) return { ok: false, error: e.message }
    return { ok: false, error: e instanceof Error ? e.message : "招待の取り消しに失敗しました" }
  }
}
