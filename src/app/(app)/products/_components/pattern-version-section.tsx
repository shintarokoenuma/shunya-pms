"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  createPatternVersion,
  updatePatternVersion,
  deletePatternVersion,
} from "@/lib/actions/pattern-versions"
import {
  PATTERN_WORK_TYPE_LABELS,
  PATTERN_WORK_TYPE_OPTIONS,
  type PatternVersionView,
} from "@/lib/types/pattern-version"
import type { PatternVersionFormValues } from "@/lib/validators/pattern-version"
import type { PatternWorkType } from "@prisma/client"

/**
 * B-054/B-146 PR-2: 品番カルテの引き出し「型紙」。型番（ModelCode）に紐づく型紙の記録の一覧・登録・編集・削除。
 * 仕様: spec v1.0 §5-1 D-11 / D-12 ― 主役は受領日と種別。version（v1/v2…）は内部の採番で画面に出さない。
 * - 1行: 受領日（YYYY-MM-DD）／種別／グレーディング（有=サイズ）／メモ／Drive リンク／パタンナー
 * - 登録・編集は引き出し内のダイアログ。削除は確認ダイアログ→論理削除。
 * - ★SampleProduction / WO への紐付け UI は本 PR では扱わない（後続）。
 */

type ContractorOption = { id: string; contractorCode: string; contractorName: string }

const NONE = "__none__"

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** グレーディング列: 有（サイズ）／有／— */
function gradingLabel(row: PatternVersionView): string {
  if (!row.hasGrading) return "—"
  return row.gradingSizes.length > 0 ? "有（" + row.gradingSizes.join("/") + "）" : "有"
}

function toDateInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function PatternVersionSection({
  productId,
  modelCodeId,
  rows,
  contractors,
}: {
  productId: string
  modelCodeId: string
  rows: PatternVersionView[]
  contractors: ContractorOption[]
}) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<PatternVersionView | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          型紙そのものの記録（受領日・種別・グレーディング・Drive リンク）。パターンNO は型番で管理します。
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setEditorOpen(true)
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          型紙を登録
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">まだ型紙の記録はありません</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-2 py-1 font-medium">受領日</th>
                <th className="px-2 py-1 font-medium">種別</th>
                <th className="px-2 py-1 font-medium">グレーディング</th>
                <th className="px-2 py-1 font-medium">メモ</th>
                <th className="px-2 py-1 font-medium">Drive</th>
                <th className="px-2 py-1 font-medium">パタンナー</th>
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <PatternVersionRow
                  key={r.id}
                  productId={productId}
                  row={r}
                  onEdit={() => {
                    setEditing(r)
                    setEditorOpen(true)
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PatternVersionEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        productId={productId}
        modelCodeId={modelCodeId}
        editing={editing}
        contractors={contractors}
      />
    </div>
  )
}

function PatternVersionRow({
  productId,
  row,
  onEdit,
}: {
  productId: string
  row: PatternVersionView
  onEdit: () => void
}) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const remove = () => {
    startTransition(async () => {
      const r = await deletePatternVersion(row.id, productId)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setConfirmOpen(false)
      toast.success("型紙の記録を削除しました")
      router.refresh()
    })
  }

  return (
    <tr className="border-b last:border-b-0 align-top">
      <td className="whitespace-nowrap px-2 py-1.5 font-mono">{fmtDate(row.receivedAt)}</td>
      <td className="whitespace-nowrap px-2 py-1.5">{PATTERN_WORK_TYPE_LABELS[row.workType]}</td>
      <td className="whitespace-nowrap px-2 py-1.5">
        {gradingLabel(row)}
      </td>
      <td className="max-w-[24rem] px-2 py-1.5 whitespace-pre-wrap break-words text-foreground/90">
        {row.revisionNotes || "—"}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5">
        {row.driveFileUrl ? (
          <a
            href={row.driveFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            開く
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          "—"
        )}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5">{row.contractorName ?? "—"}</td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right">
        <Button variant="ghost" size="icon" className="h-7 w-7" title="編集" disabled={isPending} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="削除"
          disabled={isPending}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>型紙の記録を削除しますか？</DialogTitle>
              <DialogDescription>一覧から消えます（記録としては残ります）。</DialogDescription>
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
      </td>
    </tr>
  )
}

