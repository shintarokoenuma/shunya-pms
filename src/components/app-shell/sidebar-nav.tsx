"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { NAV_SECTIONS } from "./nav-items"

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
      {NAV_SECTIONS.map((section, idx) => (
        <div key={idx}>
          {section.label && (
            <h3 className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {section.label}
            </h3>
          )}
          <ul className="space-y-1">
            {section.items
              .filter((item) => !item.hidden)
              .map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/")

              if (!item.enabled) {
                return (
                  <li key={item.href}>
                    <div
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/50 cursor-not-allowed select-none"
                      title="後続フェーズで有効化"
                    >
                      {Icon && <Icon className="size-4 shrink-0" />}
                      <span className="truncate">{item.label}</span>
                    </div>
                  </li>
                )
              }

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-foreground hover:bg-accent/50"
                    )}
                  >
                    {Icon && <Icon className="size-4 shrink-0" />}
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
