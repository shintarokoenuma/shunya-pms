"use client"

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

/**
 * B-202 PR-1: 品番カルテの「下開きの引き出し」。
 * 仕様: docs/specs/b-202-spec-addendum-v0_1-2026-09-13.md Q5
 * - 同時に開くのは1つ（親が openId を1つだけ持つ）。
 * - 中身は引き出しの内側でスクロール（max-height + overflow-y）。横長の表は overflow-x。
 * - 開閉状態は URL に持たせない（ローカル state のみ）。
 * - ★既存の深リンク（例: 発注生成後の `/products/[id]#orders`）が閉じた引き出しの中に
 *   着地しないよう、初回マウント時に hash と一致する引き出しだけ開く。
 * - 中身（children）は Server Component をそのまま受ける（Next docs「Interleaving」の slot パターン）。
 */

export type KarteDrawerItem = {
  /** 引き出しの識別子。深リンクの hash（`#orders` など）と一致させる。 */
  id: string
  title: string
  children: ReactNode
}

/** URL の hash（先頭 # なし）を購読する。SSR 時は "" ＝ 引き出しはすべて閉じて描く。 */
function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}
const getHash = () => window.location.hash.replace(/^#/, "")
const getServerHash = () => ""

export function KarteDrawers({ items }: { items: KarteDrawerItem[] }) {
  const hash = useSyncExternalStore(subscribeHash, getHash, getServerHash)
  // undefined = まだ利用者が開閉していない（hash 由来の初期状態を使う）
  const [userOpenId, setUserOpenId] = useState<string | null | undefined>(
    undefined,
  )
  const hashOpenId = items.some((it) => it.id === hash) ? hash : null
  const openId = userOpenId === undefined ? hashOpenId : userOpenId

  // hash 起点で開いたときは、その引き出しまでスクロールする（外部システム＝DOM の更新のみ・setState はしない）
  useEffect(() => {
    if (!openId || openId !== hash) return
    document
      .getElementById(`drawer-${openId}`)
      ?.scrollIntoView({ block: "start" })
  }, [openId, hash])

  return (
    <div className="space-y-2">
      {items.map((it) => {
        const open = openId === it.id
        return (
          <Collapsible
            key={it.id}
            open={open}
            onOpenChange={(next) => setUserOpenId(next ? it.id : null)}
          >
            <div
              id={`drawer-${it.id}`}
              className="rounded-xl border bg-card text-card-foreground shadow-sm"
            >
              <CollapsibleTrigger
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-base font-medium",
                  "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span>{it.title}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-180",
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="max-h-[70vh] overflow-x-auto overflow-y-auto border-t p-4">
                  {it.children}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )
      })}
    </div>
  )
}
