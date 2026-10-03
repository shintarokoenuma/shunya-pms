"use server"

import { UserRole, UserStatus } from "@prisma/client"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { formatTtlMinutes, getAppBaseUrl, getMailConfig } from "@/lib/mail/config"
import { sendMail } from "@/lib/mail/send"
import { buildPasswordResetMail } from "@/lib/mail/templates"
import { findValidToken, issueUserToken } from "@/lib/user-tokens"
import { requestPasswordResetSchema, resetPasswordSchema } from "@/lib/validators/user-management"
import { RESET_EXPIRED_MESSAGE, RESET_INVALID_MESSAGE } from "@/lib/auth-messages"

/**
 * B-205 PR-3（P3-D6〜P3-D8・P3-D12・P3-D17・P3-D18）: パスワード再設定（ログイン不要）。
 * - 受付: 登録の有無に関係なく同じ文を返す（P3-D6）。送るのは ACTIVE・deletedAt なし・EXTERNAL でない人だけ。
 *   同じ人に2分以内に2通目を送らない（P3-D7）。送信の失敗も画面には同じ文・サーバのログに残す。AuditLog は残さない（P3-D18）
 * - 再設定: 同じトランザクションで passwordHash・failedLoginAttempts=0・lockedUntil=null・passwordChangedAt・トークンの usedAt を書く（P3-D12）
 * ★生のトークンはログ・AuditLog・戻り値に出さない。User は TENANT_MODELS に無い。companyId を必ず手書きする
 */

const RESEND_COOLDOWN_MS = 2 * 60 * 1000

type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

class ResetError extends Error {}

function personName(u: { displayName: string | null; lastName: string; firstName: string }): string {
  return u.displayName ?? `${u.lastName} ${u.firstName}`
}

/** P3-D6: 受付の返事の文（登録の有無に関係なく同じ）。「1時間」は環境変数の値から組み立てる */
export async function passwordResetAcceptedMessage(): Promise<string> {
  const ttl = formatTtlMinutes(getMailConfig().passwordResetTtlMinutes)
  return `登録されていれば、再設定のメールを送りました。メールのリンクは${ttl}有効です。`
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult<{ message: string }>> {
  const parsed = requestPasswordResetSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
  }
  const { email } = parsed.data
  const message = await passwordResetAcceptedMessage()

  try {
    const user = await prisma.user.findFirst({
      where: {
        email,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        isExternalUser: false,
        role: { not: UserRole.EXTERNAL },
      },
      select: { id: true, companyId: true, email: true, displayName: true, lastName: true, firstName: true },
    })
    if (!user) return { ok: true, data: { message } }

    // P3-D7: 直前の未使用トークンが2分以内なら送らない
    const recent = await prisma.userToken.findFirst({
      where: {
        companyId: user.companyId,
        userId: user.id,
        purpose: "PASSWORD_RESET",
        usedAt: null,
        revokedAt: null,
        createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
      },
      select: { id: true },
    })
    if (recent) return { ok: true, data: { message } }

    const appBaseUrl = getAppBaseUrl()
    const ttlMs = getMailConfig().passwordResetTtlMinutes * 60 * 1000

    await prisma.$transaction(
      async (tx) => {
        const issued = await issueUserToken(tx, {
          companyId: user.companyId,
          userId: user.id,
          purpose: "PASSWORD_RESET",
          ttlMs,
          createdByUserId: null,
        })
        const mail = buildPasswordResetMail({
          userName: personName(user),
          appBaseUrl,
          token: issued.token,
          expiresAt: issued.expiresAt,
        })
        const sent = await sendMail({ to: user.email, ...mail })
        if (!sent.ok) throw new ResetError(sent.reason)
      },
      { timeout: 30000 },
    )
  } catch (e) {
    // 画面には同じ文を返す。原因はサーバのログにだけ残す（登録の有無を外から探られないように）
    console.error("[password-reset] request failed:", e instanceof Error ? e.message : e)
  }
  return { ok: true, data: { message } }
}

export type PasswordResetLookup = { status: "valid" | "expired" | "invalid" }

export async function lookupPasswordResetToken(token: string): Promise<PasswordResetLookup> {
  const found = await findValidToken(prisma, token, "PASSWORD_RESET")
  if (found.status !== "valid") return { status: found.status }
  const user = await prisma.user.findFirst({
    where: { id: found.row.userId, companyId: found.row.companyId, deletedAt: null, status: UserStatus.ACTIVE, isExternalUser: false },
    select: { id: true },
  })
  return { status: user ? "valid" : "invalid" }
}

export async function resetPassword(input: unknown): Promise<ActionResult> {
  try {
    const parsed = resetPasswordSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const { token, password } = parsed.data

    const found = await findValidToken(prisma, token, "PASSWORD_RESET")
    if (found.status === "expired") return { ok: false, error: RESET_EXPIRED_MESSAGE }
    if (found.status === "invalid") return { ok: false, error: RESET_INVALID_MESSAGE }
    const { row } = found

    const user = await prisma.user.findFirst({
      where: { id: row.userId, companyId: row.companyId, deletedAt: null, status: UserStatus.ACTIVE, isExternalUser: false },
      select: { id: true, displayName: true, lastName: true, firstName: true },
    })
    if (!user) return { ok: false, error: RESET_INVALID_MESSAGE }

    const passwordHash = await bcrypt.hash(password, 12)
    const now = new Date()

    await prisma.$transaction(
      async (tx) => {
        const used = await tx.userToken.updateMany({
          where: { id: row.id, usedAt: null, revokedAt: null },
          data: { usedAt: now },
        })
        if (used.count !== 1) throw new ResetError(RESET_INVALID_MESSAGE)
        await tx.user.update({
          where: { id: user.id },
          data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null, passwordChangedAt: now },
        })
        await tx.auditLog.create({
          data: {
            companyId: row.companyId,
            userId: user.id,
            action: "UPDATE",
            entityType: "User",
            entityId: user.id,
            afterData: { passwordChangedAt: now.toISOString() },
            description: `パスワードを再設定: ${personName(user)}`,
          },
        })
      },
      { timeout: 15000 },
    )

    return { ok: true, data: undefined }
  } catch (e) {
    if (e instanceof ResetError) return { ok: false, error: e.message }
    console.error("[password-reset] reset failed:", e instanceof Error ? e.message : e)
    return { ok: false, error: "パスワードの変更に失敗しました。もう一度試してください" }
  }
}
