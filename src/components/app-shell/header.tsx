import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { UserMenu } from "./user-menu"
import { MobileNav } from "./mobile-nav"
import { GlobalSearchTrigger } from "./global-search-dialog"

type Props = {
  user: {
    name: string
    email: string
    role: string
    tenantType: string
    companyName: string
  }
}

export function Header({ user }: Props) {
  return (
    <header className="h-16 border-b bg-background flex items-center justify-between px-3 md:px-6 sticky top-0 z-10 shrink-0">
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {/* B-093 PR-1（D-5）: 768px 未満は ☰ とロゴを出す。会社名は 640px 未満で隠す。「管理者モード」は隠さない */}
        <div className="md:hidden flex items-center gap-1">
          <MobileNav />
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <div className="size-8 rounded-md bg-foreground text-background flex items-center justify-center text-sm font-bold">
              P
            </div>
            <span className="text-sm">PMS</span>
          </Link>
        </div>
        <span className="hidden sm:inline text-sm text-muted-foreground truncate">{user.companyName}</span>
        {user.tenantType === "MASTER_ADMIN" && (
          <Badge variant="secondary" className="text-xs">
            管理者モード
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        {/* B-095: グローバル検索（⌘K で開く・常設） */}
        <GlobalSearchTrigger />
        <UserMenu
          name={user.name}
          email={user.email}
          role={user.role}
          tenantType={user.tenantType}
        />
      </div>
    </header>
  )
}
