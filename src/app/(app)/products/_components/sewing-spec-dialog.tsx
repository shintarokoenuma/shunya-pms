"use client"

import { useState, useTransition } from "react"
import { FileText, Loader2, X } from "lucide-react"
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePdfPreview, PdfPreviewDialog } from "@/components/pdf/pdf-preview-dialog"

/**
 * B-054 PR-4c: 品番カルテから縫製仕様書 PDF を出す出力ダイアログ。
 * - ページは3種（1枚目＝縫製工場用 sewing／2枚目＝採寸用 measure／3枚目＝加工工場用・詳細図 process）。
 *   宛先の候補は addendum v0.2 D-34 のとおり（sewing＝SEWING／measure＝SEWING か INSPECTION／
 *   process＝加工5種＋SEWING（D-71: 縫製 WO あては「詳細図」））。
 * - 画像はサムネを押した順に番号が付く（sewing 1・measure 2・process 4 まで）。既定は sortOrder 最小の1枚。
 * - 取消（CANCELLED）の WO は既定で候補から外す（D-73）。上部の切り替えで表示できる。完了は出す。
 * - 3枚目（D-74）: 加工 WO は全件並べて既定チェック（外すと1行に畳みサムネを隠す・画像は保持）。
 *   縫製 WO（詳細図）は最初は並べず、「＋ 詳細図を追加」の Select で選んだものだけカードを足す（[×] で外せる）。
 * - プルダウンは区分（量産／量産（追加）／量産（やり直し）／サンプル／その他）ごとに見出しを付け、区分の中は新しい順。
 * - 選んだ内容は保存しない（開くたびに既定から選び直す）。
 * - 「プレビュー」は GET /api/products/[id]/sewing-spec?page=… を組み立てて既存の PdfPreviewDialog で開く。
 *   GCS 控え（/api/order-pdf-archive）は呼ばない。取消の WO を PDF のルート側で拒否することはしない。
 * ★候補の表示名（作業の種類・区分の札・状態・区分の見出し）はサーバ側（page.tsx）で作って渡す。ここでは prisma の enum を import しない。
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
  /** 区分の見出し（量産／量産（追加）／量産（やり直し）／サンプル／その他） */
  categoryLabel: string
  /** WorkOrderStatus の文字列（CANCELLED を既定で隠す） */
  status: string
  /** WORK_ORDER_STATUS_LABELS[status] */
  statusLabel: string
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
const CANCELLED = "CANCELLED"

/** 区分の見出しの並び（プルダウンのグループ順） */
const CATEGORY_ORDER = ["量産", "量産（追加）", "量産（やり直し）", "サンプル", "その他"]

const MAX_IMAGES = { sewing: 1, measure: 2, process: 4 } as const

type ProcessRow = { woId: string; on: boolean; images: number[] }

type DialogState = {
  showCancelled: boolean
  sewingOn: boolean
  sewingWoId: string | null
  sewingImages: number[]
  measureOn: boolean
  measureWoId: string | null
  measureImages: number[]
  /** 3枚目: 加工 WO の行（全件・既定チェック）。表示は showCancelled で絞る */
  process: ProcessRow[]
  /** 3枚目: 追加した詳細図（縫製 WO）のカード（追加した順・D-74） */
  details: ProcessRow[]
}

function isVisible(w: SewingSpecWoOption, showCancelled: boolean): boolean {
  return showCancelled || w.status !== CANCELLED
}

/** 宛先の既定: 量産（PRODUCTION）を先に、その中で新しい順の先頭（表示中の候補から） */
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

/** 3枚目の一覧: 加工の WO（入力の並び＝新しい順） */
function processCandidates(wos: SewingSpecWoOption[]): SewingSpecWoOption[] {
  return wos.filter((w) => PROCESS_TYPES.includes(w.workType))
}

/** sortOrder 最小の絵型1枚（無ければ空） */
function defaultImagesOf(sketches: SewingSpecSketchOption[]): number[] {
  const first = sketches[0]?.sortOrder
  return first === undefined ? [] : [first]
}

