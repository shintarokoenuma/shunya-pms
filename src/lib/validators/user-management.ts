import { z } from "zod"
import { ASSIGNABLE_ROLES } from "@/lib/constants/user-roles"

/**
 * B-205 PR-2（§4-6）: ユーザーの役割の変更・状態の変更の入力。
 * - 役割は ASSIGNABLE_ROLES の 7 つだけ（EXTERNAL は受けない・D-14）
 * - 状態の操作は 4 つだけ（P2-D2）
 * B-205 PR-3（P3-D8・P3-D9）: 招待・招待の再送・招待の受諾・パスワード再設定の入力（下の方）。
 */
export const updateUserRoleSchema = z.object({
  userId: z.string().min(1, "ユーザーが指定されていません"),
  role: z.enum(ASSIGNABLE_ROLES),
})
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>

export const changeUserStatusSchema = z.object({
  userId: z.string().min(1, "ユーザーが指定されていません"),
  action: z.enum(["suspend", "resume", "archive", "unarchive"]),
})
export type ChangeUserStatusInput = z.infer<typeof changeUserStatusSchema>

// =============================================================================
// B-205 PR-3: 招待・パスワード再設定
// =============================================================================
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** P3-D9: trim → 小文字。形だけ確かめる */
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "メールアドレスは必須です")
  .max(255, "255文字以内で入力してください")
  .refine((v) => EMAIL_RE.test(v), "メールアドレスの形式が正しくありません")

export const inviteUserSchema = z.object({
  lastName: z.string().trim().min(1, "姓は必須です").max(100, "100文字以内で入力してください"),
  firstName: z.string().trim().min(1, "名は必須です").max(100, "100文字以内で入力してください"),
  email: emailField,
  role: z.enum(ASSIGNABLE_ROLES),
})
export type InviteUserInput = z.infer<typeof inviteUserSchema>

export const resendInvitationSchema = z.object({
  userId: z.string().min(1, "ユーザーが指定されていません"),
})

/** P3-D8: 8文字以上・72バイト以下（bcrypt が 72 バイトを超えた分を無視するため）。強度の決まりは B-199 */
const passwordField = z
  .string()
  .min(8, "パスワードは8文字以上で入力してください")
  .refine((v) => new TextEncoder().encode(v).length <= 72, "パスワードは72バイト以内で入力してください")

const tokenField = z.string().trim().min(1, "リンクが正しくありません").max(200, "リンクが正しくありません")

const PASSWORD_MISMATCH = { message: "確認用のパスワードが一致しません", path: ["passwordConfirm"] }

/** 招待の受諾: トークン＋パスワードと確認（§4-5） */
export const acceptInvitationSchema = z
  .object({ token: tokenField, password: passwordField, passwordConfirm: z.string() })
  .refine((d) => d.password === d.passwordConfirm, PASSWORD_MISMATCH)
export type AcceptInvitationInput = z.input<typeof acceptInvitationSchema>

export const requestPasswordResetSchema = z.object({ email: emailField })

/** 再設定: トークン＋新しいパスワードと確認（§4-6） */
export const resetPasswordSchema = z
  .object({ token: tokenField, password: passwordField, passwordConfirm: z.string() })
  .refine((d) => d.password === d.passwordConfirm, PASSWORD_MISMATCH)
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>
