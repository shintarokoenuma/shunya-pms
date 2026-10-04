"use client"

import { useState, useTransition } from "react"
import { signOut } from "next-auth/react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { changeMyPassword } from "@/lib/actions/profile"

/**
 * B-244（D-4・D-5）: 「パスワード」のカード。今のパスワード・新しいパスワード・確認の3欄（目のボタンで3欄まとめて表示／非表示）。
 * 成功したら signOut → /login?passwordChanged=1（ほかの端末は jwt の判定で切れる）
 */
export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setShow(false)
    startTransition(async () => {
      const r = await changeMyPassword({ currentPassword, password, passwordConfirm })
      if (!r.ok) {
        setError(r.error)
        return
      }
      await signOut({ callbackUrl: "/login?passwordChanged=1" })
    })
  }

  const type = show ? "text" : "password"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">パスワード</CardTitle>
        <CardDescription>変更すると、この端末もほかの端末もログインし直しになります</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="profile-currentPassword">今のパスワード</Label>
            <div className="relative">
              <Input
                id="profile-currentPassword"
                type={type}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={isPending}
                className="pr-11"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "パスワードを隠す" : "パスワードを表示"}
                aria-pressed={show}
                disabled={isPending}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="profile-password">新しいパスワード</Label>
            <Input
              id="profile-password"
              type={type}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={isPending}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">8文字以上。目のボタンで3欄とも表示／非表示を切り替えられます</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="profile-passwordConfirm">新しいパスワード（確認）</Label>
            <Input
              id="profile-passwordConfirm"
              type={type}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              minLength={8}
              disabled={isPending}
              autoComplete="new-password"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              パスワードを変更する
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
