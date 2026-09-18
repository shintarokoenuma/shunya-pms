import { z } from "zod"
import {
  MEMO_UI_PREFERENCES_DEFAULT,
  type MemoUiPreferences,
} from "@/lib/types/ui-preferences"

/**
 * B-202 PR-4: CompanySetting.uiPreferences のうち productKarte.memo.* を安全に読む／更新入力を検証する。
 * - 読み: 未知のキーは無視し、欠けているキーは既定で埋める（壊れた Json でも既定に倒す）。
 * - 更新の入力: 3つの boolean のみ。
 */
const memoUiPreferencesSchema = z
  .object({
    showTimestamp: z.boolean().default(MEMO_UI_PREFERENCES_DEFAULT.showTimestamp),
    showAuthor: z.boolean().default(MEMO_UI_PREFERENCES_DEFAULT.showAuthor),
    showEditedMark: z.boolean().default(MEMO_UI_PREFERENCES_DEFAULT.showEditedMark),
  })
  .strip()

/** uiPreferences(Json) 全体から productKarte.memo を取り出して既定で埋める。形が違えば既定。 */
export function readMemoUiPreferences(raw: unknown): MemoUiPreferences {
  const memo = (raw as { productKarte?: { memo?: unknown } } | null)?.productKarte?.memo
  const parsed = memoUiPreferencesSchema.safeParse(memo ?? {})
  return parsed.success ? parsed.data : { ...MEMO_UI_PREFERENCES_DEFAULT }
}

export const updateMemoUiPreferencesSchema = z.object({
  showTimestamp: z.boolean(),
  showAuthor: z.boolean(),
  showEditedMark: z.boolean(),
})

export type UpdateMemoUiPreferencesInput = z.infer<typeof updateMemoUiPreferencesSchema>
