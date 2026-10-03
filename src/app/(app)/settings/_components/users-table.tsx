"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Loader2, UserPlus } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cancelInvitation, changeUserStatus, inviteUser, resendInvitation, updateUserRole, type CompanyUserRow } from "@/lib/actions/users"
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
 * - 操作: 有効「停止」／停止「再開」「アーカイブ」／アーカイブ「停止に戻す」／自分の行は「自分」／管理者から見たオーナーは無し
 * - 「停止」「アーカイブ」は確認を挟む
 * B-205 PR-3（§4-4・P2-D12・P3-D15）: 「＋ ユーザーを招待」（オーナー・管理者だけ・ダイアログ）と、招待中の行の「招待を再送」（確認は挟まない）。
 * 招待中の行には最後に送った日時と期限を小さく出す。
 * B-253（C-D1〜C-D3）: 招待中の行に「招待を取り消す」（確認を挟む・「停止」「アーカイブ」と同じ部品）。取り消すと一覧から消える
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

/** 招待の期限の見せ方: 「3日後まで有効」「5時間後まで有効」「期限切れ」 */
function fmtInviteExpiry(expiresAtIso: string, now: Date): string {
  const ms = new Date(expiresAtIso).getTime() - now.getTime()
  if (ms <= 0) return "期限切れ"
  const hours = Math.ceil(ms / (60 * 60 * 1000))
  if (hours < 24) return `${hours}時間後まで有効`
  return `${Math.ceil(hours / 24)}日後まで有効`
}

