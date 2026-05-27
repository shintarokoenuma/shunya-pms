"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  suggestMaterialCategoryCode,
  type MaterialCategoryCodeSuggestion,
} from "@/lib/utils/material-category-code-suggest"

type Props = {
  categoryName: string
  parentCategoryCode: string | null
  onSelect: (code: string) => void
}

/**
 * Phase 1A-15: MaterialCategory フォーム用のコードサジェスター
 * ProductCategory の CategoryCodeSuggester と同じ構造、辞書のみ差し替え。
 */
export function MaterialCategoryCodeSuggester({
  categoryName,
  parentCategoryCode,
  onSelect,
}: Props) {
  const suggestions: MaterialCategoryCodeSuggestion[] = useMemo(
    () => suggestMaterialCategoryCode(categoryName, parentCategoryCode),
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
              ? "親カテゴリ + 素材辞書から生成"
              : "素材辞書から生成"
          }
        >
          {s.value}
        </Button>
      ))}
    </div>
  )
}
