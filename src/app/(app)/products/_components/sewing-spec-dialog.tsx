"use client"

import { useState, useTransition } from "react"
import { FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePdfPreview, PdfPreviewDialog } from "@/components/pdf/pdf-preview-dialog"

/**
 * B-054 PR-4c: 品番カルテから縫製仕様書 PDF を出す出力ダイアログ。
 * - ページは3種（1枚目＝縫製工場用 sewing／2枚目＝採寸用 measure／3枚目＝加工工場用 process）。
 *   宛先の候補は addendum v0.2 D-34 のとおり（sewing＝SEWING／measure＝SEWING か INSPECTION／process＝加工5種）。
 * - 画像はサムネを押した順に番号が付く（sewing 1・measure 2・process 4 まで）。既定は sortOrder 最小の1枚。
 * - 選んだ内容は保存しない（開くたびに既定から選び直す）。
 * - 「プレビュー」は GET /api/products/[id]/sewing-spec?page=… を組み立てて既存の PdfPreviewDialog で開く。
 *   GCS 控え（/api/order-pdf-archive）は呼ばない。
 * ★候補の絞り込みと表示名（作業の種類・区分の札）はサーバ側（page.tsx）で作って渡す。ここでは prisma の enum を import しない。
 */

export type SewingSpecWoOption = {
  id: string
  number: string
  counterpartyName: string
  /** WorkOrderType の文字列（SEWING / INSPECTION / PRINTING …） */
  workType: string
  /** WORK_ORDER_TYPE_LABELS[workType] */
  workTypeLabel: string
  /** 区分の札（sewing-spec-format.ts の kindLabel と同じ規則）。無ければ null */
  kindLabel: string | null
  workCategory: string | null
  /** ISO。新しい順の判定に使う */
  createdAt: string
}

export type SewingSpecSketchOption = {
  sortOrder: number
  caption: string | null
  thumbUrl: string
}

const SEWING_TYPES = ["SEWING"]
const MEASURE_TYPES = ["SEWING", "INSPECTION"]
const PROCESS_TYPES = ["PRINTING", "EMBROIDERY", "WASHING", "DYEING", "FINISHING"]

const MAX_IMAGES = { sewing: 1, measure: 2, process: 4 } as const

type ProcessRow = { woId: string; on: boolean; images: number[] }

type DialogState = {
  sewingOn: boolean
  sewingWoId: string | null
  sewingImages: number[]
  measureOn: boolean
  measureWoId: string | null
  measureImages: number[]
  process: ProcessRow[]
}

/** 宛先の既定: 量産（PRODUCTION）を先に、その中で新しい順の先頭 */
function pickDefaultWo(rows: SewingSpecWoOption[]): string | null {
  if (rows.length === 0) return null
  const sorted = [...rows].sort((a, b) => {
    const pa = a.workCategory === "PRODUCTION" ? 0 : 1
    const pb = b.workCategory === "PRODUCTION" ? 0 : 1
    if (pa !== pb) return pa - pb
    return a.createdAt < b.createdAt ? 1 : -1
  })
  return sorted[0].id
}

function buildDefaults(
  sewingWos: SewingSpecWoOption[],
  measureWos: SewingSpecWoOption[],
  processWos: SewingSpecWoOption[],
  sketches: SewingSpecSketchOption[],
): DialogState {
  const first = sketches[0]?.sortOrder
  const defaultImages = first === undefined ? [] : [first]
  // 2枚目だけ: キャプションに「サイズ」を含む画像（1つ目と別のもの）があれば2つ目に自動で選ぶ
  const sizeImage = sketches.find(
    (s) => s.sortOrder !== first && (s.caption ?? "").includes("サイズ"),
  )
  const measureImages =
    first === undefined ? [] : sizeImage ? [first, sizeImage.sortOrder] : [first]
  return {
    sewingOn: sewingWos.length > 0,
    sewingWoId: pickDefaultWo(sewingWos),
    sewingImages: defaultImages,
    measureOn: measureWos.length > 0,
    measureWoId: pickDefaultWo(measureWos),
    measureImages,
    process: processWos.map((w) => ({ woId: w.id, on: true, images: defaultImages })),
  }
}