function PatternVersionEditor({
  open,
  onOpenChange,
  productId,
  modelCodeId,
  editing,
  contractors,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  productId: string
  modelCodeId: string
  editing: PatternVersionView | null
  contractors: ContractorOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // ダイアログを開くたびに editing から初期化する（key で作り直す）
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "型紙の記録を編集" : "型紙を登録"}</DialogTitle>
          <DialogDescription>受領日と種別が主役です。version は内部で自動採番します。</DialogDescription>
        </DialogHeader>
        {open && (
          <PatternVersionForm
            key={editing?.id ?? "new"}
            editing={editing}
            contractors={contractors}
            pending={isPending}
            onCancel={() => onOpenChange(false)}
            onSubmit={(values) => {
              startTransition(async () => {
                const r = editing
                  ? await updatePatternVersion(editing.id, values, productId)
                  : await createPatternVersion(values, productId)
                if (!r.ok) {
                  toast.error(r.error)
                  return
                }
                toast.success(editing ? "型紙の記録を更新しました" : "型紙を登録しました")
                onOpenChange(false)
                router.refresh()
              })
            }}
            modelCodeId={modelCodeId}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PatternVersionForm({
  editing,
  contractors,
  pending,
  onCancel,
  onSubmit,
  modelCodeId,
}: {
  editing: PatternVersionView | null
  contractors: ContractorOption[]
  pending: boolean
  onCancel: () => void
  onSubmit: (values: PatternVersionFormValues) => void
  modelCodeId: string
}) {
  const [receivedAt, setReceivedAt] = useState(toDateInput(editing?.receivedAt ?? null) || toDateInput(new Date().toISOString()))
  const [workType, setWorkType] = useState<PatternWorkType>(editing?.workType ?? "NEW")
  const [hasGrading, setHasGrading] = useState(editing?.hasGrading ?? false)
  const [sizesText, setSizesText] = useState(editing?.gradingSizes.join(", ") ?? "")
  const [revisionNotes, setRevisionNotes] = useState(editing?.revisionNotes ?? "")
  const [driveFileUrl, setDriveFileUrl] = useState(editing?.driveFileUrl ?? "")
  const [contractorId, setContractorId] = useState<string>(editing?.contractorId ?? NONE)

  const submit = () => {
    onSubmit({
      modelCodeId,
      receivedAt,
      workType,
      hasGrading,
      gradingSizes: hasGrading
        ? sizesText.split(/[,、\s]+/).map((s) => s.trim()).filter(Boolean)
        : [],
      revisionNotes,
      driveFileUrl: driveFileUrl.trim(),
      contractorId: contractorId === NONE ? null : contractorId,
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="pv-receivedAt">受領日 *</Label>
          <Input
            id="pv-receivedAt"
            type="date"
            value={receivedAt}
            disabled={pending}
            onChange={(e) => setReceivedAt(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>種別 *</Label>
          <Select value={workType} onValueChange={(v) => setWorkType(v as PatternWorkType)} disabled={pending}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PATTERN_WORK_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={hasGrading} disabled={pending} onCheckedChange={(v) => setHasGrading(v === true)} />
          グレーディングあり
        </label>
        {hasGrading && (
          <Input
            placeholder="サイズ（例: S, M, L）"
            value={sizesText}
            disabled={pending}
            onChange={(e) => setSizesText(e.target.value)}
          />
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="pv-notes">メモ（修正内容など）</Label>
        <Textarea
          id="pv-notes"
          rows={3}
          maxLength={10000}
          value={revisionNotes}
          disabled={pending}
          onChange={(e) => setRevisionNotes(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="pv-drive">Drive リンク</Label>
        <Input
          id="pv-drive"
          type="url"
          placeholder="https://drive.google.com/..."
          value={driveFileUrl}
          disabled={pending}
          onChange={(e) => setDriveFileUrl(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label>パタンナー（外注先）</Label>
        <Select value={contractorId} onValueChange={setContractorId} disabled={pending}>
          <SelectTrigger>
            <SelectValue placeholder="（未選択）" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>（未選択）</SelectItem>
            {contractors.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.contractorCode} {c.contractorName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button variant="outline" disabled={pending} onClick={onCancel}>
          キャンセル
        </Button>
        <Button disabled={pending || !receivedAt} onClick={submit}>
          {pending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          保存
        </Button>
      </DialogFooter>
    </div>
  )
}
