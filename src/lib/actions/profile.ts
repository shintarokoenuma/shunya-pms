"use server"

import { revalidatePath } from "next/cache"
import { UserRole, UserStatus } from "@prisma/client"
import bcrypt from "bcryptjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { changeMyPasswordSchema, updateMyProfileSchema } from "@/lib/validators/user-management"

/**
 * B-244（D-1〜D-6）: 自分のプロフィール（名前・パスワードの変更）。
 * - 本人だけ（D-6）: userId は受け取らない。session.user.id と companyId・deletedAt: null・status: ACTIVE で行を引く（User は TENANT_MODELS に無い）
 * - 名前（D-2・D-3）: 姓・名・表示名。表示名が空なら null。保存後は jwt の読み直しで右上の名前がすぐ変わる
 * - パスワード（D-4・D-5）: 今のパスワードを照合 → 新しいものを bcrypt コスト 12 で保存 → passwordChangedAt を今に。
 *   AuditLog の afterData は passwordChangedAt だけ（ハッシュは残さない）。ほかの端末は jwt の判定（isSessionStale）で切れ、本人は画面側で signOut する
 */

type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type MyProfile = {
  email: string
  lastName: string
  firstName: string
  displayName: string | null
  role: UserRole
}

function personName(u: { displayName: string | null; lastName: string; firstName: string }): string {
  return u.displayName ?? `${u.lastName} ${u.firstName}`
}

/** D-6: ログイン中の本人の行（ACTIVE・deletedAt なし・同じ会社）を引く */
async function requireMe() {
  const session = await auth()
  if (!session?.user) return { ok: false as const, error: "認証されていません" }
  const me = await prisma.user.findFirst({
    where: { id: session.user.id, companyId: session.user.companyId, deletedAt: null, status: UserStatus.ACTIVE },
    select: {
      id: true,
      companyId: true,
      email: true,
      lastName: true,
      firstName: true,
      displayName: true,
      role: true,
      passwordHash: true,
    },
  })
  if (!me) return { ok: false as const, error: "ユーザーが見つかりません" }
  return { ok: true as const, me }
}

export async function getMyProfile(): Promise<ActionResult<MyProfile>> {
  const r = await requireMe()
  if (!r.ok) return r
  const { email, lastName, firstName, displayName, role } = r.me
  return { ok: true, data: { email, lastName, firstName, displayName, role } }
}

export async function updateMyProfile(input: unknown): Promise<ActionResult> {
  try {
    const r = await requireMe()
    if (!r.ok) return r
    const parsed = updateMyProfileSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const { lastName, firstName, displayName } = parsed.data
    const before = { lastName: r.me.lastName, firstName: r.me.firstName, displayName: r.me.displayName }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: r.me.id },
        data: { lastName, firstName, displayName },
      })
      await tx.auditLog.create({
        data: {
          companyId: r.me.companyId,
          userId: r.me.id,
          action: "UPDATE",
          entityType: "User",
          entityId: r.me.id,
          beforeData: before,
          afterData: { lastName, firstName, displayName },
          description: `自分の名前を変更: ${personName(before)} → ${personName({ lastName, firstName, displayName })}`,
        },
      })
    })

    revalidatePath("/", "layout")
    return { ok: true, data: undefined }
  } catch (e) {
    console.error("[profile] update failed:", e instanceof Error ? e.message : e)
    return { ok: false, error: "名前の保存に失敗しました。もう一度試してください" }
  }
}

export async function changeMyPassword(input: unknown): Promise<ActionResult> {
  try {
    const r = await requireMe()
    if (!r.ok) return r
    const parsed = changeMyPasswordSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const { currentPassword, password } = parsed.data

    // D-4: 今のパスワードを照合（ハッシュが無い人は照合できない＝違う扱い）
    const currentOk = !!r.me.passwordHash && (await bcrypt.compare(currentPassword, r.me.passwordHash))
    if (!currentOk) return { ok: false, error: "今のパスワードが違います" }
    if (await bcrypt.compare(password, r.me.passwordHash as string)) {
      return { ok: false, error: "今と同じパスワードです" }
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: r.me.id },
        data: { passwordHash, passwordChangedAt: now },
      })
      await tx.auditLog.create({
        data: {
          companyId: r.me.companyId,
          userId: r.me.id,
          action: "UPDATE",
          entityType: "User",
          entityId: r.me.id,
          afterData: { passwordChangedAt: now.toISOString() },
          description: `自分のパスワードを変更: ${personName(r.me)}`,
        },
      })
    })

    // D-5: ほかの端末は jwt の読み直し（passwordChangedAt > loginAt）で切れる。本人のサインアウトは画面側
    return { ok: true, data: undefined }
  } catch (e) {
    console.error("[profile] change password failed:", e instanceof Error ? e.message : e)
    return { ok: false, error: "パスワードの変更に失敗しました。もう一度試してください" }
  }
}
