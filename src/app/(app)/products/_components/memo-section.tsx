"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Pencil, Settings, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  createProductComment,
  updateProductComment,
  deleteProductComment,
} from "@/lib/actions/comments"
import type { CommentView } from "@/lib/types/comment"
import { updateMemoUiPreferences } from "@/lib/actions/company-settings"
import type { MemoUiPreferences } from "@/lib/types/ui-preferences"

/**
 * B-202 PR-3: 品番カルテ 1画面（右カラム⑦・進行の直下）の「メモ」欄。
 * 一次資料: モック「品番カルテ 3案」案C の `.memo`（addendum v0.3 §0 の URL）。文言は原文どおり:
 *   - 見出し「メモ」
 *   - 1行の形「09/10 中谷　付属の入荷が2日遅れ。…」＝ MM/DD + 半角空白 + 名前 + 全角空白 + 本文
 *   - 入力欄「メモを書く（誰が・いつが残ります）」
 * 仕様: v1.0 D-7（Comment・ログ型）/ addendum v0.1 Q6（編集履歴は残す・「編集済み」だけ出す）
 * - 並びは新しい順（action 側で createdAt desc）・全件・ページングなし
 * - 自分のメモにだけ編集・削除（canEdit）。削除は確認ダイアログ。原文（originalContent）は画面に出さない
 * - Product.internalNotes（社内メモ・上書き型）は別物として併存
 * ★時刻の表示はモック案C の原文（日付のみ）からの逸脱。慎太郎さん確認 2026-09-18（同日に複数のメモが並ぶため間隔が読めない）
 */

const CONTENT_MAX = 2000

/** 「MM/DD HH:mm」（24時間表記・ゼロ埋め・ブラウザのローカル時刻） */
function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function MemoSection({
  productId,
  comments,
  prefs,
}: {
  productId: string
  comments: CommentView[]
  /** B-202 PR-4: 表示スイッチ（会社の既定）。時刻／書いた人／「編集済み」の出し分け。本文は必ず出す */
  prefs: MemoUiPreferences
}) {
  const router = useRouter()
  const [draft, setDraft] = useState("")
  const [isPending, startTransition] = useTransition()

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    startTransition(async () => {
      const r = await createProductComment(productId, text)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setDraft("")
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">まだメモはありません</p>
      ) : (
        <ul className="space-y-1.5">
          {comments.map((c) => (
            <MemoRow key={c.id} productId={productId} comment={c} prefs={prefs} />
          ))}
        </ul>
      )}
      <div className="space-y-2">
        <Textarea
          rows={2}
          maxLength={CONTENT_MAX}
          value={draft}
          disabled={isPending}
          placeholder="メモを書く（誰が・いつが残ります）"
          aria-label="メモ"
          className="text-sm"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Cmd/Ctrl+Enter で保存（Enter 単独は改行）
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={isPending || draft.trim() === ""} onClick={submit}>
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            保存
          </Button>
        </div>
      </div>
    </div>
  )
}

function MemoRow({
  productId,
  comment,
  prefs,
}: {
  productId: string
  comment: CommentView
  prefs: MemoUiPreferences
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(comment.content)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const saveEdit = () => {
    const text = value.trim()
    if (!text) {
      toast.error("メモを入力してください")
      return
    }
    if (text === comment.content) {
      setEditing(false)
      return // 変更なし: action を呼ばない
    }
    startTransition(async () => {
      const r = await updateProductComment(productId, comment.id, text)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  const remove = () => {
    startTransition(async () => {
      const r = await deleteProductComment(productId, comment.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setConfirmOpen(false)
      router.refresh()
    })
  }

  return (
    <li className="border-l-2 pl-2 text-sm">
      {editing ? (
        <div className="space-y-1">
          <Textarea
            rows={2}
            maxLength={CONTENT_MAX}
            value={value}
            disabled={isPending}
            autoFocus
            aria-label="メモを編集"
            className="text-sm"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                saveEdit()
              } else if (e.key === "Escape") {
                e.preventDefault()
                setValue(comment.content)
                setEditing(false)
              }
            }}
          />
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                setValue(comment.content)
                setEditing(false)
              }}
            >
              取り消し
            </Button>
            <Button size="sm" disabled={isPending} onClick={saveEdit}>
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-foreground/90">
            {/* B-202 PR-4: prefs で 時刻／書いた人 を出し分け。両方隠すと見出し部ごと消し、本文だけを出す（形は MM/DD HH:mm 名前　本文 のまま詰める） */}
            {(prefs.showTimestamp || prefs.showAuthor) && (
              <>
                <b className="mr-1 text-xs font-medium text-foreground">
                  {[
                    prefs.showTimestamp ? fmtDateTime(comment.createdAt) : null,
                    prefs.showAuthor ? comment.authorName : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </b>
                {"　"}
              </>
            )}
            {comment.content}
            {prefs.showEditedMark && comment.isEdited && (
              <span className="ml-1 text-xs text-muted-foreground">編集済み</span>
            )}
          </p>
          {comment.canEdit && (
            <div className="flex shrink-0 gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="編集"
                disabled={isPending}
                onClick={() => {
                  setValue(comment.content)
                  setEditing(true)
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="削除"
                disabled={isPending}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>メモを削除しますか？</DialogTitle>
            <DialogDescription>
              一覧から消えます（記録としては残ります）。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={isPending} onClick={() => setConfirmOpen(false)}>
              キャンセル
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={remove}>
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  )
}

/**
 * B-202 PR-4（v1.0 D-8 段階1）: メモ欄の表示スイッチ（会社の既定）を変えるダイアログ。
 * - 見出し「メモ」の右の歯車から開く。★呼び出し側（page.tsx）は管理者相当のときだけ描く。サーバ側でも拒否する
 * - チェックボックス3つ（時刻／書いた人／編集済みの印）。保存で updateMemoUiPreferences → 会社の全員に効く
 * - 既定は3つともオン（現状維持）。段階3（人ごとの上書き）は B-203
 */
export function MemoPrefsDialog({ prefs }: { prefs: MemoUiPreferences }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<MemoUiPreferences>(prefs)
  const [isPending, startTransition] = useTransition()

  const save = () => {
    startTransition(async () => {
      const r = await updateMemoUiPreferences(draft)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  const rows: { key: keyof MemoUiPreferences; label: string }[] = [
    { key: "showTimestamp", label: "時刻を表示" },
    { key: "showAuthor", label: "書いた人を表示" },
    { key: "showEditedMark", label: "編集済みの印を表示" },
  ]

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(prefs) // 開くたびに保存済みの値から始める
        setOpen(next)
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="メモ欄の表示設定"
        aria-label="メモ欄の表示設定"
        onClick={() => setOpen(true)}
      >
        <Settings className="h-4 w-4 text-muted-foreground" />
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>メモ欄の表示設定</DialogTitle>
          <DialogDescription>この会社の全員に適用されます</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {rows.map((r) => (
            <label key={r.key} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={draft[r.key]}
                disabled={isPending}
                onCheckedChange={(v) => setDraft({ ...draft, [r.key]: v === true })}
              />
              {r.label}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          <Button disabled={isPending} onClick={save}>
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
