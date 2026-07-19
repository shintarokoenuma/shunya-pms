"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { Crumb } from "@/lib/nav/breadcrumb"

/**
 * B-078-1: 共有パンくず（ツリー表示）。各ページで segments を組んで渡す（手書き重複禁止）。
 * 最後のセグメント（href なし）が現在地。
 */
export function EntityBreadcrumb({ segments }: { segments: Crumb[] }) {
  if (segments.length === 0) return null
  return (
    <nav
      aria-label="パンくず"
      className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
    >
      {segments.map((s, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
          )}
          {s.href ? (
            <Link
              href={s.href}
              className="font-mono hover:text-foreground hover:underline"
            >
              {s.label}
            </Link>
          ) : (
            <span className="font-mono font-medium text-foreground">
              {s.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  )
}
