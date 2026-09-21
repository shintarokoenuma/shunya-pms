import { z } from "zod"
import { PatternWorkType } from "@prisma/client"

/**
 * B-054/B-146 PR-2（spec v1.0 §5-1 D-11 / D-12）: 型紙の記録（PatternVersion）のバリデータ。
 * - 主役は受領日と種別。version / versionNumber は action 側で自動採番するため validator に入れない。
 * - gradingSizes は文字列配列（空可）。driveFileUrl は URL 形式を緩めに（http(s) で始まれば可）。
 */
const optionalString = (max: number) =>
  z.string().trim().max(max, `${max}文字以内で入力してください`).default("")

const optionalRelationId = z
  .string()
  .nullable()
  .default(null)
  .transform((v) => (v === "" || v === null ? null : v))

export const patternVersionInputSchema = z.object({
  modelCodeId: z.string().min(1, "型番の指定が不正です"),
  receivedAt: z
    .string()
    .trim()
    .min(1, "受領日は必須です")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "受領日の形式が不正です"),
  workType: z.nativeEnum(PatternWorkType),
  hasGrading: z.boolean().default(false),
  gradingSizes: z
    .array(z.string().trim().min(1).max(20))
    .max(30, "サイズは30件までです")
    .default([]),
  revisionNotes: optionalString(10000),
  driveFileUrl: optionalString(500).refine(
    (v) => v === "" || /^https?:\/\//i.test(v),
    "Drive リンクは http(s):// で始めてください",
  ),
  contractorId: optionalRelationId,
})

export type PatternVersionFormValues = z.input<typeof patternVersionInputSchema>
export type PatternVersionInput = z.infer<typeof patternVersionInputSchema>
