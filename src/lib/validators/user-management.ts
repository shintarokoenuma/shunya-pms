import { z } from "zod"
import { ASSIGNABLE_ROLES } from "@/lib/constants/user-roles"

/**
 * B-205 PR-2（§4-6）: ユーザーの役割の変更・状態の変更の入力。
 * - 役割は ASSIGNABLE_ROLES の 7 つだけ（EXTERNAL は受けない・D-14）
 * - 状態の操作は 4 つだけ（P2-D2）
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
