"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  suggestCategoryCode,
  type CategoryCodeSuggestion,
} from "@/lib/utils/category-code-suggest"

type Props = {
  /** 入力中のカテゴリ名（日本語） */
  categoryName: string
  /** 選択中の親カテゴリの categoryCode（未選択時は null） */
  parentCategoryCode: string | null
  /** 候補チップをクリックしたときに呼ばれる */
  onSelect: (code: string) => void
}

/**
 * Phase 1A-14: ProductCategory フォーム用のコードサジェスター
 *
 * 入力された categoryName と選択中の parentCategoryCode から候補を計算し、
 * クリック可能なチップとして表示。候補がない場合は何も表示しない。
 *
 * 配置: categoryCode 入力欄の直下
 */
export function CategoryCodeSuggester({
  categoryName,
  parentCategoryCode,
  onSelect,
}: Props) {
  const suggestions: CategoryCodeSuggestion[] = useMemo(
    () => suggestCategoryCode(categoryName, parentCategoryCode),
    [categoryName, parentCategoryCode],
  )

  if (suggestions.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      <span className="text-xs text-muted-foreground">候補:</span>
      {suggestions.map((s) => (
        <Button
          key={s.value}
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 font-mono text-xs"
          onClick={() => onSelect(s.value)}
          title={
            s.source === "parent-dict"
              ? "親カテゴリ + 辞書から生成"
              : "辞書から生成"
          }
        >
          {s.value}
        </Button>
      ))}
    </div>
  )
}
