import Link from "next/link"
import { SidebarNav } from "./sidebar-nav"

export function Sidebar() {
  return (
    // B-093 PR-1（D-2）: 768px 未満はサイドバーを隠し、ヘッダの ☰（MobileNav）から出す
    <aside className="hidden md:flex w-64 shrink-0 border-r bg-card flex-col h-screen sticky top-0">
      <div className="h-16 flex items-center px-6 border-b shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 font-semibold"
        >
          <div className="size-8 rounded-md bg-foreground text-background flex items-center justify-center text-sm font-bold">
            P
          </div>
          <span className="text-sm">PMS</span>
        </Link>
      </div>
      <SidebarNav />
      <div className="border-t px-4 py-3 text-xs text-muted-foreground shrink-0">
        Phase 0 完了
      </div>
    </aside>
  )
}
