"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Loader2 } from "lucide-react"
import type { UserRole, UserStatus } from "@prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { changeUserStatus, updateUserRole, type CompanyUserRow } from "@/lib/actions/users"
import { ROLE_LABELS, STATUS_LABELS } from "@/lib/constants/user-roles"
import { isOwner } from "@/lib/permissions"
import {
  USER_STATUS_ACTION_LABELS,
  assignableRolesFor,
  availableStatusActions,
  statusActionNeedsConfirm,
  type UserStatusAction,
} from "@/lib/user-management"

/**
 * B-205 PR-2（spec v1.0 §3-2・§4-6・§4-7）: ユーザーの一覧。文言はモック案B の原文＋R-10 で決めた名前。
 * - 列: 名前／メール／役割／状態／最終ログイン／（操作）。見るだけの人にはメール・最終ログインの列を出さない（D-19）
 * - 役割: 変更できる行はその場のプルダウン（変えた時点で保存・P2-D11）。管理者が見るときは「オーナー」を出さない（P2-D3）
 * - 操作: 有効「停止」／停止「再開」「アーカイブ」／アーカイブ「停止に戻す」／招待中は無し／自分の行は「自分」／管理者から見たオーナーは無し
 * - 「停止」「アーカイブ」は確認を挟む。「＋ ユーザーを招待」「招待を再送」は PR-3（出さない・P2-D12）
 */
const STATUS_BADGE: Record<UserStatus, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  INVITED: "outline",
  SUSPENDED: "secondary",
  ARCHIVED: "outline",
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function UsersTable({
  users,
  canManage,
  actorRole,
  showArchived,
}: {
  users: CompanyUserRow[]
  canManage: boolean
  actorRole: UserRole
  showArchived: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState<{ user: CompanyUserRow; action: UserStatusAction } | null>(null)
  const roleOptions = assignableRolesFor(actorRole)

  const canEditRow = (u: CompanyUserRow) =>
    canManage && !u.isSelf && u.role !== "EXTERNAL" && !(u.role === "OWNER" && !isOwner(actorRole))

  const changeRole = (u: CompanyUserRow, role: string) => {
    startTransition(async () => {
      const r = await updateUserRole({ userId: u.id, role })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`${u.name} の役割を「${ROLE_LABELS[r.data.role]}」にしました`)
      router.refresh()
    })
  }

  const runStatus = (u: CompanyUserRow, action: UserStatusAction) => {
    startTransition(async () => {
      const r = await changeUserStatus({ userId: u.id, action })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`${u.name} を「${STATUS_LABELS[r.data.status]}」にしました`)
      setConfirm(null)
      router.refresh()
    })
  }

  const onAction = (u: CompanyUserRow, action: UserStatusAction) => {
    if (statusActionNeedsConfirm(action)) setConfirm({ user: u, action })
    else runStatus(u, action)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">ユーザー</CardTitle>
        <CardDescription>
          役割のプルダウン：オーナー・管理者・生産管理・経理・営業・デザイナー・一般スタッフ（社外ユーザーは出しません）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-end">
          <Button asChild variant={showArchived ? "secondary" : "outline"} size="sm">
            <Link href={showArchived ? "/settings/users" : "/settings/users?archived=1"}>
              {showArchived ? "アーカイブを隠す" : "アーカイブも表示"}
            </Link>
          </Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                {canManage && <TableHead>メール</TableHead>}
                <TableHead className="w-[170px]">役割</TableHead>
                <TableHead className="w-[100px]">状態</TableHead>
                {canManage && <TableHead className="w-[150px]">最終ログイン</TableHead>}
                <TableHead className="w-[200px] text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 6 : 4} className="py-6 text-center text-sm text-muted-foreground">
                    ユーザーはいません
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const editable = canEditRow(u)
                  const actions = editable ? availableStatusActions(u.status) : []
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="text-sm">{u.name}</TableCell>
                      {canManage && <TableCell className="text-sm">{u.email ?? "—"}</TableCell>}
                      <TableCell className="text-sm">
                        {editable ? (
                          <Select value={u.role} onValueChange={(v) => changeRole(u, v)} disabled={isPending}>
                            <SelectTrigger className="h-8 w-[150px]" aria-label={`${u.name} の役割`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roleOptions.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          ROLE_LABELS[u.role]
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[u.status]}>{STATUS_LABELS[u.status]}</Badge>
                      </TableCell>
                      {canManage && <TableCell className="text-sm tabular-nums">{fmtDateTime(u.lastLoginAt)}</TableCell>}
                      <TableCell className="text-right">
                        {u.isSelf ? (
                          <span className="text-xs text-muted-foreground">自分</span>
                        ) : (
                          <div className="flex justify-end gap-1">
                            {actions.map((a) => (
                              <Button
                                key={a}
                                type="button"
                                size="sm"
                                variant={a === "resume" ? "default" : "outline"}
                                disabled={isPending}
                                onClick={() => onAction(u, a)}
                              >
                                {USER_STATUS_ACTION_LABELS[a]}
                              </Button>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">役割はその場のプルダウンで変えます。「停止」は確認を挟みます。</p>
        {!canManage && <p className="text-xs text-muted-foreground">変更できるのはオーナーと管理者だけです。</p>}
      </CardContent>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {confirm ? `${confirm.user.name} を${USER_STATUS_ACTION_LABELS[confirm.action]}しますか？` : ""}
            </DialogTitle>
            <DialogDescription>
              {confirm?.action === "suspend"
                ? "停止した人は、次に画面を開いたときにログアウトされ、ログインできなくなります。「再開」で戻せます。"
                : "アーカイブした人は一覧から隠れます。「アーカイブも表示」で出し、「停止に戻す」で戻せます。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={isPending} onClick={() => setConfirm(null)}>
              やめる
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={() => confirm && runStatus(confirm.user, confirm.action)}>
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {confirm ? USER_STATUS_ACTION_LABELS[confirm.action] : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
