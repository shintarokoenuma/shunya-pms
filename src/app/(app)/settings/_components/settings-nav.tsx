"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * B-205 PR-1（spec v1.0 §3-1・案B）: 設定ページの左の目次。768px 未満では上に横並び（B-093 の考え）。
 * PR-1 は 自社情報・振込先・表示設定 の 3 つ（「ユーザー」「役割と権限」は PR-2 で足す・P1-D4）。
 */
export const SETTINGS_NAV_ITEMS: { href: string; label: string; hint: string }[] = [
  { href: "/settings/company", label: "自社情報", hint: "帳票に載る情報" },
  { href: "/settings/bank", label: "振込先", hint: "請求書に載る口座" },
  { href: "/settings/display", label: "表示設定", hint: "品番カルテのメモ" },
]

export function SettingsNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="設定の目次" className="md:w-56 md:shrink-0">
      <ul className="flex gap-1 overflow-x-auto md:flex-col md:gap-1">
        {SETTINGS_NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50",
                )}
              >
                <span className="block">{item.label}</span>
                <span className="block text-xs text-muted-foreground">{item.hint}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
