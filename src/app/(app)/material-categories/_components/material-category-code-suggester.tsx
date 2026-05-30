"use client"

/**
 * Phase 1A-15 で導入、Phase 1A-17 で共通 `<CodeSuggester>` の薄いラッパーに変更 (B-007 回収)。
 *
 * - ロジック・描画はすべて `src/components/code-suggester.tsx` に集約
 * - ドメイン辞書として MATERIAL_TERM_DICT を固定で渡す
 * - 既存呼び出し側 (material-category-form.tsx) の互換性のため props 名は維持
 */
import { CodeSuggester } from "@/components/code-suggester"
import { MATERIAL_TERM_DICT } from "@/lib/constants/code-dicts/material"

type Props = {
  categoryName: string
  parentCategoryCode: string | null
  onSelect: (code: string) => void
}

export function MaterialCategoryCodeSuggester({
  categoryName,
  parentCategoryCode,
  onSelect,
}: Props) {
  return (
    <CodeSuggester
      name={categoryName}
      parentCode={parentCategoryCode}
      dict={MATERIAL_TERM_DICT}
      onSelect={onSelect}
    />
  )
}