function buildDefaults(
  wos: SewingSpecWoOption[],
  sketches: SewingSpecSketchOption[],
  showCancelled: boolean,
): DialogState {
  const visible = wos.filter((w) => isVisible(w, showCancelled))
  const sewingWos = visible.filter((w) => SEWING_TYPES.includes(w.workType))
  const measureWos = visible.filter((w) => MEASURE_TYPES.includes(w.workType))
  const first = sketches[0]?.sortOrder
  const defaultImages = first === undefined ? [] : [first]
  // 2枚目だけ: キャプションに「サイズ」を含む画像（1つ目と別のもの）があれば2つ目に自動で選ぶ
  const sizeImage = sketches.find(
    (s) => s.sortOrder !== first && (s.caption ?? "").includes("サイズ"),
  )
  const measureImages =
    first === undefined ? [] : sizeImage ? [first, sizeImage.sortOrder] : [first]
  return {
    showCancelled,
    sewingOn: sewingWos.length > 0,
    sewingWoId: pickDefaultWo(sewingWos),
    sewingImages: defaultImages,
    measureOn: measureWos.length > 0,
    measureWoId: pickDefaultWo(measureWos),
    measureImages,
    // 既定のチェック: 加工 WO はチェック済み。詳細図（縫製 WO）は最初は並べない（D-74）
    process: processCandidates(wos).map((w) => ({
      woId: w.id,
      on: isVisible(w, showCancelled),
      images: defaultImages,
    })),
    details: [],
  }
}

/** サムネを押した順に番号を付ける。もう一度押すと外れる。max=1 は入れ替え、上限を超える選択はできない */
function toggleImage(current: number[], sortOrder: number, max: number): number[] {
  if (current.includes(sortOrder)) return current.filter((v) => v !== sortOrder)
  if (max === 1) return [sortOrder]
  if (current.length >= max) return current
  return [...current, sortOrder]
}

function woLabel(w: SewingSpecWoOption, detail = false): string {
  return (
    `${w.number}　${w.counterpartyName}　${w.workTypeLabel}` +
    (w.kindLabel ? `　${w.kindLabel}` : "") +
    (w.status === CANCELLED ? `　${w.statusLabel}` : "") +
    (detail ? "（詳細図）" : "")
  )
}

