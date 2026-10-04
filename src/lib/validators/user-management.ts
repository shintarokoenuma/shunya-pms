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

/** B-253（C-D3）: 招待の取り消し。userId だけ */
export const cancelInvitationSchema = z.object({
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

// =============================================================================
// B-244: 自分のプロフィール
// =============================================================================
const personNameField = (label: string) =>
  z.string().trim().min(1, `${label}は必須です`).max(100, "100文字以内で入力してください")

/** D-2: 姓・名は必須（100文字以内）。表示名は任意（200文字以内・trim して空なら null） */
export const updateMyProfileSchema = z.object({
  lastName: personNameField("姓"),
  firstName: personNameField("名"),
  displayName: z
    .string()
    .trim()
    .max(200, "200文字以内で入力してください")
    .transform((v) => (v === "" ? null : v)),
})
export type UpdateMyProfileInput = z.input<typeof updateMyProfileSchema>

/** D-4: 今のパスワード＋新しいパスワードと確認。新しいものの規則は passwordField と同じ */
export const changeMyPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "今のパスワードを入力してください"),
    password: passwordField,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, PASSWORD_MISMATCH)
export type ChangeMyPasswordInput = z.input<typeof changeMyPasswordSchema>
