"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, Trash2, FileText, ListChecks } from "lucide-react"
import {
  ProgressTaskType,
  type ProgressTaskStatus as PTStatus,
} from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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
  generateTasksForRound,
  addProcessingTasks,
  updateTaskStatus,
  updateTask,
  removeProcessingTask,
  type ProgressTaskItem,
  type ProcessingTypeOption,
} from "@/lib/actions/progress-tasks"
import {
  PROGRESS_TASK_TYPE_LABELS,
  PROGRESS_TASK_STATUS_LABELS,
  PROGRESS_TASK_STATUS_BADGE_VARIANT,
  PROGRESS_TASK_STATUS_OPTIONS,
} from "./progress-task-labels"
import { DOC_DRIVEN_TASK_TYPES } from "@/lib/progress-task-template"

type Props = {
  sampleProductionId: string
  tasks: ProgressTaskItem[]
  processingOptions: ProcessingTypeOption[]
}

const RECEIVED_TYPES: ReadonlySet<ProgressTaskType> = new Set([
  ProgressTaskType.FABRIC,
  ProgressTaskType.TRIM,
])

export function ProgressChecklist({
  sampleProductionId,
  tasks,
  processingOptions,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleGenerate = () => {
    startTransition(async () => {
      const r = await generateTasksForRound(sampleProductionId)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(
        r.data.generated > 0
          ? `チェックリストを生成しました（${r.data.generated}件）`
          : "既に生成済みです",
      )
      router.refresh()
    })
  }

  if (tasks.length === 0) {
    return (
      <div className="space-y-3 rounded-md border border-dashed py-10 text-center">
        <p className="text-sm text-muted-foreground">
          チェックリストがまだありません。
        </p>
        <Button onClick={handleGenerate} disabled={isPending} size="sm">
          {isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <ListChecks className="mr-1 h-4 w-4" />
          )}
          チェックリストを生成
        </Button>
      </div>
    )
  }

  const processingTasks = tasks.filter(
    (t) => t.taskType === ProgressTaskType.PROCESSING,
  )

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">タスク</th>
              <th className="w-[170px] px-3 py-2 font-medium">ステータス</th>
              <th className="w-[110px] px-3 py-2 font-medium">入荷</th>
              <th className="px-3 py-2 font-medium">メモ</th>
              <th className="w-[150px] px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </tbody>
        </table>
      </div>

      {/* 加工 セクション（B-2） */}
      <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
        <div className="text-sm">
          <span className="font-medium">加工</span>
          <span className="ml-2 text-muted-foreground">
            {processingTasks.length} 件（マスター参照で追加）
          </span>
        </div>
        <AddProcessingDialog
          sampleProductionId={sampleProductionId}
          options={processingOptions}
        />
      </div>
    </div>
  )
}

function TaskRow({ task }: { task: ProgressTaskItem }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState(task.notes ?? "")
  const isDocDriven = DOC_DRIVEN_TASK_TYPES.has(task.taskType)
  const showReceived = RECEIVED_TYPES.has(task.taskType)
  const isProcessing = task.taskType === ProgressTaskType.PROCESSING

  const label = isProcessing
    ? `加工：${task.processingTypeName ?? "（不明）"}`
    : PROGRESS_TASK_TYPE_LABELS[task.taskType]

  const handleStatus = (next: string) => {
    startTransition(async () => {
      const r = await updateTaskStatus(task.id, {
        status: next as PTStatus,
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      router.refresh()
    })
  }

  const handleReceived = (checked: boolean) => {
    startTransition(async () => {
      const r = await updateTask(task.id, { isReceived: checked })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      router.refresh()
    })
  }

  const handleNotesBlur = () => {
    if ((task.notes ?? "") === notes) return
    startTransition(async () => {
      const r = await updateTask(task.id, { notes: notes || null })
      if (!r.ok) toast.error(r.error)
    })
  }

  const handleRemove = () => {
    startTransition(async () => {
      const r = await removeProcessingTask(task.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("加工タスクを取り消しました")
      router.refresh()
    })
  }

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Badge variant={PROGRESS_TASK_STATUS_BADGE_VARIANT[task.status]}>
            {PROGRESS_TASK_STATUS_LABELS[task.status]}
          </Badge>
          <span className="font-medium">{label}</span>
        </div>
      </td>
      <td className="px-3 py-2">
        <Select value={task.status} onValueChange={handleStatus}>
          <SelectTrigger className="h-8 w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROGRESS_TASK_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        {showReceived ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={task.isReceived ?? false}
              onCheckedChange={(c) => handleReceived(c === true)}
              disabled={isPending}
            />
            入荷済み
          </label>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="メモ"
          className="h-8"
          disabled={isPending}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          {isDocDriven && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              title="S-4 で実装予定"
            >
              <FileText className="mr-1 h-3.5 w-3.5" />
              発注書
            </Button>
          )}
          {isProcessing && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRemove}
              disabled={isPending}
              title="加工タスクを取り消す"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

function AddProcessingDialog({
  sampleProductionId,
  options,
}: {
  sampleProductionId: string
  options: ProcessingTypeOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAdd = () => {
    if (selected.size === 0) return
    startTransition(async () => {
      const r = await addProcessingTasks(sampleProductionId, [...selected])
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`加工を ${r.data.added} 件追加しました`)
      setOpen(false)
      setSelected(new Set())
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setSelected(new Set())
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1 h-4 w-4" />
          加工を追加
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>加工を追加</DialogTitle>
          <DialogDescription>
            加工種別マスターから選択します（複数可）。一覧に無い加工は先に
            「加工種別」マスターで登録してください。
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[320px] space-y-1 overflow-y-auto">
          {options.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              稼働中の加工種別がありません。
            </p>
          ) : (
            options.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50"
              >
                <Checkbox
                  checked={selected.has(o.id)}
                  onCheckedChange={() => toggle(o.id)}
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {o.code}
                </span>
                <span className="text-sm">{o.name}</span>
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            キャンセル
          </Button>
          <Button onClick={handleAdd} disabled={isPending || selected.size === 0}>
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            追加（{selected.size}）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
