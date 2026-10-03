"use server"

import { UserStatus } from "@prisma/client"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { findValidToken } from "@/lib/user-tokens"
import { acceptInvitationSchema } from "@/lib/validators/user-management"
import { INVITE_EXPIRED_MESSAGE, INVITE_INVALID_MESSAGE } from "@/lib/auth-messages"

/**
 * B-205 PR-3（P3-D11・P3-D17・P3-D18）: 招待を受ける（ログイン不要）。
 * - 開いたとき: トークンを確かめ、会社名・氏名・メールを返す。期限切れと「使えない」は文を出し分ける
 * - 受諾: もう一度トークンを確かめ、相手が INVITED であることを確かめ、同じトランザクションで
 *   passwordHash・status=ACTIVE・passwordChangedAt・トークンの usedAt を書く。使い終わったトークンは二度と使えない
 * ★ログインしている人が開いても使える。生のトークンはログ・AuditLog・戻り値に出さない
 * ★User は TENANT_MODELS に無い。companyId を必ず手書きする
 */

type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type InvitationLookup =
  | { status: "valid"; companyName: string; name: string; email: string }
  | { status: "expired" }
  | { status: "invalid" }

class InviteError extends Error {}

export async function lookupInvitation(token: string): Promise<InvitationLookup> {
  const found = await findValidToken(prisma, token, "INVITE")
  if (found.status !== "valid") return { status: found.status }
  const user = await prisma.user.findFirst({
    where: { id: found.row.userId, companyId: found.row.companyId, deletedAt: null, status: UserStatus.INVITED },
    select: { displayName: true, lastName: true, firstName: true, email: true, company: { select: { companyName: true } } },
  })
  if (!user) return { status: "invalid" }
  return {
    status: "valid",
    companyName: user.company.companyName,
    name: user.displayName ?? `${user.lastName} ${user.firstName}`,
    email: user.email,
  }
}

export async function acceptInvitation(input: unknown): Promise<ActionResult> {
  try {
    const parsed = acceptInvitationSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const { token, password } = parsed.data

    const found = await findValidToken(prisma, token, "INVITE")
    if (found.status === "expired") return { ok: false, error: INVITE_EXPIRED_MESSAGE }
    if (found.status === "invalid") return { ok: false, error: INVITE_INVALID_MESSAGE }
    const { row } = found

    const user = await prisma.user.findFirst({
      where: { id: row.userId, companyId: row.companyId, deletedAt: null, status: UserStatus.INVITED },
      select: { id: true, displayName: true, lastName: true, firstName: true },
    })
    if (!user) return { ok: false, error: INVITE_INVALID_MESSAGE }

    const passwordHash = await bcrypt.hash(password, 12)
    const now = new Date()

    await prisma.$transaction(
      async (tx) => {
        // 同じトークンが同時に2回使われても1回しか通らない
        const used = await tx.userToken.updateMany({
          where: { id: row.id, usedAt: null, revokedAt: null },
          data: { usedAt: now },
        })
        if (used.count !== 1) throw new InviteError(INVITE_INVALID_MESSAGE)
        await tx.user.update({
          where: { id: user.id },
          data: { passwordHash, status: UserStatus.ACTIVE, passwordChangedAt: now },
        })
        await tx.auditLog.create({
          data: {
            companyId: row.companyId,
            userId: user.id,
            action: "STATUS_CHANGE",
            entityType: "User",
            entityId: user.id,
            beforeData: { status: UserStatus.INVITED },
            afterData: { status: UserStatus.ACTIVE },
            description: `招待を受けてパスワードを設定: ${user.displayName ?? `${user.lastName} ${user.firstName}`}`,
          },
        })
      },
      { timeout: 15000 },
    )

    return { ok: true, data: undefined }
  } catch (e) {
    if (e instanceof InviteError) return { ok: false, error: e.message }
    console.error("[invitations] accept failed:", e instanceof Error ? e.message : e)
    return { ok: false, error: "パスワードの設定に失敗しました。もう一度試してください" }
  }
}
