"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SearchableSelect, type SearchableOption } from "../../_components/searchable-select"
import {
  importSupplierInvoices,
  previewSupplierInvoiceCsv,
  type PreviewDocument,
  type PreviewLine,
  type SupplierInvoiceOptions,
  type SupplierInvoicePreview,
} from "@/lib/actions/supplier-invoices"
import type { SupplierInvoiceDocumentChoice, SupplierInvoiceLineChoice } from "@/lib/validators/supplier-invoice"
import { COUNTERPART_TYPE_LABELS, POSTING_TYPE_LABELS, fmtAmount, fmtNum } from "./labels"

/**
 * B-212 PR-1（P1-D7）: 取り込みの確認画面。書類ごとに1つの塊（相手先の当て・明細の当て方・検算・重複）。
 * 人が直した内容は choices（書類の鍵＋行番号）として importSupplierInvoices に渡し、サーバが CSV を読み直して重ねる
 */
type LineChoice = Omit<SupplierInvoiceLineChoice, "lineNo">
type DocChoice = Omit<SupplierInvoiceDocumentChoice, "key" | "lines"> & { lines: Record<number, LineChoice> }

const NONE = "__none__"
const OTHER = "OTHER"

function counterpartOptions(opts: SupplierInvoiceOptions): SearchableOption[] {
  return [
    { value: OTHER, label: "相手先なし（マスターに当てない）", keywords: "なし OTHER" },
    ...opts.counterparts.map((c) => ({
      value: `${c.type}:${c.id}`,
      label: `${COUNTERPART_TYPE_LABELS[c.type]}　${c.name}`,
      keywords: `${c.code} ${c.name} ${COUNTERPART_TYPE_LABELS[c.type]}`,
    })),
  ]
}

function productOptions(opts: SupplierInvoiceOptions, candidates: string[]): SearchableOption[] {
  const all = opts.products.map((p) => ({
    value: p.id,
    label: `${p.productCode}　${p.productName}`,
    keywords: [p.productCode, p.productName, p.clientProductCode ?? "", p.patternNumber ?? ""].join(" "),
  }))
  if (candidates.length === 0) return all
  const first = all.filter((o) => candidates.includes(o.value)).map((o) => ({ ...o, label: `候補：${o.label}` }))
  return [...first, ...all.filter((o) => !candidates.includes(o.value))]
}

function initialChoice(doc: PreviewDocument): DocChoice {
  const lines: Record<number, LineChoice> = {}
  for (const l of doc.lines) lines[l.lineNo] = { productId: null, noProduct: false, costCategoryId: null, confirmed: false }
  return {
    skip: !!doc.duplicateOf,
    counterpartType: doc.counterpart.type,
    counterpartId: doc.counterpart.id,
    counterpartChosen: false,
    counterpartConfirmed: false,
    lines,
  }
}

function lineBadge(line: PreviewLine, choice: LineChoice): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (choice.productId) return { label: "一致：人が選択", variant: "secondary" }
  if (choice.noProduct) return { label: "品番なし", variant: "outline" }
  const m = line.match
  if (m.status === "MATCHED") return { label: `自動一致：${m.matchedBy === "CLIENT_PRODUCT_CODE" ? "先方品番" : m.matchedBy === "PRODUCT_CODE" ? "社内品番" : "パターンナンバー"}`, variant: "secondary" }
  if (m.status === "RULE_PENDING") return choice.confirmed ? { label: "一致：覚えた対応（確認済み）", variant: "secondary" } : { label: "要確認：覚えた対応", variant: "default" }
  if (m.status === "NO_PRODUCT") return { label: "品番なし", variant: "outline" }
  return { label: m.candidates.length > 0 ? `未一致（候補 ${m.candidates.length}）` : "未一致", variant: "destructive" }
}

