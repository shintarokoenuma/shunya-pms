import { z } from "zod"
import {
  TEXTILE_PATTERN_STATUS_VALUES,
  type TextilePatternStatusValue,
} from "@/lib/types/textile-pattern"

/**
 * B-066: 柄マスター（TextilePattern・層2）バリデータ。
 * 仕様: docs/specs/b-066-textile-pattern-master-spec-confirmation-v1_1-2026-06-17.md §4/§5
 * - patternNumber は D#（"BD-A" 形式）。種別 typeCode + "-" + 英字枝番を想定するが厳密な
 *   形式チェックは強制しない（手振り・将来の枝番拡張余地）。VarChar(10)・@@unique([companyId, patternNumber])。
 * - patternName 必須・手入力呼称。
 * - typeId は TextilePatternType への緩い参照（任意・null 可）。
 * - sortOrder 任意（actions 層で末尾＝既存最大+10 補完）。status は VarChar(20)・enum 化しない。
 */

const optionalRelationId = z
  .string()
  .nullable()
  .default(null)
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null))

export { TEXTILE_PATTERN_STATUS_VALUES }
export type { TextilePatternStatusValue }

export const textilePatternInputSchema = z.object({
  patternNumber: z
    .string()
    .trim()
    .min(1, "柄番号(D#)は必須です")
    .max(10, "10文字以内で入力してください"),
  patternName: z
    .string()
    .trim()
    .min(1, "柄名は必須です")
    .max(100, "100文字以内で入力してください"),
  typeId: optionalRelationId,
  sortOrder: z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => {
      if (v === "" || v === null || v === undefined) return null
      const n = typeof v === "number" ? v : Number(v)
      return Number.isFinite(n) ? Math.trunc(n) : null
    })
    .refine((v) => v === null || v >= 0, "0以上の整数で入力してください")
    .nullable()
    .default(null),
  status: z.enum(TEXTILE_PATTERN_STATUS_VALUES).default("ACTIVE"),
})

export type TextilePatternFormValues = z.input<typeof textilePatternInputSchema>
export type TextilePatternInput = z.infer<typeof textilePatternInputSchema>
