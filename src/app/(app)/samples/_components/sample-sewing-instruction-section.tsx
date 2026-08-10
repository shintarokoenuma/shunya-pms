"use client"

import { useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pencil, Loader2, Download, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  updateSampleSewingInstructions,
  loadSewingInstructionsFromProduct,
  applySewingInstructionsToProduct,
} from "@/lib/actions/sample-sewing-instructions"
import {
  type SewingInstruction,
  type SewingFixedKey,
  type SewingDetailKey,
  SEWING_INSTRUCTION_LABELS,
  SEWING_INSTRUCTION_OPTIONS,
  SEWING_FIXED_ORDER,
  SEWING_DETAIL_ORDER,
} from "@/lib/types/sewing-instruction"

type AnyKey = SewingFixedKey | SewingDetailKey

/** SewingInstruction を flat な文字列 map（null→""）に落とす。編集フォームの初期値。 */
function toFlat(v: SewingInstruction): Record<AnyKey, string> {
  const flat = {} as Record<AnyKey, string>
  for (const k of SEWING_FIXED_ORDER) flat[k] = v.fixed[k] ?? ""
  for (const k of SEWING_DETAIL_ORDER) flat[k] = v.sewing[k] ?? ""
  return flat
}

export function SampleSewingInstructionSection({
  sampleProductionId,
  value,
  hasStoredValue,
  isProductionEstimateBase,
}: {
  sampleProductionId: string
  value: SewingInstruction
  /** DB の列が null でない（＝このラウンドに縫製指示が保存されている）か。 */
  hasStoredValue: boolean
  isProductionEstimateBase: boolean
}) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // 論点3-B: 未入力のラウンドのみ「品番カルテから読み込む」。
  const onLoadFromProduct = () => {
    startTransition(async () => {
      const r = await loadSewingInstructionsFromProduct(sampleProductionId)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("品番カルテから縫製指示を読み込みました")
      router.refresh()
    })
  }

  // 論点2-C: 確定サンプルのみ「品番カルテへ反映」。人の確認を挟む。
  const onApplyToProduct = () => {
    if (
      !window.confirm(
        "品番カルテの縫製指示を、このラウンドの内容で上書きします。よろしいですか？",
      )
    ) {
      return
    }
    startTransition(async () => {
      const r = await applySewingInstructionsToProduct(sampleProductionId)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("品番カルテへ反映しました")
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        {!hasStoredValue && (
          <Button
            size="sm"
            variant="outline"
            onClick={onLoadFromProduct}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1 h-4 w-4" />
            )}
            品番カルテから読み込む
          </Button>
        )}
        {isProductionEstimateBase && (
          <Button
            size="sm"
            variant="outline"
            onClick={onApplyToProduct}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-1 h-4 w-4" />
            )}
            品番カルテへ反映
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Pencil className="mr-1 h-4 w-4" />
          編集
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ReadBlock title="基本" order={SEWING_FIXED_ORDER} get={(k) => value.fixed[k]} />
        <ReadBlock title="縫製指示" order={SEWING_DETAIL_ORDER} get={(k) => value.sewing[k]} />
      </div>

      {dialogOpen && (
        <SampleSewingInstructionDialog
          sampleProductionId={sampleProductionId}
          value={value}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  )
}

function ReadBlock<K extends AnyKey>({
  title,
  order,
  get,
}: {
  title: string
  order: readonly K[]
  get: (k: K) => string | null
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <dl className="space-y-1">
        {order.map((k) => (
          <div key={k} className="grid grid-cols-[110px_1fr] gap-2 text-sm">
            <dt className="text-muted-foreground">{SEWING_INSTRUCTION_LABELS[k]}</dt>
            <dd>{get(k) ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function SampleSewingInstructionDialog({
  sampleProductionId,
  value,
  onClose,
}: {
  sampleProductionId: string
  value: SewingInstruction
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<Record<AnyKey, string>>(() => toFlat(value))
  const listId = useId()

  const set = (k: AnyKey, v: string) => setForm((prev) => ({ ...prev, [k]: v }))

  const onSubmit = () => {
    // Json 全体を組み立てて置き換える（空文字は action 側で null 正規化）。
    const payload: SewingInstruction = {
      version: 1,
      fixed: {
        namePosition: form.namePosition,
        careLabelPosition: form.careLabelPosition,
        finishingMethod: form.finishingMethod,
        postProcessing: form.postProcessing,
        hangTag: form.hangTag,
      } as SewingInstruction["fixed"],
      sewing: {
        lining: form.lining,
        thread: form.thread,
        stitch: form.stitch,
        patternMatching: form.patternMatching,
        insertion: form.insertion,
        fabricDirection: form.fabricDirection,
      } as SewingInstruction["sewing"],
    }
    startTransition(async () => {
      const r = await updateSampleSewingInstructions(sampleProductionId, payload)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("縫製指示を更新しました")
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>縫製指示を編集</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <EditBlock
            title="基本"
            order={SEWING_FIXED_ORDER}
            form={form}
            set={set}
            listId={listId}
          />
          <EditBlock
            title="縫製指示"
            order={SEWING_DETAIL_ORDER}
            form={form}
            set={set}
            listId={listId}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            キャンセル
          </Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditBlock<K extends AnyKey>({
  title,
  order,
  form,
  set,
  listId,
}: {
  title: string
  order: readonly K[]
  form: Record<AnyKey, string>
  set: (k: AnyKey, v: string) => void
  listId: string
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">{title}</h4>
      {order.map((k) => {
        const options = SEWING_INSTRUCTION_OPTIONS[k]
        const dl = options.length > 0 ? `${listId}-${k}` : undefined
        return (
          <div key={k} className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor={`${listId}-in-${k}`}>
              {SEWING_INSTRUCTION_LABELS[k]}
            </label>
            <Input
              id={`${listId}-in-${k}`}
              value={form[k]}
              list={dl}
              maxLength={200}
              onChange={(e) => set(k, e.target.value)}
            />
            {dl && (
              <datalist id={dl}>
                {options.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            )}
          </div>
        )
      })}
    </div>
  )
}
