"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  suggestCodeFromName,
  type CodeSuggestion,
  type DictEntry,
} from "@/lib/utils/code-suggest"

type Props = {
  /** 入力中の名前 (日本語) */
  name: string
  /** 親コード (未選択時は null)。指定があれば `parent-候補` の組み合わせも提示 */
  parentCode: string | null
  /** ドメイン辞書 (apparel / material / cost など) */
  dict: Record<string, DictEntry>
  /** 候補チップをクリックしたときに呼ばれる */
  onSelect: (code: string) => void
}

/**
 * Phase 1A-17: コードサジェスター 共通 UI 部品 (B-007 回収)
 *
 * 入力された name と (あれば) parentCode から `suggestCodeFromName` で候補を計算し、
 * クリック可能なチップとして描画。
 *
 * - 候補が 0 件 (name 空 or 辞書未収録) なら何も表示しない (現状挙動を踏襲)
 * - 配置: コード入力欄の直下に置く想定
 *
 * 旧 `CategoryCodeSuggester` / `MaterialCategoryCodeSuggester` の共通化版。
 */
export function CodeSuggester({ name, parentCode, dict, onSelect }: Props) {
  const suggestions: CodeSuggestion[] = useMemo(
    () => suggestCodeFromName(name, parentCode, dict),
    [name, parentCode, dict],
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
              ? "親コード + 辞書から生成"
              : "辞書から生成"
          }
        >
          {s.value}
        </Button>
      ))}
    </div>
  )
}
