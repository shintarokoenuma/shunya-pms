/**
 * Phase 1A-15 で導入、Phase 1A-17 で共通化 (B-007 回収) に伴い薄い re-export シムに変更。
 *
 * ロジックは `src/lib/utils/code-suggest.ts` の `suggestCodeFromName` に統合。
 * 辞書 `MATERIAL_TERM_DICT` は `src/lib/constants/code-dicts/material.ts` に移設。
 * 既存呼び出し側 (MaterialCategory フォーム) の後方互換のためここでも公開。
 */

import {
  suggestCodeFromName,
  type CodeSuggestion,
} from "@/lib/utils/code-suggest"
import { MATERIAL_TERM_DICT } from "@/lib/constants/code-dicts/material"

export { MATERIAL_TERM_DICT }

/** @deprecated 1A-17 以降は `CodeSuggestion` を直接使ってください */
export type MaterialCategoryCodeSuggestion = CodeSuggestion

/** @deprecated 1A-17 以降は `suggestCodeFromName(name, parent, MATERIAL_TERM_DICT)` を使ってください */
export function suggestMaterialCategoryCode(
  categoryName: string,
  parentCategoryCode: string | null | undefined,
  maxResults = 3,
): CodeSuggestion[] {
  return suggestCodeFromName(
    categoryName,
    parentCategoryCode,
    MATERIAL_TERM_DICT,
    maxResults,
  )
}