/** サムネを押した順に番号を付ける。もう一度押すと外れる。max=1 は入れ替え、上限を超える選択はできない */
function toggleImage(current: number[], sortOrder: number, max: number): number[] {
  if (current.includes(sortOrder)) return current.filter((v) => v !== sortOrder)
  if (max === 1) return [sortOrder]
  if (current.length >= max) return current
  return [...current, sortOrder]
}

function woLabel(w: SewingSpecWoOption): string {
  return `${w.number}　${w.counterpartyName}　${w.workTypeLabel}${w.kindLabel ? `　${w.kindLabel}` : ""}`
}

function SketchPicker({
  sketches,
  selected,
  max,
  disabled,
  onToggle,
}: {
  sketches: SewingSpecSketchOption[]
  selected: number[]
  max: number
  disabled: boolean
  onToggle: (sortOrder: number) => void
}) {
  if (sketches.length === 0) {
    return <p className="text-xs text-muted-foreground">絵型が未登録です</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {sketches.map((s) => {
        const idx = selected.indexOf(s.sortOrder)
        const picked = idx >= 0
        const full = !picked && max > 1 && selected.length >= max
        return (
          <button
            key={s.sortOrder}
            type="button"
            disabled={disabled || full}
            onClick={() => onToggle(s.sortOrder)}
            aria-pressed={picked}
            title={s.caption ?? undefined}
            className={`relative h-20 w-20 overflow-hidden rounded border bg-muted ${
              picked ? "ring-2 ring-primary" : ""
            } ${disabled || full ? "opacity-40" : "hover:opacity-90"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 署名URL（15分）のサムネ。next/image の最適化対象にしない */}
            <img src={s.thumbUrl} alt={s.caption ?? `絵型 ${s.sortOrder}`} className="h-full w-full object-contain" />
            {picked && (
              <span className="absolute left-1 top-1 rounded bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                {idx + 1}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function WoSelect({
  rows,
  value,
  disabled,
  onChange,
}: {
  rows: SewingSpecWoOption[]
  value: string | null
  disabled: boolean
  onChange: (id: string) => void
}) {
  return (
    <Select value={value ?? ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="宛先の作業発注" />
      </SelectTrigger>
      <SelectContent>
        {rows.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            {woLabel(w)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function SewingSpecDialogButton({
  productId,
  productCode,
  wos,
  sketches,
}: {
  productId: string
  productCode: string
  /** この品番の作業発注（WO のみ・新しい順） */
  wos: SewingSpecWoOption[]
  /** 絵型（sortOrder 順・サムネの署名URL付き） */
  sketches: SewingSpecSketchOption[]
}) {
  const sewingWos = wos.filter((w) => SEWING_TYPES.includes(w.workType))
  const measureWos = wos.filter((w) => MEASURE_TYPES.includes(w.workType))
  const processWos = wos.filter((w) => PROCESS_TYPES.includes(w.workType))

  const [open, setOpen] = useState(false)
  const [state, setState] = useState<DialogState>(() =>
    buildDefaults(sewingWos, measureWos, processWos, sketches),
  )
  const [pending, startTransition] = useTransition()
  const preview = usePdfPreview()

  function handleOpen() {
    // 選んだ内容は保存しない: 開くたびに既定から選び直す（setState はハンドラの中で）
    setState(buildDefaults(sewingWos, measureWos, processWos, sketches))
    setOpen(true)
  }

  const selectedCount =
    (state.sewingOn && state.sewingWoId ? 1 : 0) +
    (state.measureOn && state.measureWoId ? 1 : 0) +
    state.process.filter((p) => p.on).length

  function buildQuery(): string {
    const q = new URLSearchParams()
    const page = (kind: string, woId: string, images: number[]) =>
      q.append("page", images.length > 0 ? `${kind}:${woId}:${images.join(",")}` : `${kind}:${woId}`)
    if (state.sewingOn && state.sewingWoId) page("sewing", state.sewingWoId, state.sewingImages)
    if (state.measureOn && state.measureWoId) page("measure", state.measureWoId, state.measureImages)
    for (const p of state.process) if (p.on) page("process", p.woId, p.images)
    return q.toString()
  }

  function handlePreview() {
    const query = buildQuery()
    startTransition(async () => {
      const r = await preview.openUrl(
        `/api/products/${productId}/sewing-spec?${query}`,
        `${productCode}_sewing-spec.pdf`,
      )
      if (!r.ok) toast.error(r.message)
    })
  }

  function updateProcess(woId: string, patch: Partial<ProcessRow>) {
    setState((s) => ({
      ...s,
      process: s.process.map((p) => (p.woId === woId ? { ...p, ...patch } : p)),
    }))
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={handleOpen}>
        <FileText className="mr-1 h-4 w-4" />
        縫製仕様書
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>縫製仕様書 PDF を出力</DialogTitle>
            <DialogDescription>
              出すページと宛先・絵型を選びます。サムネは押した順に紙面に載ります。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* 1枚目 */}
            <section className={`space-y-2 rounded border p-3 ${sewingWos.length === 0 ? "opacity-60" : ""}`}>
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={state.sewingOn}
                  disabled={sewingWos.length === 0}
                  onCheckedChange={(c) => setState((s) => ({ ...s, sewingOn: c === true }))}
                />
                1枚目（縫製工場用）
              </label>
              {sewingWos.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  この品番に縫製の作業発注がありません。作業発注を作ると選べます
                </p>
              ) : (
                <>
                  <WoSelect
                    rows={sewingWos}
                    value={state.sewingWoId}
                    disabled={!state.sewingOn}
                    onChange={(id) => setState((s) => ({ ...s, sewingWoId: id }))}
                  />
                  <p className="text-xs text-muted-foreground">絵型（1つ）</p>
                  <SketchPicker
                    sketches={sketches}
                    selected={state.sewingImages}
                    max={MAX_IMAGES.sewing}
                    disabled={!state.sewingOn}
                    onToggle={(so) =>
                      setState((s) => ({ ...s, sewingImages: toggleImage(s.sewingImages, so, MAX_IMAGES.sewing) }))
                    }
                  />
                </>
              )}
            </section>

            {/* 2枚目 */}
            <section className={`space-y-2 rounded border p-3 ${measureWos.length === 0 ? "opacity-60" : ""}`}>
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={state.measureOn}
                  disabled={measureWos.length === 0}
                  onCheckedChange={(c) => setState((s) => ({ ...s, measureOn: c === true }))}
                />
                2枚目（採寸用）
              </label>
              {measureWos.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  この品番に縫製か検品の作業発注がありません。作業発注を作ると選べます
                </p>
              ) : (
                <>
                  <WoSelect
                    rows={measureWos}
                    value={state.measureWoId}
                    disabled={!state.measureOn}
                    onChange={(id) => setState((s) => ({ ...s, measureWoId: id }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    画像（2つまで・1つ目＝採寸位置の絵型・2つ目＝サイズ表の画像）
                  </p>
                  <SketchPicker
                    sketches={sketches}
                    selected={state.measureImages}
                    max={MAX_IMAGES.measure}
                    disabled={!state.measureOn}
                    onToggle={(so) =>
                      setState((s) => ({ ...s, measureImages: toggleImage(s.measureImages, so, MAX_IMAGES.measure) }))
                    }
                  />
                </>
              )}
            </section>

            {/* 3枚目 */}
            <section className={`space-y-2 rounded border p-3 ${processWos.length === 0 ? "opacity-60" : ""}`}>
              <p className="text-sm font-medium">3枚目（加工工場用）</p>
              {processWos.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  この品番に加工の作業発注がありません。作業発注を作ると選べます
                </p>
              ) : (
                <div className="space-y-3">
                  {processWos.map((w) => {
                    const row = state.process.find((p) => p.woId === w.id) ?? { woId: w.id, on: false, images: [] }
                    return (
                      <div key={w.id} className="space-y-2 rounded border p-2">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={row.on}
                            onCheckedChange={(c) => updateProcess(w.id, { on: c === true })}
                          />
                          {woLabel(w)}
                        </label>
                        <p className="text-xs text-muted-foreground">画像（4つまで）</p>
                        <SketchPicker
                          sketches={sketches}
                          selected={row.images}
                          max={MAX_IMAGES.process}
                          disabled={!row.on}
                          onToggle={(so) => updateProcess(w.id, { images: toggleImage(row.images, so, MAX_IMAGES.process) })}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {`選んだ枚数: ${selectedCount}（付属が16行以上なら1枚目のあとに「付属のつづき」が自動で付きます）`}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                閉じる
              </Button>
              <Button type="button" onClick={handlePreview} disabled={pending || selectedCount === 0}>
                {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}
                プレビュー
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PdfPreviewDialog url={preview.url} filename={preview.filename} onClose={preview.close} />
    </>
  )
}
