import { Badge } from "@/components/ui/badge"
import { UserMenu } from "./user-menu"

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
    <header className="h-16 border-b bg-background flex items-center justify-between px-6 sticky top-0 z-10 shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{user.companyName}</span>
        {user.tenantType === "MASTER_ADMIN" && (
          <Badge variant="secondary" className="text-xs">
            MASTER_ADMIN
          </Badge>
        )}
      </div>
      <UserMenu
        name={user.name}
        email={user.email}
        role={user.role}
        tenantType={user.tenantType}
      />
    </header>
  )
}
