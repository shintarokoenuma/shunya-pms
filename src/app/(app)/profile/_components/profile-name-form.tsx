"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { updateMyProfile, type MyProfile } from "@/lib/actions/profile"

/**
 * B-244（D-2・D-3）: 「名前」のカード。メールと役割は表示だけ（変えられない）。
 * 保存に成功したら router.refresh() で右上の名前がすぐ変わる（jwt が User の行を読み直す）
 */
export function ProfileNameForm({ profile, roleLabel }: { profile: MyProfile; roleLabel: string }) {
  const router = useRouter()
  const [lastName, setLastName] = useState(profile.lastName)
  const [firstName, setFirstName] = useState(profile.firstName)
  const [displayName, setDisplayName] = useState(profile.displayName ?? "")
  const [isPending, startTransition] = useTransition()

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const r = await updateMyProfile({ lastName, firstName, displayName })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("名前を保存しました")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">名前</CardTitle>
        <CardDescription>表示名が空のときは「姓 名」が出ます</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
            <dt className="text-muted-foreground">メール</dt>
            <dd className="break-all">{profile.email}</dd>
            <dt className="text-muted-foreground">役割</dt>
            <dd>{roleLabel}</dd>
          </dl>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="profile-lastName">姓</Label>
              <Input
                id="profile-lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={100}
                required
                disabled={isPending}
                autoComplete="family-name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-firstName">名</Label>
              <Input
                id="profile-firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={100}
                required
                disabled={isPending}
                autoComplete="given-name"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="profile-displayName">表示名（任意）</Label>
            <Input
              id="profile-displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={200}
              placeholder="空なら「姓 名」"
              disabled={isPending}
              autoComplete="nickname"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
