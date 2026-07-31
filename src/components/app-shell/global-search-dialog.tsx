"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  globalSearch,
  type GlobalSearchItem,
  type GlobalSearchCategory,
} from "@/lib/actions/global-search"

/** ダッシュボード等からパレットを開くための共通イベント名。 */
export const OPEN_GLOBAL_SEARCH_EVENT = "open-global-search"

const CATEGORY_LABELS: Record<GlobalSearchCategory, string> = {
  product: "品番",
  estimate: "見積",
  order: "発注",
  sample: "サンプル",
  master: "マスター",
}
const CATEGORY_ORDER: GlobalSearchCategory[] = [
  "product",
  "estimate",
  "order",
  "sample",
  "master",
]

export function GlobalSearchTrigger() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<GlobalSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const reqId = useRef(0)

  // Cmd+K / Ctrl+K でトグル、ダッシュボードからのカスタムイベントで開く。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_GLOBAL_SEARCH_EVENT, onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_GLOBAL_SEARCH_EVENT, onOpen)
    }
  }, [])

  // 開閉。閉じるときに状態リセット（同期 setState はイベントハンドラで行う）。
  const handleOpenChange = useCallback((v: boolean) => {
    setOpen(v)
    if (!v) {
      setQuery("")
      setItems([])
      setLoading(false)
    }
  }, [])

  // 入力変更（ローディング/リセットの即時反映はイベントハンドラで）。
  const onQueryChange = useCallback((v: string) => {
    setQuery(v)
    if (v.trim().length < 2) {
      setItems([])
      setLoading(false)
    } else {
      setLoading(true)
    }
  }, [])

  // 300ms デバウンスで globalSearch（setState は setTimeout コールバック内のみ）。
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    const id = ++reqId.current
    const t = setTimeout(async () => {
      try {
        const res = await globalSearch(q)
        if (id === reqId.current) setItems(res)
      } finally {
        if (id === reqId.current) setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const go = useCallback(
    (url: string) => {
      setOpen(false)
      router.push(url)
    },
    [router],
  )

  // カテゴリごとにグルーピング（globalSearch の返却順＝プレフィックス優先を尊重）。
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat],
    rows: items.filter((it) => it.category === cat),
  })).filter((g) => g.rows.length > 0)
  // プレフィックス優先で先頭に来たカテゴリを保つため、items の最初のカテゴリを先頭に。
  const firstCat = items[0]?.category
  grouped.sort((a, b) =>
    a.cat === firstCat ? -1 : b.cat === firstCat ? 1 : 0,
  )

  const showEmpty = query.trim().length >= 2 && !loading && items.length === 0

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="検索"
        className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
      >
        <Search className="h-4 w-4" />
        <span>検索</span>
        <kbd className="ml-2 hidden items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false}>
          <DialogTitle className="sr-only">グローバル検索</DialogTitle>
          <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:text-muted-foreground">
            <CommandInput
              value={query}
              onValueChange={onQueryChange}
              placeholder="品番・見積・発注・サンプル・マスターを検索（PO-2026-0005 等）"
            />
            <CommandList className="max-h-[60vh]">
              {query.trim().length < 2 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  2 文字以上で検索します。
                </div>
              )}
              {loading && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  検索中…
                </div>
              )}
              {showEmpty && <CommandEmpty>見つかりませんでした</CommandEmpty>}
              {grouped.map((g) => (
                <CommandGroup key={g.cat} heading={g.label}>
                  {g.rows.map((it) => (
                    <CommandItem
                      key={`${it.category}:${it.id}`}
                      value={`${it.category}:${it.id}`}
                      onSelect={() => go(it.url)}
                      className="flex flex-col items-start gap-0.5"
                    >
                      <span className="font-medium">{it.title}</span>
                      {it.subtitle && (
                        <span className="text-xs text-muted-foreground">
                          {it.subtitle}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
