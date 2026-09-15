"use client"

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * B-202 PR-1r: 品番カルテの「横1列のボタンバー ＋ 共有パネル1枚」。
 * 一次資料: モック「品番カルテ 3案」案C（addendum v0.3 §0 の URL・§1-1 の原文引用）
 *   - `.drawerbar` に6つの chip、`#drawer` は1枚だけ。chip を押すと title / body を差し替えて表示する。
 *   - 閉じるのは「閉じる」ボタンのみ（chip の再押下では閉じない＝モックどおり）。
 * 仕様: addendum v0.3 D-2r / Q5r / D-13
 *   - 同時に開くのは1つ（openId を1つだけ持つ）。中身はパネルの内側でスクロール。開閉状態は URL に持たない。
 * ★既存の深リンク `/products/[id]#orders`（発注生成後の着地先）が閉じたパネルの中に着地しないよう、
 *   hash と一致する `hashTargets` を持つグループを初回だけ開く（useSyncExternalStore で購読・SSR 時は閉じて描く・
 *   effect 内で setState はしない）。利用者が開閉した後は利用者の選択が優先される。
 * 中身（children）は Server Component をそのまま受ける（Next docs「Interleaving」の slot パターン）。
 */

export type KarteDrawerGroup = {
  /** グループの識別子（モックの data-drawer に相当: bom / est / ord / docs / mark / meta） */
  id: string
  title: string
  /** チップに添える短い注記（任意） */
  hint?: string
  /** このグループを初回に開く hash（先頭 # なし）。例: ["orders"] */
  hashTargets?: string[]
  children: ReactNode
}

/** URL の hash（先頭 # なし）を購読する。SSR 時は "" ＝ パネルは閉じて描く。 */
function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}
const getHash = () => window.location.hash.replace(/^#/, "")
const getServerHash = () => ""

export function KarteDrawerBar({ groups }: { groups: KarteDrawerGroup[] }) {
  const hash = useSyncExternalStore(subscribeHash, getHash, getServerHash)
  // undefined = まだ利用者が開閉していない（hash 由来の初期状態を使う）
  const [userOpenId, setUserOpenId] = useState<string | null | undefined>(
    undefined,
  )
  const hashOpenId =
    groups.find((g) => g.id === hash || g.hashTargets?.includes(hash))?.id ??
    null
  const openId = userOpenId === undefined ? hashOpenId : userOpenId
  const open = groups.find((g) => g.id === openId) ?? null

  // hash 起点で開いたときだけ、パネルまでスクロールする（DOM の更新のみ・setState はしない）
  useEffect(() => {
    if (!open || userOpenId !== undefined || open.id !== hashOpenId) return
    document
      .getElementById("karte-drawer")
      ?.scrollIntoView({ block: "start" })
  }, [open, hashOpenId, userOpenId])

  return (
    <div>
      {/* ボタンバー（モック .drawerbar） */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 border bg-muted/40 px-4 py-2.5",
          open ? "rounded-t-xl" : "rounded-xl",
        )}
      >
        <span className="mr-1 text-xs text-muted-foreground">開いて見る：</span>
        {groups.map((g) => {
          const active = openId === g.id
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={active}
              onClick={() => setUserOpenId(g.id)}
              className={cn(
                "rounded-md border bg-background px-3 py-1.5 text-sm text-foreground/80 transition-colors",
                "hover:border-primary hover:text-primary",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                active && "border-primary text-primary",
              )}
            >
              {g.title}
              {g.hint && (
                <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                  {g.hint}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 共有パネル1枚（モック #drawer） */}
      {open && (
        <section
          id="karte-drawer"
          aria-label={open.title}
          className="rounded-b-xl border border-t-0 bg-card p-4 text-card-foreground"
        >
          <header className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-sm font-medium">{open.title}</h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUserOpenId(null)}
            >
              <X className="mr-1 h-4 w-4" />
              閉じる
            </Button>
          </header>
          <div className="max-h-[70vh] overflow-x-auto overflow-y-auto">
            {open.children}
          </div>
        </section>
      )}
    </div>
  )
}
