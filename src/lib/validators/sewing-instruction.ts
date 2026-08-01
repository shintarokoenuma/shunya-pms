import { z } from "zod"
import {
  type SewingInstruction,
  EMPTY_SEWING_INSTRUCTION,
} from "@/lib/types/sewing-instruction"

/**
 * B-094: 縫製指示（Product.sewingInstructions Json）バリデータ。
 * 仕様: docs/specs/b-094-sewing-instruction-spec-confirmation-v1_0-2026-08-01.md §3-4 §4-4
 * - 各 value は trim → 空文字は null に正規化・最大200文字・null 許容。
 * - version は 1 固定（将来の項目追加で 2 に上げる）。
 * - 未知キーは strip（z.object 既定）。Json 全体を置き換える保存（部分更新しない）。
 */

/** 縫製指示の 1 セル。空文字は null に正規化する。 */
const sewingValue = z
  .string()
  .trim()
  .max(200, "200文字以内で入力してください")
  .nullable()
  .transform((v) => (v === "" ? null : v))

export const sewingInstructionInputSchema = z.object({
  version: z.literal(1),
  fixed: z.object({
    namePosition: sewingValue,
    careLabelPosition: sewingValue,
    finishingMethod: sewingValue,
    postProcessing: sewingValue,
    hangTag: sewingValue,
  }),
  sewing: z.object({
    lining: sewingValue,
    thread: sewingValue,
    stitch: sewingValue,
    patternMatching: sewingValue,
    insertion: sewingValue,
    fabricDirection: sewingValue,
  }),
})

export type SewingInstructionInput = z.infer<typeof sewingInstructionInputSchema>

/**
 * 防御的パース。DB の Json（null・旧形・将来 version 2 等）を安全に読む。
 * parse 失敗 or null/undefined は EMPTY_SEWING_INSTRUCTION を返す（画面が落ちないため）。
 */
export function parseSewingInstruction(raw: unknown): SewingInstruction {
  const r = sewingInstructionInputSchema.safeParse(raw)
  return r.success ? r.data : EMPTY_SEWING_INSTRUCTION
}
