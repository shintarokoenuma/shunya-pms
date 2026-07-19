"use client"

import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { SECTION_ACCENTS, sectionAccentForPath } from "@/lib/constants/section-accents"

/**
 * B-078-3: 現在ページの系統（マスター/案件/取引）を薄い色帯で示すヘッダー帯。
 * AppShell の main 上端に1つだけ置く（各ページで手書きしない）。
 */
export function PageAccentBar() {
  const pathname = usePathname()
  const key = sectionAccentForPath(pathname)
  if (key === "neutral") return null
  return (
    <div
      aria-hidden
      // Header（h-16・sticky top-0）直下にスクロール固定。帯が常に Header 下に貼り付く。
      className={cn(
        "sticky top-16 z-10 h-1 w-full shrink-0",
        SECTION_ACCENTS[key].bar,
      )}
    />
  )
}
