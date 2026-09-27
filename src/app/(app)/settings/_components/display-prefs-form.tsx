"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { updateMemoUiPreferences } from "@/lib/actions/company-settings"
import type { MemoUiPreferences } from "@/lib/types/ui-preferences"

/**
 * B-205 PR-1（spec v1.0 D-10・§3-2）: 「表示設定」のカード（品番カルテのメモ）。
 * 品番カルテの歯車（memo-section.tsx の MemoPrefsDialog）と同じ設定（CompanySetting.uiPreferences.productKarte.memo.*）を、
 * 同じ action（updateMemoUiPreferences）で保存する。文言はモック案B の原文。
 */
const ROWS: { key: keyof MemoUiPreferences; label: string }[] = [
  { key: "showTimestamp", label: "時刻を出す" },
  { key: "showAuthor", label: "書いた人を出す" },
  { key: "showEditedMark", label: "「編集済み」の印を出す" },
]

export function DisplayPrefsForm({ prefs, canManage }: { prefs: MemoUiPreferences; canManage: boolean }) {
  const router = useRouter()
  const [draft, setDraft] = useState<MemoUiPreferences>(prefs)
  const [isPending, startTransition] = useTransition()

  const save = () => {
    startTransition(async () => {
      const r = await updateMemoUiPreferences(draft)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("表示設定を保存しました")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">品番カルテのメモ</CardTitle>
        <CardDescription>全員の画面に効きます。品番カルテの歯車と同じ設定です</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {ROWS.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-3">
              <Label htmlFor={`display-${r.key}`}>{r.label}</Label>
              <Switch
                id={`display-${r.key}`}
                checked={draft[r.key]}
                disabled={!canManage || isPending}
                onCheckedChange={(v) => setDraft({ ...draft, [r.key]: v })}
              />
            </div>
          ))}
        </div>
        {canManage ? (
          <div className="flex items-center justify-end gap-3">
            <span className="text-xs text-muted-foreground">この欄だけ保存します</span>
            <Button type="button" onClick={save} disabled={isPending}>
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">変更できるのはオーナーと管理者だけです。</p>
        )}
      </CardContent>
    </Card>
  )
}
