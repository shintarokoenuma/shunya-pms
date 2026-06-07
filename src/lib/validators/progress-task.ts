import { z } from "zod"
import { ProgressTaskStatus, ProgressTaskAssigneeType } from "@prisma/client"

/**
 * S-3: 進行チェックリスト（ProgressTask）バリデータ
 * 採番なし・生成系が主役。単票 create は無く、status 手動チェックと付随情報更新が中心。
 */

export const updateTaskStatusSchema = z.object({
  status: z.nativeEnum(ProgressTaskStatus),
})
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>

export const updateTaskSchema = z.object({
  notes: z
    .string()
    .max(10000, "10000文字以内で入力してください")
    .nullable()
    .optional(),
  isReceived: z.boolean().nullable().optional(),
  assigneeType: z.nativeEnum(ProgressTaskAssigneeType).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
})
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>

export const addProcessingTasksSchema = z.object({
  processingTypeIds: z
    .array(z.string().min(1))
    .min(1, "加工種別を1つ以上選択してください"),
})
export type AddProcessingTasksInput = z.infer<typeof addProcessingTasksSchema>