type InviteForm = { lastName: string; firstName: string; email: string; role: string }
const EMPTY_INVITE: InviteForm = { lastName: "", firstName: "", email: "", role: "STAFF" }

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
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invite, setInvite] = useState<InviteForm>(EMPTY_INVITE)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<CompanyUserRow | null>(null)
  const roleOptions = assignableRolesFor(actorRole)
  const now = new Date()

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

  // B-205 PR-3: 招待
  const submitInvite = (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError(null)
    startTransition(async () => {
      const r = await inviteUser(invite)
      if (!r.ok) {
        setInviteError(r.error)
        return
      }
      toast.success(`${invite.lastName} ${invite.firstName} に招待メールを送りました`)
      setInviteOpen(false)
      setInvite(EMPTY_INVITE)
      router.refresh()
    })
  }

  // B-253: 招待の取り消し（確認を挟む）
  const runCancel = (u: CompanyUserRow) => {
    startTransition(async () => {
      const r = await cancelInvitation({ userId: u.id })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`${u.name} への招待を取り消しました`)
      setCancelTarget(null)
      router.refresh()
    })
  }

  // B-205 PR-3: 招待の再送（確認は挟まない）
  const resend = (u: CompanyUserRow) => {
    startTransition(async () => {
      const r = await resendInvitation({ userId: u.id })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("招待メールを送り直しました")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">ユーザー</CardTitle>
            <CardDescription>
              役割のプルダウン：オーナー・管理者・生産管理・経理・営業・デザイナー・一般スタッフ（社外ユーザーは出しません）
            </CardDescription>
          </div>
          {canManage && (
            <Button type="button" size="sm" onClick={() => setInviteOpen(true)} disabled={isPending}>
              <UserPlus className="mr-1 h-4 w-4" />
              ユーザーを招待
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-end">
          <Button asChild variant={showArchived ? "secondary" : "outline"} size="sm">
            <Link href={showArchived ? "/settings/users" : "/settings/users?archived=1"}>
              {showArchived ? "アーカイブを隠す" : "アーカイブも表示"}
            </Link>
          </Button>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                {canManage && <TableHead>メール</TableHead>}
                <TableHead className="w-[150px]">役割</TableHead>
                <TableHead className="w-[140px]">状態</TableHead>
                {canManage && <TableHead className="w-[150px]">最終ログイン</TableHead>}
                <TableHead className="text-right" />
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
                  const canResend = editable && u.status === "INVITED"
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="max-w-[150px] truncate text-sm" title={u.name}>
                        {u.name}
                      </TableCell>
                      {canManage && (
                        <TableCell className="max-w-[180px] truncate text-sm" title={u.email ?? undefined}>
                          {u.email ?? "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-sm">
                        {editable ? (
                          <Select value={u.role} onValueChange={(v) => changeRole(u, v)} disabled={isPending}>
                            {/* B-253 追加: 表示する文字を直接渡す（hydration のずれで Radix の自動表示が空欄になるため・拡張機能 Feedly で再現） */}
                            <SelectTrigger className="h-8 w-[130px]" aria-label={`${u.name} の役割`}>
                              <SelectValue>{ROLE_LABELS[u.role]}</SelectValue>
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
                        {u.status === "INVITED" && canManage && (
                          <div className="mt-1 text-[11px] leading-tight text-muted-foreground" title={u.invite ? `期限: ${fmtDateTime(u.invite.expiresAt)}` : undefined}>
                            {u.invite ? (
                              <>
                                送信 {fmtDateTime(u.invite.sentAt)}
                                <br />
                                {fmtInviteExpiry(u.invite.expiresAt, now)}
                              </>
                            ) : (
                              "有効な招待なし"
                            )}
                          </div>
                        )}
                      </TableCell>
                      {canManage && <TableCell className="text-sm tabular-nums">{fmtDateTime(u.lastLoginAt)}</TableCell>}
                      <TableCell className="text-right">
                        {u.isSelf ? (
                          <span className="text-xs text-muted-foreground">自分</span>
                        ) : (
                          <div className="flex justify-end gap-1">
                            {canResend && (
                              <div className="flex flex-col items-end gap-1">
                                <Button type="button" size="sm" variant="outline" className="w-[120px]" disabled={isPending} onClick={() => resend(u)}>
                                  招待を再送
                                </Button>
                                <Button type="button" size="sm" variant="outline" className="w-[120px]" disabled={isPending} onClick={() => setCancelTarget(u)}>
                                  招待を取り消す
                                </Button>
                              </div>
                            )}
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
        <p className="text-xs text-muted-foreground">
          役割はその場のプルダウンで変えます。招待中の行は「招待を再送」「招待を取り消す」ができます。「停止」「アーカイブ」「招待を取り消す」は確認を挟みます。
        </p>
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

      {/* B-253（§1 の文言）: 招待の取り消しの確認 */}
      <Dialog open={cancelTarget !== null} onOpenChange={(open) => !open && !isPending && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              招待を取り消しますか？
            </DialogTitle>
            <DialogDescription>
              {cancelTarget
                ? `${cancelTarget.name}（${cancelTarget.email ?? ""}）への招待を取り消します。送ったリンクは使えなくなり、一覧から消えます。同じアドレスには、あとから招待し直せます。`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={isPending} onClick={() => setCancelTarget(null)}>
              戻る
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={() => cancelTarget && runCancel(cancelTarget)}>
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              招待を取り消す
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* B-205 PR-3（§4-4）: 招待のダイアログ。役割は assignableRolesFor（管理者には「オーナー」を出さない・P2-D3） */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setInviteOpen(false)
            setInviteError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submitInvite} className="space-y-4">
            <DialogHeader>
              <DialogTitle>ユーザーを招待</DialogTitle>
              <DialogDescription>招待メールのリンクから、本人がパスワードを決めて有効になります。</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="invite-lastName">姓</Label>
                <Input
                  id="invite-lastName"
                  value={invite.lastName}
                  onChange={(e) => setInvite({ ...invite, lastName: e.target.value })}
                  required
                  maxLength={100}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite-firstName">名</Label>
                <Input
                  id="invite-firstName"
                  value={invite.firstName}
                  onChange={(e) => setInvite({ ...invite, firstName: e.target.value })}
                  required
                  maxLength={100}
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-email">メールアドレス</Label>
              <Input
                id="invite-email"
                type="email"
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                required
                maxLength={255}
                disabled={isPending}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-role">役割</Label>
              <Select value={invite.role} onValueChange={(v) => setInvite({ ...invite, role: v })} disabled={isPending}>
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue>{invite.role ? ROLE_LABELS[invite.role as UserRole] : undefined}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isPending} onClick={() => setInviteOpen(false)}>
                やめる
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                招待メールを送る
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
