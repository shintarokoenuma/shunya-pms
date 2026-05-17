"use client"

import { LogOut, User as UserIcon } from "lucide-react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Props = {
  name: string
  email: string
  role: string
  tenantType: string
}

export function UserMenu({ name, email, role, tenantType }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-3 h-auto py-1.5 px-2">
          <div className="size-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-medium">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-sm font-medium leading-tight">{name}</div>
            <div className="text-xs text-muted-foreground leading-tight mt-0.5">
              {email}
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {tenantType} / {role}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserIcon className="mr-2 size-4" />
          プロフィール
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <LogOut className="mr-2 size-4" />
          ログアウト
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