export function SupplierInvoiceImport() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [fileName, setFileName] = useState("")
  const [csvText, setCsvText] = useState("")
  const [preview, setPreview] = useState<SupplierInvoicePreview | null>(null)
  const [choices, setChoices] = useState<Record<string, DocChoice>>({})

  const cpOptions = useMemo(() => (preview ? counterpartOptions(preview.options) : []), [preview])
  const productLabel = useMemo(() => new Map((preview?.options.products ?? []).map((p) => [p.id, `${p.productCode}　${p.productName}`])), [preview])

  const onFile = async (f: File | null) => {
    if (!f) return
    setFileName(f.name)
    setCsvText(await f.text())
    setPreview(null)
  }
  const read = () => {
    if (!csvText) { toast.error("CSV ファイルを選んでください"); return }
    startTransition(async () => {
      const r = await previewSupplierInvoiceCsv({ csvText, fileName })
      if (!r.ok) { toast.error(r.error); return }
      setPreview(r.data)
      const next: Record<string, DocChoice> = {}
      for (const d of r.data.documents) next[d.key] = initialChoice(d)
      setChoices(next)
    })
  }
  const setDoc = (key: string, patch: Partial<DocChoice>) => setChoices((c) => ({ ...c, [key]: { ...c[key], ...patch } }))
  const setLine = (key: string, lineNo: number, patch: Partial<LineChoice>) =>
    setChoices((c) => ({ ...c, [key]: { ...c[key], lines: { ...c[key].lines, [lineNo]: { ...c[key].lines[lineNo], ...patch } } } }))
  const confirmAll = (key?: string) => {
    if (!preview) return
    setChoices((c) => {
      const next = { ...c }
      for (const d of preview.documents) {
        if (key && d.key !== key) continue
        const lines = { ...next[d.key].lines }
        for (const l of d.lines) if (l.match.status === "RULE_PENDING") lines[l.lineNo] = { ...lines[l.lineNo], confirmed: true }
        next[d.key] = { ...next[d.key], lines, counterpartConfirmed: d.counterpart.status === "RULE_PENDING" ? true : next[d.key].counterpartConfirmed }
      }
      return next
    })
  }
  const save = () => {
    if (!preview) return
    const documents: SupplierInvoiceDocumentChoice[] = preview.documents.map((d) => {
      const c = choices[d.key]
      return {
        key: d.key, skip: c.skip, counterpartType: c.counterpartType, counterpartId: c.counterpartId, counterpartChosen: c.counterpartChosen, counterpartConfirmed: c.counterpartConfirmed,
        lines: d.lines.map((l) => ({ lineNo: l.lineNo, ...c.lines[l.lineNo] })),
      }
    })
    startTransition(async () => {
      const r = await importSupplierInvoices({ csvText, fileName, documents })
      if (!r.ok) { toast.error(r.error); return }
      toast.success(`${r.data.created.length} 件の書類を取り込みました${r.data.skipped > 0 ? `（${r.data.skipped} 件は取り込まない）` : ""}`)
      router.push("/supplier-invoices")
      router.refresh()
    })
  }

  const pendingCount = preview ? preview.documents.reduce((n, d) => n + d.lines.filter((l) => l.match.status === "RULE_PENDING" && !choices[d.key]?.lines[l.lineNo]?.confirmed && !choices[d.key]?.lines[l.lineNo]?.productId).length, 0) : 0
  const importCount = preview ? preview.documents.filter((d) => !choices[d.key]?.skip).length : 0
  const canSave = !!preview && preview.errors.length === 0 && importCount > 0

  return (
    <div className="space-y-6">
      {/* ① ファイルを選ぶ */}
      <div className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center">
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0] ?? null)} className="text-sm" aria-label="CSV ファイル" disabled={isPending} />
        <Button type="button" onClick={read} disabled={isPending || !csvText}>
          {isPending && !preview ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}読み取る
        </Button>
        {fileName ? <span className="text-sm text-muted-foreground">{fileName}</span> : null}
      </div>

      {preview ? (
        <>
          {preview.errors.length > 0 ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm">
              <p className="mb-2 font-medium text-destructive">エラーが {preview.errors.length} 件あります。直してから取り込んでください（保存できません）</p>
              <ul className="list-disc space-y-1 pl-5">
                {preview.errors.map((e, i) => <li key={i}>{e.row ? `${e.row} 行目` : ""}{e.column ? `・${e.column}` : ""}：{e.message}</li>)}
              </ul>
            </div>
          ) : null}
          {preview.warnings.length > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="mb-2 flex items-center gap-1 font-medium"><AlertTriangle className="h-4 w-4" />確認してください（保存はできます）</p>
              <ul className="list-disc space-y-1 pl-5">
                {preview.warnings.map((w, i) => <li key={i}>{w.row ? `${w.row} 行目` : ""}{w.column ? `・${w.column}` : ""}：{w.message}</li>)}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              書類 {preview.documents.length} 件（取り込む {importCount} 件）
              {pendingCount > 0 ? <span className="ml-2 font-medium text-amber-700">要確認の行 {pendingCount}</span> : null}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => confirmAll()} disabled={isPending || pendingCount === 0}>要確認をまとめて確認済みにする（全体）</Button>
          </div>

          {preview.documents.map((d) => {
            const c = choices[d.key]
            if (!c) return null
            const cpValue = c.counterpartType === OTHER || !c.counterpartId ? OTHER : `${c.counterpartType}:${c.counterpartId}`
            const docPending = d.lines.filter((l) => l.match.status === "RULE_PENDING" && !c.lines[l.lineNo].confirmed && !c.lines[l.lineNo].productId).length
            return (
              <div key={d.key} className={`space-y-3 rounded-md border p-4 ${c.skip ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{d.counterpartNameRaw}</span>
                      <span className="text-muted-foreground">{d.documentType}</span>
                      <span className="font-mono">{d.documentNumber}</span>
                      <span className="tabular-nums">{d.periodMonth}</span>
                      <Badge variant={d.postingType === "COUNTED" ? "secondary" : "outline"}>{POSTING_TYPE_LABELS[d.postingType]}</Badge>
                      {d.postingType === "REFERENCE" && d.pairedDocumentNumber ? <span className="text-xs text-muted-foreground">対の書類 {d.pairedDocumentNumber}</span> : null}
                      <span className="tabular-nums">{fmtAmount(d.totalAmount, d.currency)}</span>
                      {d.currency !== "JPY" ? <span className="text-xs text-muted-foreground">（円は未確定）</span> : null}
                      {d.checksum ? (
                        d.checksum.ok
                          ? <span className="text-xs text-muted-foreground">検算 OK</span>
                          : <span className="text-xs font-medium text-destructive">検算 NG：明細の合計 {fmtNum(d.checksum.lineTotal)} ≠ 書類税抜 {fmtNum(d.checksum.subtotal)}</span>
                      ) : null}
                    </div>
                    {d.duplicateOf ? (
                      <p className="text-destructive">同じ相手先名・書類No・月度の書類（{d.duplicateOf.invoiceNumber}）が既にあります。取り込みません</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="text-xs text-muted-foreground">相手先</Label>
                      <SearchableSelect
                        options={cpOptions}
                        value={cpValue}
                        onChange={(v) => {
                          if (v === OTHER) setDoc(d.key, { counterpartType: OTHER, counterpartId: null, counterpartChosen: true })
                          else {
                            const [t, id] = v.split(":")
                            setDoc(d.key, { counterpartType: t as DocChoice["counterpartType"], counterpartId: id, counterpartChosen: true })
                          }
                        }}
                        className="w-[320px]"
                        disabled={isPending || c.skip || !!d.duplicateOf}
                        ariaLabel="相手先"
                      />
                      {d.counterpart.status === "RULE_PENDING" && !c.counterpartChosen ? (
                        <label className="flex items-center gap-1 text-xs text-amber-700">
                          <Checkbox checked={c.counterpartConfirmed} onCheckedChange={(v) => setDoc(d.key, { counterpartConfirmed: v === true })} disabled={isPending || c.skip} />
                          要確認：覚えた対応で当てた相手先 → 確認済みにする
                        </label>
                      ) : d.counterpart.status === "MATCHED" && !c.counterpartChosen ? (
                        <span className="text-xs text-muted-foreground">自動一致：{d.counterpart.matchedBy === "CODE" ? "コード" : "社名"}</span>
                      ) : d.counterpart.status === "UNMATCHED" && !c.counterpartChosen ? (
                        <span className="text-xs text-destructive">{d.counterpart.candidates.length > 0 ? `候補が ${d.counterpart.candidates.length} 件・選んでください` : "マスターに当たりません（相手先なしで保存できます）"}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {docPending > 0 ? <Button type="button" variant="outline" size="sm" onClick={() => confirmAll(d.key)} disabled={isPending || c.skip}>要確認をまとめて確認済みにする</Button> : null}
                    <label className="flex items-center gap-1 text-sm">
                      <Checkbox checked={c.skip} onCheckedChange={(v) => setDoc(d.key, { skip: v === true })} disabled={isPending || !!d.duplicateOf} />
                      取り込まない
                    </label>
                  </div>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">行</TableHead>
                        <TableHead className="w-[160px]">投入先</TableHead>
                        <TableHead>品名</TableHead>
                        <TableHead className="w-[70px] text-right">数量</TableHead>
                        <TableHead className="w-[90px] text-right">単価</TableHead>
                        <TableHead className="w-[110px] text-right">金額</TableHead>
                        <TableHead className="w-[170px]">当て方</TableHead>
                        <TableHead className="w-[300px]">品番</TableHead>
                        <TableHead className="w-[220px]">費目</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.lines.map((l) => {
                        const lc = c.lines[l.lineNo]
                        const badge = lineBadge(l, lc)
                        const effectiveProduct = lc.productId ?? (lc.noProduct ? null : l.match.productId)
                        return (
                          <TableRow key={l.lineNo}>
                            <TableCell className="text-sm tabular-nums">{l.lineNo}</TableCell>
                            <TableCell className="font-mono text-xs">{l.targetRaw ?? "—"}</TableCell>
                            <TableCell className="text-sm">{l.itemName ?? "—"}{l.itemCodeRaw ? <span className="ml-1 text-xs text-muted-foreground">{l.itemCodeRaw}</span> : null}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{fmtNum(l.quantity)}{l.unit ? ` ${l.unit}` : ""}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{fmtNum(l.unitPrice)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{fmtAmount(l.amount, d.currency)}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge variant={badge.variant} className="w-fit">{badge.label}</Badge>
                                {l.match.status === "RULE_PENDING" && !lc.productId ? (
                                  <label className="flex items-center gap-1 text-xs">
                                    <Checkbox checked={lc.confirmed} onCheckedChange={(v) => setLine(d.key, l.lineNo, { confirmed: v === true })} disabled={isPending || c.skip} />
                                    確認済み
                                  </label>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <SearchableSelect
                                  options={productOptions(preview.options, l.match.candidates)}
                                  value={effectiveProduct}
                                  onChange={(v) => setLine(d.key, l.lineNo, { productId: v, noProduct: false })}
                                  placeholder={lc.noProduct ? "品番なし" : "品番を選ぶ"}
                                  className="w-[290px]"
                                  disabled={isPending || c.skip}
                                  ariaLabel={`行 ${l.lineNo} の品番`}
                                />
                                {effectiveProduct && !lc.productId ? <span className="text-xs text-muted-foreground">{productLabel.get(effectiveProduct)}</span> : null}
                                {!lc.noProduct && l.match.status !== "MATCHED" ? (
                                  <button type="button" className="text-left text-xs text-muted-foreground underline" onClick={() => setLine(d.key, l.lineNo, { productId: null, noProduct: true })} disabled={isPending || c.skip}>品番なし（その他経費）にする</button>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={lc.costCategoryId ?? l.costCategoryId ?? NONE}
                                onValueChange={(v) => setLine(d.key, l.lineNo, { costCategoryId: v === NONE ? null : v })}
                                disabled={isPending || c.skip}
                              >
                                <SelectTrigger className="w-[210px]" aria-label={`行 ${l.lineNo} の費目`}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NONE}>費目なし</SelectItem>
                                  {preview.options.costCategories.map((cc) => <SelectItem key={cc.id} value={cc.id}>{cc.level === 2 ? "　" : ""}{cc.categoryCode} {cc.categoryName}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              {l.costCategoryUnresolved ? <p className="mt-1 text-xs text-amber-700">CSV の費目「{l.costCategoryRaw}」はマスターに当たりません</p> : null}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )
          })}

          <div className="flex items-center justify-end gap-3">
            <p className="text-sm text-muted-foreground">
              {preview.errors.length > 0 ? "エラーがあるため保存できません" : `${importCount} 件の書類を保存します`}
            </p>
            <Button type="button" onClick={save} disabled={isPending || !canSave}>
              {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}保存する
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
