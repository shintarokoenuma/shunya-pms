"use client"

/**
 * Phase 1A-14 で導入、Phase 1A-17 で共通 `<CodeSuggester>` の薄いラッパーに変更 (B-007 回収)。
 *
 * - ロジック・描画はすべて `src/components/code-suggester.tsx` に集約
 * - ドメイン辞書として APPAREL_TERM_DICT を固定で渡す
 * - 既存呼び出し側 (product-category-form.tsx) の互換性のため props 名は維持
 */
import { CodeSuggester } from "@/components/code-suggester"
import { APPAREL_TERM_DICT } from "@/lib/constants/code-dicts/apparel"

type Props = {
  /** 入力中のカテゴリ名 (日本語) */
  categoryName: string
  /** 選択中の親カテゴリの categoryCode (未選択時は null) */
  parentCategoryCode: string | null
  /** 候補チップをクリックしたときに呼ばれる */
  onSelect: (code: string) => void
}

export function CategoryCodeSuggester({
  categoryName,
  parentCategoryCode,
  onSelect,
}: Props) {
  return (
    <CodeSuggester
      name={categoryName}
      parentCode={parentCategoryCode}
      dict={APPAREL_TERM_DICT}
      onSelect={onSelect}
    />
  )
}
