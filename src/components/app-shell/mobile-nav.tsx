"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { SidebarNav } from "./sidebar-nav"

/**
 * B-093 PR-1（D-2〜D-4）: スマートフォン幅（768px 未満）のメニュー。
 * - ヘッダ左の ☰ を押すと、左からパネルが出る（幅 288px・画面の 85% を上限）
 * - 中身は PC と同じ SidebarNav（並び・enabled・hidden を変えない）
 * - 項目を押す（リンクのクリック）／外側のタップ／Esc／ページ移動 で閉じる
 * 表示の切り替え（md:hidden）は呼び出し側（header.tsx）で行う。
 */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // ページを移動したら必ず閉じる（D-3）。
  // effect 内の setState は lint（react-hooks/set-state-in-effect）が禁止するため、
  // React 公式の「描画中に前回値と比べて状態を合わせる」形にする。
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="メニューを開く">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 max-w-[85vw] gap-0 p-0"
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">メニュー</SheetTitle>
        <SheetDescription className="sr-only">画面を選んで移動します</SheetDescription>
        <div className="h-16 flex items-center px-6 border-b shrink-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 font-semibold"
            onClick={() => setOpen(false)}
          >
            <div className="size-8 rounded-md bg-foreground text-background flex items-center justify-center text-sm font-bold">
              P
            </div>
            <span className="text-sm">PMS</span>
          </Link>
        </div>
        {/* 同じページへのリンクでは pathname が変わらないため、リンクのクリックでも閉じる */}
        <div
          className="flex min-h-0 flex-1 flex-col"
          onClickCapture={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false)
          }}
        >
          <SidebarNav />
        </div>
      </SheetContent>
    </Sheet>
  )
}
