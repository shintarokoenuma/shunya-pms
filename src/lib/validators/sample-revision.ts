import { z } from "zod"
import { SampleRevisionType, RevisionRequestor } from "@prisma/client"

/**
 * B-130 PR-C1: サンプル修正記録（SampleRevision）バリデータ。
 * - DB の `status` は enum ではなく VarChar(20) の生文字列。アプリ層で2値に固定する。
 * - photoUrls / attachments / details / revisionWoId は本 PR では扱わない（列は温存）。
 */

export const SAMPLE_REVISION_STATUSES = ["PENDING", "COMPLETED"] as const
export type SampleRevisionStatus = (typeof SAMPLE_REVISION_STATUSES)[number]

/** 修正内容（1〜2000文字・trim 後に空は不可）。 */
const descriptionField = z
  .string()
  .trim()
  .min(1, "修正内容を入力してください")
  .max(2000, "2000文字以内で入力してください")

export const createSampleRevisionSchema = z.object({
  sampleProductionId: z.string().uuid("サンプルの指定が不正です"),
  revisionType: z.nativeEnum(SampleRevisionType),
  requestedBy: z.nativeEnum(RevisionRequestor),
  description: descriptionField,
})

export const updateSampleRevisionSchema = z.object({
  id: z.string().uuid("修正記録の指定が不正です"),
  revisionType: z.nativeEnum(SampleRevisionType),
  requestedBy: z.nativeEnum(RevisionRequestor),
  description: descriptionField,
  status: z.enum(SAMPLE_REVISION_STATUSES),
})

export type CreateSampleRevisionInput = z.infer<typeof createSampleRevisionSchema>
export type UpdateSampleRevisionInput = z.infer<typeof updateSampleRevisionSchema>
