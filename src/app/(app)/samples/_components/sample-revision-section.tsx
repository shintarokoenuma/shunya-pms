"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Loader2, Pencil, Trash2, AlertTriangle } from "lucide-react"
import type { SampleRevisionType, RevisionRequestor } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  createSampleRevision,
  updateSampleRevision,
  deleteSampleRevision,
  type SampleRevisionItem,
} from "@/lib/actions/sample-revisions"
import {
  SAMPLE_REVISION_TYPE_LABELS,
  SAMPLE_REVISION_TYPE_OPTIONS,
  REVISION_REQUESTOR_LABELS,
  REVISION_REQUESTOR_OPTIONS,
  SAMPLE_REVISION_STATUS_LABELS,
  SAMPLE_REVISION_STATUS_OPTIONS,
} from "./labels"
import type { SampleRevisionStatus } from "@/lib/validators/sample-revision"

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("ja-JP")
}

export function SampleRevisionSection({
  sampleProductionId,
  revisions,
}: {
  sampleProductionId: string
  revisions: SampleRevisionItem[]
}) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditingId(null)
            setAdding((v) => !v)
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          修正記録を追加
        </Button>
      </div>

      {adding && (
        <RevisionForm
          mode="create"
          sampleProductionId={sampleProductionId}
          onClose={() => setAdding(false)}
        />
      )}

      {revisions.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          修正記録はまだありません。
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[48px]">#</TableHead>
                <TableHead className="w-[110px]">種別</TableHead>
                <TableHead className="w-[130px]">依頼元</TableHead>
                <TableHead>内容</TableHead>
                <TableHead className="w-[90px]">状態</TableHead>
                <TableHead className="w-[110px]">依頼日</TableHead>
                <TableHead className="w-[70px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {revisions.map((r) => {
                const isEditing = editingId === r.id
                return isEditing ? (
                  <TableRow key={r.id}>
                    <TableCell colSpan={7} className="p-3">
                      <RevisionForm
                        mode="edit"
                        sampleProductionId={sampleProductionId}
                        revision={r}
                        onClose={() => setEditingId(null)}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.revisionOrder}
                    </TableCell>
                    <TableCell className="text-sm">
                      {SAMPLE_REVISION_TYPE_LABELS[r.revisionType]}
                    </TableCell>
                    <TableCell className="text-sm">
                      {REVISION_REQUESTOR_LABELS[r.requestedBy]}
                    </TableCell>
                    <TableCell className="whitespace-pre-wrap text-sm">
                      {r.description}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === "COMPLETED" ? "secondary" : "outline"
                        }
                      >
                        {SAMPLE_REVISION_STATUS_LABELS[
                          (r.status as SampleRevisionStatus) ?? "PENDING"
                        ] ?? r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(r.requestedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAdding(false)
                            setEditingId(r.id)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <RevisionDeleteButton revision={r} />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

/**
 * 修正記録の物理削除ボタン。確認ダイアログの作法は
 * sample-production-delete-button.tsx に揃える（Dialog + useState/useTransition + pending 表示）。
 */
function RevisionDeleteButton({ revision }: { revision: SampleRevisionItem }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    startTransition(async () => {
      const r = await deleteSampleRevision(revision.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("修正記録を削除しました")
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            修正記録を削除
          </DialogTitle>
          <DialogDescription>
            修正記録 #{revision.revisionOrder}「{revision.description}」を削除します。
            この操作は取り消せません。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-4 w-4" />
            )}
            削除する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RevisionForm({
  mode,
  sampleProductionId,
  revision,
  onClose,
}: {
  mode: "create" | "edit"
  sampleProductionId: string
  revision?: SampleRevisionItem
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [revisionType, setRevisionType] = useState<SampleRevisionType | "">(
    revision?.revisionType ?? "",
  )
  const [requestedBy, setRequestedBy] = useState<RevisionRequestor>(
    revision?.requestedBy ?? "INTERNAL",
  )
  const [description, setDescription] = useState(revision?.description ?? "")
  const [status, setStatus] = useState<SampleRevisionStatus>(
    (revision?.status as SampleRevisionStatus) ?? "PENDING",
  )

  const onSubmit = () => {
    if (!revisionType) {
      toast.error("種別を選択してください")
      return
    }
    if (description.trim() === "") {
      toast.error("修正内容を入力してください")
      return
    }
    startTransition(async () => {
      const r =
        mode === "create"
          ? await createSampleRevision({
              sampleProductionId,
              revisionType,
              requestedBy,
              description,
            })
          : await updateSampleRevision({
              id: revision!.id,
              revisionType,
              requestedBy,
              description,
              status,
            })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(mode === "create" ? "修正記録を追加しました" : "修正記録を更新しました")
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">種別（必須）</label>
          <Select
            value={revisionType}
            onValueChange={(v) => setRevisionType(v as SampleRevisionType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {SAMPLE_REVISION_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">依頼元（必須）</label>
          <Select
            value={requestedBy}
            onValueChange={(v) => setRequestedBy(v as RevisionRequestor)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVISION_REQUESTOR_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">内容（必須）</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
        />
      </div>

      {mode === "edit" && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">状態</label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as SampleRevisionStatus)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SAMPLE_REVISION_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
          キャンセル
        </Button>
        <Button size="sm" onClick={onSubmit} disabled={isPending}>
          {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          {mode === "create" ? "追加" : "保存"}
        </Button>
      </div>
    </div>
  )
}
