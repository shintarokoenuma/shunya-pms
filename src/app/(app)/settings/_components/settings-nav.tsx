"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * B-205（spec v1.0 §3-1・案B）: 設定ページの左の目次。768px 未満では上に横並び（B-093 の考え）。
 * PR-2（P2-D8）: 出す項目は layout が役割と「役割と権限」から決めて props で渡す（隠した項目は目次に出さない）。
 */
export type SettingsNavItem = { href: string; label: string; hint: string }

export function SettingsNav({ items }: { items: SettingsNavItem[] }) {
  const pathname = usePathname()
  return (
    <nav aria-label="設定の目次" className="md:w-56 md:shrink-0">
      <ul className="flex gap-1 overflow-x-auto md:flex-col md:gap-1">
        {items.map((item) => {
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
