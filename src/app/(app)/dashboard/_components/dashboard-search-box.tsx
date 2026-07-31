"use client"

import { Search } from "lucide-react"
import { OPEN_GLOBAL_SEARCH_EVENT } from "@/components/app-shell/global-search-dialog"

/**
 * B-095 Part3: ダッシュボードの大きめ検索ボックス。
 * クリックで共通イベントを発火し、ヘッダのコマンドパレット（Part2）を開く
 * （検索ロジックはパレット側に一本化・二重実装しない）。
 */
export function DashboardSearchBox() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_GLOBAL_SEARCH_EVENT))}
      aria-label="検索を開く"
      className="flex w-full items-center gap-3 rounded-lg border bg-background px-4 py-3 text-left text-muted-foreground shadow-sm transition-colors hover:bg-accent"
    >
      <Search className="h-5 w-5 shrink-0" />
      <span className="flex-1 text-sm">
        品番・見積・発注・サンプル・マスターを検索…
      </span>
      <kbd className="hidden items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] sm:inline-flex">
        ⌘K
      </kbd>
    </button>
  )
}