/** 区分ごとに分ける（CATEGORY_ORDER の順・区分の中は入力の並び＝新しい順） */
function groupByCategory(rows: SewingSpecWoOption[]): { label: string; rows: SewingSpecWoOption[] }[] {
  const labels = [...CATEGORY_ORDER, ...rows.map((r) => r.categoryLabel).filter((l) => !CATEGORY_ORDER.includes(l))]
  return [...new Set(labels)]
    .map((label) => ({ label, rows: rows.filter((r) => r.categoryLabel === label) }))
    .filter((g) => g.rows.length > 0)
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
        {groupByCategory(rows).map((g) => (
          <SelectGroup key={g.label}>
            <SelectLabel>{g.label}</SelectLabel>
            {g.rows.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {woLabel(w)}
              </SelectItem>
            ))}
          </SelectGroup>
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
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<DialogState>(() => buildDefaults(wos, sketches, false))
  const [pending, startTransition] = useTransition()
  const preview = usePdfPreview()

  // 表示中の候補（取消は既定で隠す・D-73）
  const visible = wos.filter((w) => isVisible(w, state.showCancelled))
  const sewingWos = visible.filter((w) => SEWING_TYPES.includes(w.workType))
  const measureWos = visible.filter((w) => MEASURE_TYPES.includes(w.workType))
  const processWos = processCandidates(visible)
  const woById = new Map(wos.map((w) => [w.id, w]))

  function handleOpen() {
    // 選んだ内容は保存しない: 開くたびに既定から選び直す（setState はハンドラの中で）
    setState(buildDefaults(wos, sketches, false))
    setOpen(true)
  }

  /** 切り替えを変えたとき: 選択中の宛先が候補から消えるなら、表示中の候補の既定に戻す（ハンドラの中で行う） */
  function handleToggleCancelled(show: boolean) {
    setState((s) => {
      const nextVisible = wos.filter((w) => isVisible(w, show))
      const nextSewing = nextVisible.filter((w) => SEWING_TYPES.includes(w.workType))
      const nextMeasure = nextVisible.filter((w) => MEASURE_TYPES.includes(w.workType))
      const keep = (id: string | null, rows: SewingSpecWoOption[]) =>
        id && rows.some((w) => w.id === id) ? id : pickDefaultWo(rows)
      return {
        ...s,
        showCancelled: show,
        sewingWoId: keep(s.sewingWoId, nextSewing),
        measureWoId: keep(s.measureWoId, nextMeasure),
        // 追加済みの詳細図が見えなくなるなら外す（選択も消える）
        details: s.details.filter((d) => nextVisible.some((w) => w.id === d.woId)),
      }
    })
  }

  const processOn = state.process.filter((p) => p.on && processWos.some((w) => w.id === p.woId))
  // 詳細図の候補: 表示中の縫製 WO のうち、追加済みを除く（D-74）
  const detailCandidates = sewingWos.filter((w) => !state.details.some((d) => d.woId === w.id))
  const detailsOn = state.details.filter((d) => d.on && woById.has(d.woId))
  const selectedCount =
    (state.sewingOn && state.sewingWoId ? 1 : 0) +
    (state.measureOn && state.measureWoId ? 1 : 0) +
    processOn.length +
    detailsOn.length

  function buildQuery(): string {
    const q = new URLSearchParams()
    const page = (kind: string, woId: string, images: number[]) =>
      q.append("page", images.length > 0 ? `${kind}:${woId}:${images.join(",")}` : `${kind}:${woId}`)
    if (state.sewingOn && state.sewingWoId) page("sewing", state.sewingWoId, state.sewingImages)
    if (state.measureOn && state.measureWoId) page("measure", state.measureWoId, state.measureImages)
    // 3枚目は 加工 WO（一覧の順）→ 詳細図（追加した順）
    for (const w of processWos) {
      const p = state.process.find((r) => r.woId === w.id)
      if (p?.on) page("process", w.id, p.images)
    }
    for (const d of state.details) if (d.on) page("process", d.woId, d.images)
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

  function addDetail(woId: string) {
    setState((s) =>
      s.details.some((d) => d.woId === woId)
        ? s
        : { ...s, details: [...s.details, { woId, on: true, images: defaultImagesOf(sketches) }] },
    )
  }

  function updateDetail(woId: string, patch: Partial<ProcessRow>) {
    setState((s) => ({
      ...s,
      details: s.details.map((d) => (d.woId === woId ? { ...d, ...patch } : d)),
    }))
  }

  function removeDetail(woId: string) {
    setState((s) => ({ ...s, details: s.details.filter((d) => d.woId !== woId) }))
  }

  const hasCancelled = wos.some((w) => w.status === CANCELLED)

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

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={state.showCancelled}
              onCheckedChange={(c) => handleToggleCancelled(c === true)}
            />
            {`取消の作業発注も表示${hasCancelled ? "" : "（取消の作業発注はありません）"}`}
          </label>

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

            {/* 3枚目（加工工場用・詳細図・D-74） */}
            <section
              className={`space-y-2 rounded border p-3 ${
                processWos.length === 0 && detailCandidates.length === 0 && state.details.length === 0 ? "opacity-60" : ""
              }`}
            >
              <p className="text-sm font-medium">3枚目（加工工場用・詳細図）</p>
              {processWos.length === 0 && detailCandidates.length === 0 && state.details.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  この品番に加工か縫製の作業発注がありません。作業発注を作ると選べます
                </p>
              ) : (
                <div className="space-y-3">
                  {/* 加工 WO: 全件・既定チェック。外した行は1行に畳む（画像は保持） */}
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
                        {row.on && (
                          <>
                            <p className="text-xs text-muted-foreground">画像（4つまで）</p>
                            <SketchPicker
                              sketches={sketches}
                              selected={row.images}
                              max={MAX_IMAGES.process}
                              disabled={false}
                              onToggle={(so) =>
                                updateProcess(w.id, { images: toggleImage(row.images, so, MAX_IMAGES.process) })
                              }
                            />
                          </>
                        )}
                      </div>
                    )
                  })}

                  {/* 詳細図（縫製 WO）: 追加したカードだけ。[×] で外す */}
                  {state.details.map((d) => {
                    const w = woById.get(d.woId)
                    if (!w) return null
                    return (
                      <div key={d.woId} className="space-y-2 rounded border p-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={d.on}
                            onCheckedChange={(c) => updateDetail(d.woId, { on: c === true })}
                          />
                          <span className="flex-1">{woLabel(w, true)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="詳細図を外す"
                            onClick={() => removeDetail(d.woId)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        {d.on && (
                          <>
                            <p className="text-xs text-muted-foreground">画像（4つまで）</p>
                            <SketchPicker
                              sketches={sketches}
                              selected={d.images}
                              max={MAX_IMAGES.process}
                              disabled={false}
                              onToggle={(so) =>
                                updateDetail(d.woId, { images: toggleImage(d.images, so, MAX_IMAGES.process) })
                              }
                            />
                          </>
                        )}
                      </div>
                    )
                  })}

                  {/* ＋ 詳細図を追加（候補が無ければ出さない） */}
                  {detailCandidates.length > 0 && (
                    <Select value="" onValueChange={addDetail}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="＋ 詳細図を追加（縫製工場あて）" />
                      </SelectTrigger>
                      <SelectContent>
                        {groupByCategory(detailCandidates).map((g) => (
                          <SelectGroup key={g.label}>
                            <SelectLabel>{g.label}</SelectLabel>
                            {g.rows.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {woLabel(w, true)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
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
