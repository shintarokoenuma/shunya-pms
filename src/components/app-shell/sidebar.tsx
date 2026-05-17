import Link from "next/link"
import { SidebarNav } from "./sidebar-nav"

export function Sidebar() {
  return (
    <aside className="w-64 shrink-0 border-r bg-card flex flex-col h-screen sticky top-0">
      <div className="h-16 flex items-center px-6 border-b shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 font-semibold"
        >
          <div className="size-8 rounded-md bg-foreground text-background flex items-center justify-center text-sm font-bold">
            S
          </div>
          <span className="text-sm">shunya PMS</span>
        </Link>
      </div>
      <SidebarNav />
      <div className="border-t px-4 py-3 text-xs text-muted-foreground shrink-0">
        Phase 0 完了
      </div>
    </aside>
  )
}
