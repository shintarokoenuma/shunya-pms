import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ProgressTaskItem } from "@/lib/actions/progress-tasks"
import {
  PROGRESS_TASK_TYPE_LABELS,
  PROGRESS_TASK_STATUS_LABELS,
  PROGRESS_TASK_STATUS_BADGE_VARIANT,
} from "../../samples/_components/progress-task-labels"

/**
 * B-202 PR-1r: 品番カルテ 1画面（右カラム⑥）の「進行」要約チップ。
 * 一次資料: モック「品番カルテ 3案」案C の `.tasks > .task.done / .now / .todo / .skip`
 *           （addendum v0.3 §1-2・原文引用）。`<em>` には日付や短い注記。
 * - ★直列に並べない（v1.0 D-4）。`listProductionTasks` の並び（sortOrder 順）のまま flex-wrap で置く。
 *   矢印・番号・棒グラフなど「順序」を暗示する装飾は付けない。
 * - 状態の色は既存定数 PROGRESS_TASK_STATUS_BADGE_VARIANT を流用（checklist と同じ描き分け）。
 * - 表示のみ・状態なし（Server Component）。編集は共有パネル「進行（編集）」の
 *   ProductionProgressChecklist で行う（既存部品・無変更）。
 * - 使う列は ProgressTask の実在列（taskType / status / isReceived / checkedAt / notes）と、
 *   ProgressTaskItem が足す processingTypeName のみ。追加クエリなし。
 */

const NOTE_MAX = 14

function chipLabel(t: ProgressTaskItem): string {
  // B-202 PR-2（addendum v0.5 D-24）: 加工は「加工：◯◯」と出す（名前が無ければ「加工」）
  if (t.taskType === "PROCESSING")
    return t.processingTypeName ? `加工：${t.processingTypeName}` : "加工"
  return PROGRESS_TASK_TYPE_LABELS[t.taskType]
}

/** モックの <em> 相当。完了日 / 対象外 / 工場入荷 / メモ先頭 の順で1つだけ */
function chipNote(t: ProgressTaskItem): string | null {
  if (t.status === "DONE" && t.checkedAt) {
    return new Date(t.checkedAt).toLocaleDateString("ja-JP", {
      month: "numeric",
      day: "numeric",
    })
  }
  if (t.status === "SKIPPED") return "対象外"
  if (t.isReceived === true) return "工場入荷"
  if (t.notes) {
    const first = t.notes.split(/\r?\n/)[0].trim()
    if (first.length === 0) return null
    return first.length > NOTE_MAX ? `${first.slice(0, NOTE_MAX)}…` : first
  }
  return null
}

export function ProductionProgressChips({
  tasks,
}: {
  tasks: ProgressTaskItem[]
}) {
  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        量産進行タスクはまだありません（量産発注の生成で自動作成されます）。
      </p>
    )
  }
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="量産進行（並行・前後あり）">
      {tasks.map((t) => {
        const note = chipNote(t)
        const statusLabel = PROGRESS_TASK_STATUS_LABELS[t.status]
        return (
          <Badge
            key={t.id}
            variant={PROGRESS_TASK_STATUS_BADGE_VARIANT[t.status]}
            title={statusLabel}
            className={cn(
              "gap-1.5 font-normal",
              t.status === "SKIPPED" && "line-through opacity-60",
            )}
          >
            <span>{chipLabel(t)}</span>
            {note && (
              <span className="font-mono text-[10px] opacity-75">{note}</span>
            )}
            <span className="sr-only">（{statusLabel}）</span>
          </Badge>
        )
      })}
    </div>
  )
}
