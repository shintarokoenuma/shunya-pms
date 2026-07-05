"use client"

import { useEffect, useState, useTransition } from "react"
import {
  useForm,
  useFieldArray,
  useWatch,
  type UseFormReturn,
  type SubmitHandler,
} from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, Pencil, Trash2, Search, AlertTriangle } from "lucide-react"
import {
  Currency,
  RoughEstimateCategory,
  RoughEstimateItemSource,
  MarginRateSource,
  InitialCostBillingMode,
} from "@prisma/client"
import {
  roughEstimateInputSchema,
  type RoughEstimateFormValues,
  type RoughEstimateInput,
} from "@/lib/validators/rough-estimate"
import {
  createRoughEstimate,
  updateRoughEstimate,
  softDeleteRoughEstimate,
  getRoughEstimateForEdit,
  listPastPoItemsBySupplier,
  listPastWoItemsByCostCategory,
  type RoughEstimateListRow,
  type PastPoItemCandidate,
  type PastWoItemCandidate,
} from "@/lib/actions/rough-estimates"
import type {
  MaterialOption,
  CostCategoryOption,
  SupplierOption,
} from "@/lib/actions/purchase-orders"
import {
  ROUGH_ESTIMATE_CATEGORY_LABELS,
  ROUGH_ESTIMATE_CATEGORY_OPTIONS,
  ROUGH_ESTIMATE_ITEM_SOURCE_LABELS,
  MARGIN_RATE_SOURCE_LABELS,
} from "@/lib/constants/rough-estimate-types"
import {
  summarizeRoughEstimate,
  computePriceBreakdownFromTotals,
  type RoughEstimateLineForCalc,
} from "@/lib/rough-estimate/calc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const NONE = "__none__"

// 概算で許可する通貨は JPY / USD のみ（validator と一致）。
const QE_CURRENCY_OPTIONS: Array<{ value: Currency; label: string }> = [
  { value: Currency.JPY, label: "JPY（円）" },
  { value: Currency.USD, label: "USD（米ドル）" },
]

const SOURCE_OPTIONS = Object.values(RoughEstimateItemSource).map((v) => ({
  value: v,
  label: ROUGH_ESTIMATE_ITEM_SOURCE_LABELS[v],
}))

/**
 * 費目区分ごとに選べる出所（source）を制限する（確定仕様）:
 * - MATERIAL      → MANUAL / PAST_PO（PAST_WO は除外）
 * - LABOR         → MANUAL / PAST_WO（PAST_PO は除外）
 * - INITIAL_COST  → MANUAL のみ
 */
function allowedSourcesFor(
  category: RoughEstimateCategory,
): RoughEstimateItemSource[] {
  if (category === RoughEstimateCategory.MATERIAL) {
    return [RoughEstimateItemSource.MANUAL, RoughEstimateItemSource.PAST_PO]
  }
  if (category === RoughEstimateCategory.LABOR) {
    return [RoughEstimateItemSource.MANUAL, RoughEstimateItemSource.PAST_WO]
  }
  return [RoughEstimateItemSource.MANUAL] // INITIAL_COST
}

/**
 * Radix Select 選択時に form.setValue を連鎖させると、再レンダリング中に
 * スクロール可能なダイアログの scrollTop が巻き戻る（実測 1627→531）。
 * 操作直前の scrollTop を保存し、再レンダリング/クローズが落ち着いた次フレームで復元する。
 * （field.onChange のみの Select では発生しないため、setValue を伴うハンドラだけを包む）
 */
function preserveDialogScroll(run: () => void) {
  if (typeof document === "undefined") {
    run()
    return
  }
  const el = document.querySelector<HTMLElement>('[role="dialog"]')
  const top = el?.scrollTop ?? 0
  run()
  if (!el) return
  requestAnimationFrame(() => {
    el.scrollTop = top
    requestAnimationFrame(() => {
      el.scrollTop = top
    })
  })
}

type Props = {
  productId: string
  rows: RoughEstimateListRow[]
  brandDefaultMarginRate: number
  materials: MaterialOption[]
  costCategories: CostCategoryOption[]
  suppliers: SupplierOption[]
}

function jpy(n: number | null): string {
  return n === null ? "—" : `¥${n.toLocaleString("ja-JP")}`
}

export function RoughEstimateSection({
  productId,
  rows,
  brandDefaultMarginRate,
  materials,
  costCategories,
  suppliers,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<RoughEstimateListRow | null>(null)

  const openCreate = () => {
    setEditingId(null)
    setDialogOpen(true)
  }
  const openEdit = (id: string) => {
    setEditingId(id)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          概算見積を追加
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          概算見積はまだありません。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>見積番号</TableHead>
                <TableHead>発行日</TableHead>
                <TableHead className="text-right">提示MOQ</TableHead>
                <TableHead className="text-right">利益率</TableHead>
                <TableHead className="text-right">原価(自動)</TableHead>
                <TableHead className="text-right">量産提示分</TableHead>
                <TableHead className="text-right">初期費用提示分</TableHead>
                <TableHead className="text-right">提示価格計</TableHead>
                <TableHead className="text-right">最終値(手打ち)</TableHead>
                <TableHead className="w-[90px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const bd = computePriceBreakdownFromTotals(
                  r.autoCostTotalJpy ?? 0,
                  r.autoPriceTotalJpy ?? 0,
                  r.marginRate,
                  r.initialCostBillingMode,
                  r.presentedMoq,
                )
                const included =
                  r.initialCostBillingMode === InitialCostBillingMode.INCLUDED
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      {r.estimateNumber}
                      {included && (
                        <Badge variant="secondary" className="ml-1 text-[10px]">
                          込み
                        </Badge>
                      )}
                      {r.title && (
                        <span className="ml-2 text-muted-foreground">
                          {r.title}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(r.issuedAt).toLocaleDateString("ja-JP")}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.presentedMoq != null
                        ? r.presentedMoq.toLocaleString("ja-JP")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.marginRate != null ? `${r.marginRate}%` : "—"}
                      {r.belowMarginWarning && (
                        <Badge variant="destructive" className="ml-1 text-[10px]">
                          赤字
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {jpy(r.autoCostTotalJpy)}
                    </TableCell>
                    <TableCell className="text-right">
                      {jpy(bd.productionPriceTotalJpy)}
                      {included && bd.perUnit && (
                        <div className="text-[10px] text-muted-foreground">
                          @{jpy(bd.perUnit.includedPerUnitPriceJpy)}/枚
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-amber-700">
                      {jpy(bd.initialCostPriceTotalJpy)}
                      {included && (
                        <div className="text-[10px] text-muted-foreground">
                          1枚単価に配賦
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {jpy(r.autoPriceTotalJpy)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {jpy(r.finalPriceManualJpy)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEdit(r.id)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDeleting(r)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {dialogOpen && (
        <RoughEstimateFormDialog
          productId={productId}
          editingId={editingId}
          brandDefaultMarginRate={brandDefaultMarginRate}
          materials={materials}
          costCategories={costCategories}
          suppliers={suppliers}
          onClose={() => setDialogOpen(false)}
        />
      )}

      {deleting && (
        <DeleteConfirmDialog row={deleting} onClose={() => setDeleting(null)} />
      )}
    </div>
  )
}

// =============================================================================
// 削除確認
// =============================================================================
function DeleteConfirmDialog({
  row,
  onClose,
}: {
  row: RoughEstimateListRow
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>概算見積を削除</DialogTitle>
          <DialogDescription>
            {row.estimateNumber} を削除します。取り消せません。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const r = await softDeleteRoughEstimate(row.id)
                if (!r.ok) {
                  toast.error(r.error)
                  return
                }
                toast.success("概算見積を削除しました")
                onClose()
                router.refresh()
              })
            }
          >
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            削除する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// フォーム（作成 / 編集）
// =============================================================================
function emptyItem(
  category: RoughEstimateCategory = RoughEstimateCategory.MATERIAL,
): RoughEstimateFormValues["items"][number] {
  return {
    itemCategory: category,
    itemName: "",
    itemNameEn: "",
    materialId: null,
    costCategoryId: null,
    source: RoughEstimateItemSource.MANUAL,
    sourcePoItemId: null,
    sourceWoItemId: null,
    quantity: "",
    unit: "",
    unitPrice: "",
    currency: Currency.JPY,
    notes: "",
  }
}

function RoughEstimateFormDialog({
  productId,
  editingId,
  brandDefaultMarginRate,
  materials,
  costCategories,
  suppliers,
  onClose,
}: {
  productId: string
  editingId: string | null
  brandDefaultMarginRate: number
  materials: MaterialOption[]
  costCategories: CostCategoryOption[]
  suppliers: SupplierOption[]
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(editingId !== null)

  const form = useForm<RoughEstimateFormValues>({
    resolver: zodResolver(roughEstimateInputSchema),
    defaultValues: {
      productId,
      title: "",
      notes: "",
      presentedMoq: "",
      currency: Currency.JPY,
      validUntil: "",
      marginRate: String(brandDefaultMarginRate),
      marginRateSource: null,
      initialCostBillingMode: InitialCostBillingMode.SEPARATE,
      usdJpyRate: "",
      finalPriceManualJpy: "",
      items: [emptyItem()],
    },
  })
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  // 編集：既存値をプレフィル（Decimal を含まない plain 形で取得）。
  useEffect(() => {
    if (editingId === null) return
    let cancelled = false
    getRoughEstimateForEdit(editingId).then((r) => {
      if (cancelled) return
      if (!r.ok) {
        toast.error(r.error)
        onClose()
        return
      }
      const d = r.data
      form.reset({
        productId: d.productId,
        title: d.title ?? "",
        notes: d.notes ?? "",
        presentedMoq: d.presentedMoq != null ? String(d.presentedMoq) : "",
        currency: d.currency,
        validUntil: d.validUntil ?? "",
        marginRate: d.marginRate != null ? String(d.marginRate) : "",
        marginRateSource: d.marginRateSource,
        initialCostBillingMode: d.initialCostBillingMode,
        usdJpyRate: "",
        finalPriceManualJpy:
          d.finalPriceManualJpy != null ? String(d.finalPriceManualJpy) : "",
        items: d.items.map((it) => ({
          itemCategory: it.itemCategory,
          itemName: it.itemName,
          itemNameEn: it.itemNameEn ?? "",
          materialId: it.materialId,
          costCategoryId: it.costCategoryId,
          source: it.source,
          sourcePoItemId: it.sourcePoItemId,
          sourceWoItemId: it.sourceWoItemId,
          quantity: it.quantity != null ? String(it.quantity) : "",
          unit: it.unit ?? "",
          unitPrice: it.unitPrice != null ? String(it.unitPrice) : "",
          currency: it.currency,
          notes: it.notes ?? "",
        })),
      })
      if (d.hasUsdLine) {
        toast.info("USD 明細があります。保存にはレート（USD/JPY）の再入力が必要です。")
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId])

  // ---- ライブ集計（useWatch で反応的に購読・A-3 修正：form.watch() 由来の派生値取りこぼしを解消） ----
  const watchedItems = useWatch({ control: form.control, name: "items" })
  const watchedMargin = useWatch({ control: form.control, name: "marginRate" })
  const watchedUsd = useWatch({ control: form.control, name: "usdJpyRate" })
  const watchedMoq = useWatch({ control: form.control, name: "presentedMoq" })
  const watchedMode = useWatch({
    control: form.control,
    name: "initialCostBillingMode",
  })

  const items = watchedItems ?? []
  const usdRateNum = toNumOrNull(watchedUsd)
  const marginNum = toNumOrNull(watchedMargin)
  const moqNum = toNumOrNull(watchedMoq)
  const billingMode = watchedMode ?? InitialCostBillingMode.SEPARATE

  // 各行の JPY 換算小計（単一ソース：ここで計算し行にも渡す）。
  const rowSubtotals = items.map((it) => lineSubtotalJpy(it, usdRateNum))
  const lines: RoughEstimateLineForCalc[] = items.map((it, i) => ({
    itemCategory: it.itemCategory,
    subtotalJpy: rowSubtotals[i],
  }))
  const summary = summarizeRoughEstimate(lines, marginNum)
  const breakdown = computePriceBreakdownFromTotals(
    summary.autoCostTotalJpy,
    summary.autoPriceTotalJpy,
    marginNum,
    billingMode,
    moqNum,
  )
  const included = billingMode === InitialCostBillingMode.INCLUDED

  // INITIAL_COST 行で数量未入力（単価あり）を検出（集計から静かに消えるのを防ぐ・P2注意点）。
  const initialCostMissingQty = items.some(
    (it) =>
      it.itemCategory === RoughEstimateCategory.INITIAL_COST &&
      isBlank(it.quantity) &&
      !isBlank(it.unitPrice),
  )

  const onSubmit: SubmitHandler<RoughEstimateFormValues> = (values) => {
    startTransition(async () => {
      // INITIAL_COST の数量未入力（単価あり）は 1 を補う（別枠から静かに落ちるのを防ぐ）。
      const normalizedItems = values.items.map((it) => {
        if (
          it.itemCategory === RoughEstimateCategory.INITIAL_COST &&
          isBlank(it.quantity) &&
          !isBlank(it.unitPrice)
        ) {
          return { ...it, quantity: "1" }
        }
        return it
      })

      // marginRateSource の確定：ブランド既定と同値なら BRAND_DEFAULT、異なれば MANUAL_OVERRIDE。
      const mr = toNumOrNull(values.marginRate)
      const marginRateSource: MarginRateSource | null =
        mr === null
          ? null
          : mr === brandDefaultMarginRate
            ? MarginRateSource.BRAND_DEFAULT
            : MarginRateSource.MANUAL_OVERRIDE

      const payload = {
        ...values,
        items: normalizedItems,
        marginRateSource,
      } as unknown as RoughEstimateInput

      const r = editingId
        ? await updateRoughEstimate(editingId, payload)
        : await createRoughEstimate(payload)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(
        editingId ? "概算見積を更新しました" : "概算見積を作成しました",
      )
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {/* 共通 dialog.tsx の既定 sm:max-w-sm を上書きするため sm: 変種で指定（素の max-w-* では負ける） */}
      <DialogContent className="max-h-[92vh] sm:max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingId ? "概算見積を編集" : "概算見積を作成"}
          </DialogTitle>
          <DialogDescription>
            量産軸の概算（提示価格）。初期費用は既定では別枠、チェックで1枚単価にインクルーズできます。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            読み込み中…
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* ヘッダ */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="md:col-span-3">
                      <FormLabel>タイトル / 想定数量帯など（任意）</FormLabel>
                      <FormControl>
                        <Input autoComplete="off" placeholder="例：2026SS 概算・想定100〜300" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="presentedMoq"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        提示MOQ{included && <span className="text-destructive">（必須）</span>}
                      </FormLabel>
                      <FormControl>
                        <Input autoComplete="off"
                          type="number"
                          step="1"
                          placeholder="例：100"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>通貨（前提）</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper">
                          {QE_CURRENCY_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="marginRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>利益率（%）</FormLabel>
                      <FormControl>
                        <Input autoComplete="off"
                          type="number"
                          step="any"
                          placeholder="例：20"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <p className="text-[11px] text-muted-foreground">
                        既定 {brandDefaultMarginRate}%（
                        {MARGIN_RATE_SOURCE_LABELS[
                          marginNum === null || marginNum === brandDefaultMarginRate
                            ? MarginRateSource.BRAND_DEFAULT
                            : MarginRateSource.MANUAL_OVERRIDE
                        ]}
                        ）
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>有効期限（任意）</FormLabel>
                      <FormControl>
                        <Input autoComplete="off"
                          type="date"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="usdJpyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>USD/JPY レート</FormLabel>
                      <FormControl>
                        <Input autoComplete="off"
                          type="number"
                          step="any"
                          placeholder="USD 明細がある場合のみ"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* B-2: 初期費用インクルーズ切替 */}
              <FormField
                control={form.control}
                name="initialCostBillingMode"
                render={({ field }) => (
                  <FormItem className="rounded-md border p-3">
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value === InitialCostBillingMode.INCLUDED}
                          onCheckedChange={(c) =>
                            field.onChange(
                              c
                                ? InitialCostBillingMode.INCLUDED
                                : InitialCostBillingMode.SEPARATE,
                            )
                          }
                        />
                      </FormControl>
                      <div className="space-y-1">
                        <FormLabel className="cursor-pointer">
                          初期費用を製品単価にインクルーズする
                        </FormLabel>
                        <p className="text-[11px] text-muted-foreground">
                          OFF＝別枠請求（既定）。ON＝初期費用の価格化後金額を提示MOQで割り返し1枚単価に配賦。
                          ON にすると提示MOQ（1以上）が必須になります。
                        </p>
                        {included && !breakdown.moqValid && (
                          <p className="text-[11px] text-destructive">
                            提示MOQ（1以上）を入力してください（0除算防止）。
                          </p>
                        )}
                      </div>
                    </div>
                  </FormItem>
                )}
              />

              <Separator />

              {/* 明細 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">明細</h4>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        append(emptyItem(RoughEstimateCategory.MATERIAL))
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      原価明細
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        append(emptyItem(RoughEstimateCategory.INITIAL_COST))
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      初期費用（別枠）
                    </Button>
                  </div>
                </div>

                {fields.map((f, idx) => (
                  <ItemCard
                    key={f.id}
                    form={form}
                    idx={idx}
                    itemValue={items[idx]}
                    subtotalJpy={rowSubtotals[idx] ?? null}
                    materials={materials}
                    costCategories={costCategories}
                    suppliers={suppliers}
                    onRemove={() => (fields.length > 1 ? remove(idx) : null)}
                    canRemove={fields.length > 1}
                  />
                ))}
                {form.formState.errors.items?.message && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.items.message}
                  </p>
                )}
              </div>

              <Separator />

              {/* 集計サマリ（B-3 内訳分離） */}
              <div className="rounded-md border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    原価小計（材料費＋工賃・INITIAL_COST 除外）
                  </span>
                  <span className="font-mono">{jpy(summary.autoCostTotalJpy)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    初期費用小計（別枠・原価に含めない）
                  </span>
                  <span className="font-mono text-amber-700">
                    {jpy(summary.initialCostTotalJpy)}
                  </span>
                </div>
                <Separator />

                {/* 提示価格の内訳（常に分けて表示） */}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    量産提示分（原価×(1+利益率)）
                  </span>
                  <span className="font-mono">
                    {jpy(breakdown.productionPriceTotalJpy)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    初期費用提示分（別途・価格化後）
                  </span>
                  <span className="font-mono text-amber-700">
                    {jpy(breakdown.initialCostPriceTotalJpy)}
                  </span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>提示価格（自動・合計）</span>
                  <span className="font-mono">{jpy(summary.autoPriceTotalJpy)}</span>
                </div>

                {/* 1枚あたり */}
                {included ? (
                  breakdown.perUnit ? (
                    <div className="rounded bg-muted p-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          1枚あたり量産提示（初期費用抜き）
                        </span>
                        <span className="font-mono">
                          {jpy(breakdown.perUnit.productionPricePerUnitJpy)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          ＋初期費用の1枚あたり配賦
                        </span>
                        <span className="font-mono text-amber-700">
                          {jpy(breakdown.perUnit.initialCostAddonPerUnitJpy)}
                        </span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>＝1枚あたり提示価格（インクルーズ済み）</span>
                        <span className="font-mono">
                          {jpy(breakdown.perUnit.includedPerUnitPriceJpy)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded bg-destructive/10 p-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      インクルーズには提示MOQ（1以上）が必要です。
                    </div>
                  )
                ) : (
                  breakdown.perUnit && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>参考：1枚あたり原価（初期費用抜き）</span>
                      <span className="font-mono">
                        {jpy(breakdown.perUnit.costPerUnitJpy)}
                      </span>
                    </div>
                  )
                )}

                {summary.belowMarginWarning && (
                  <div className="flex items-center gap-2 rounded bg-destructive/10 p-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    利益率0%：提示価格＝原価（赤字）。利益率を確認してください。
                  </div>
                )}
                {initialCostMissingQty && (
                  <div className="flex items-center gap-2 rounded bg-amber-100 p-2 text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    初期費用の数量が未入力です。保存時に数量1として計上します（別枠から静かに落ちないように）。
                  </div>
                )}

                <Separator />
                <FormField
                  control={form.control}
                  name="finalPriceManualJpy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>最終見積額（手打ち・JPY）</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input autoComplete="off"
                            type="number"
                            step="any"
                            placeholder={`未入力なら自動値 ${summary.autoPriceTotalJpy}`}
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            field.onChange(String(summary.autoPriceTotalJpy))
                          }
                        >
                          自動値を入れる
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>前提メモ（任意）</FormLabel>
                    <FormControl>
                      <Textarea autoComplete="off"
                        rows={2}
                        placeholder="素材グレード仮定・色数・納期前提など"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isPending}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  {editingId ? "更新する" : "作成する"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// 明細1行（費目区分・出所・品目日英・数量・単価・通貨・小計＋マスタ選択/引き当て）
// A-1: ダイアログ幅拡大（max-w-6xl）＋グリッド列を整理し重なり/切れを解消。
// A-4: MATERIAL 行は素材、LABOR 行は費目のマスタ選択を常時表示（MANUAL でも選べる）。
// =============================================================================
function ItemCard({
  form,
  idx,
  itemValue,
  subtotalJpy,
  materials,
  costCategories,
  suppliers,
  onRemove,
  canRemove,
}: {
  form: UseFormReturn<RoughEstimateFormValues>
  idx: number
  itemValue: RoughEstimateFormValues["items"][number] | undefined
  subtotalJpy: number | null
  materials: MaterialOption[]
  costCategories: CostCategoryOption[]
  suppliers: SupplierOption[]
  onRemove: () => void
  canRemove: boolean
}) {
  const category = itemValue?.itemCategory ?? RoughEstimateCategory.MATERIAL
  const source = itemValue?.source ?? RoughEstimateItemSource.MANUAL
  const isInitial = category === RoughEstimateCategory.INITIAL_COST
  const isMaterial = category === RoughEstimateCategory.MATERIAL
  const isLabor = category === RoughEstimateCategory.LABOR

  // 素材選択時に品目名が空なら自動補完（任意で上書き可）。setValue 連鎖のスクロール巻き戻りを回避。
  const onPickMaterial = (materialId: string | null) =>
    preserveDialogScroll(() => {
      form.setValue(`items.${idx}.materialId`, materialId)
      if (materialId) {
        const m = materials.find((x) => x.id === materialId)
        if (m) {
          if (isBlank(form.getValues(`items.${idx}.itemName`))) {
            form.setValue(`items.${idx}.itemName`, m.materialName, {
              shouldValidate: true,
            })
          }
          if (isBlank(form.getValues(`items.${idx}.unit`))) {
            form.setValue(`items.${idx}.unit`, m.unit)
          }
        }
      }
    })
  const onPickCostCategory = (costCategoryId: string | null) =>
    preserveDialogScroll(() => {
      form.setValue(`items.${idx}.costCategoryId`, costCategoryId)
      if (costCategoryId && isBlank(form.getValues(`items.${idx}.itemName`))) {
        const c = costCategories.find((x) => x.id === costCategoryId)
        if (c)
          form.setValue(`items.${idx}.itemName`, c.categoryName, {
            shouldValidate: true,
          })
      }
    })

  return (
    <div
      className={`rounded-md border p-3 space-y-3 ${
        isInitial ? "border-amber-300 bg-amber-50" : "bg-muted/30"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={isInitial ? "outline" : "secondary"}>
            {ROUGH_ESTIMATE_CATEGORY_LABELS[category]}
          </Badge>
          {isInitial && (
            <span className="text-[11px] text-amber-700">
              別枠・原価に含めない
            </span>
          )}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive"
          onClick={onRemove}
          disabled={!canRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* 1段目：費目区分 / 出所 / 品目 / 品目（英） */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormField
          control={form.control}
          name={`items.${idx}.itemCategory`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">費目区分</FormLabel>
              <Select
                value={field.value}
                onValueChange={(v) =>
                  preserveDialogScroll(() => {
                    const next = v as RoughEstimateCategory
                    field.onChange(next)
                    // 新しい費目区分で現在の出所が選べなくなる場合は MANUAL にリセット。
                    const cur =
                      form.getValues(`items.${idx}.source`) ??
                      RoughEstimateItemSource.MANUAL
                    if (!allowedSourcesFor(next).includes(cur)) {
                      form.setValue(
                        `items.${idx}.source`,
                        RoughEstimateItemSource.MANUAL,
                      )
                    }
                  })
                }
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent position="popper">
                  {ROUGH_ESTIMATE_CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`items.${idx}.source`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">出所</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent position="popper">
                  {/* 費目区分に応じて選べる出所を制限（確定仕様） */}
                  {SOURCE_OPTIONS.filter((o) =>
                    allowedSourcesFor(category).includes(o.value),
                  ).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`items.${idx}.itemName`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">品目 *</FormLabel>
              <FormControl>
                <Input autoComplete="off" placeholder="品目名" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`items.${idx}.itemNameEn`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">品目（英）</FormLabel>
              <FormControl>
                <Input autoComplete="off" placeholder="Item name (EN)" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      {/* 2段目：マスタ選択（A-4・MATERIAL=素材 / LABOR=費目・MANUAL でも常時表示） */}
      {(isMaterial || isLabor) && (
        <div className="flex items-end gap-2">
          {isMaterial && (
            <FormField
              control={form.control}
              name={`items.${idx}.materialId`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="text-xs">
                    素材（選ぶと品目名を補完・任意）
                  </FormLabel>
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(v) => onPickMaterial(v === NONE ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="素材を選択（任意）" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent position="popper">
                      <SelectItem value={NONE}>（未選択）</SelectItem>
                      {materials.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            {m.materialCode}
                          </span>
                          {m.materialName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          )}
          {isLabor && (
            <FormField
              control={form.control}
              name={`items.${idx}.costCategoryId`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="text-xs">
                    費目（選ぶと品目名を補完・任意）
                  </FormLabel>
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(v) =>
                      onPickCostCategory(v === NONE ? null : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="費目を選択（任意）" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent position="popper">
                      <SelectItem value={NONE}>（未選択）</SelectItem>
                      {costCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            {c.categoryCode}
                          </span>
                          {c.categoryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          )}
          {source === RoughEstimateItemSource.PAST_PO && isMaterial && (
            <PastPoSearch form={form} idx={idx} suppliers={suppliers} />
          )}
          {source === RoughEstimateItemSource.PAST_WO && isLabor && (
            <PastWoSearch
              form={form}
              idx={idx}
              costCategoryId={itemValue?.costCategoryId ?? null}
            />
          )}
        </div>
      )}

      {/* 3段目：数量 / 単位 / 単価 / 通貨 / 小計 */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <FormField
          control={form.control}
          name={`items.${idx}.quantity`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">数量</FormLabel>
              <FormControl>
                <Input autoComplete="off"
                  type="number"
                  step="any"
                  placeholder="1"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`items.${idx}.unit`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">単位</FormLabel>
              <FormControl>
                <Input autoComplete="off" placeholder="式/m/枚" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`items.${idx}.unitPrice`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">単価</FormLabel>
              <FormControl>
                <Input autoComplete="off"
                  type="number"
                  step="any"
                  placeholder="単価"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`items.${idx}.currency`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">通貨</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent position="popper">
                  {QE_CURRENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormItem>
          <FormLabel className="text-xs">小計(JPY)</FormLabel>
          <div className="flex h-9 items-center px-1 font-mono text-sm">
            {subtotalJpy === null
              ? "—"
              : `¥${subtotalJpy.toLocaleString("ja-JP")}`}
          </div>
        </FormItem>
      </div>
    </div>
  )
}

// =============================================================================
// 過去実額の検索ボタン＋結果
// PAST_PO は仕入先（PurchaseOrder.supplierId）キーで引き当て（素材未登録品目も引ける）。焼き込み。
// =============================================================================
function PastPoSearch({
  form,
  idx,
  suppliers,
}: {
  form: UseFormReturn<RoughEstimateFormValues>
  idx: number
  suppliers: SupplierOption[]
}) {
  // 検索キーはローカル state の仕入先 id（setValue 連鎖を伴わないためスクロール巻き戻りは起きない）。
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [candidates, setCandidates] = useState<PastPoItemCandidate[] | null>(null)

  const search = () => {
    if (!supplierId) {
      toast.error("仕入先を選択してください")
      return
    }
    startTransition(async () => {
      const rows = await listPastPoItemsBySupplier(supplierId)
      setCandidates(rows)
      if (rows.length === 0) toast.info("該当する過去発注明細がありません")
    })
  }
  const apply = (c: PastPoItemCandidate) =>
    preserveDialogScroll(() => {
      form.setValue(`items.${idx}.itemName`, c.displayName, {
        shouldValidate: true,
      })
      form.setValue(`items.${idx}.quantity`, c.quantity != null ? String(c.quantity) : "")
      form.setValue(`items.${idx}.unit`, c.unit ?? "")
      form.setValue(`items.${idx}.unitPrice`, String(c.unitPrice))
      form.setValue(`items.${idx}.currency`, c.currency)
      // 素材マスター品目なら materialId を焼く。自由名品目なら null（sourcePoItemId で追跡）。
      form.setValue(`items.${idx}.materialId`, c.materialId)
      form.setValue(`items.${idx}.sourcePoItemId`, c.poItemId)
      setCandidates(null)
      toast.success(`${c.poNumber} から引き当てました`)
    })

  return (
    <div className="relative flex items-end gap-2">
      <div className="w-48">
        <span className="text-xs text-muted-foreground">
          引き当て仕入先（PAST_PO）
        </span>
        <Select
          value={supplierId ?? NONE}
          onValueChange={(v) => setSupplierId(v === NONE ? null : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="仕入先を選択" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={NONE}>（未選択）</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="font-mono text-xs text-muted-foreground mr-2">
                  {s.supplierCode}
                </span>
                {s.companyName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={search}
        disabled={isPending}
        title="過去発注から検索"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="mr-1 h-4 w-4" />
        )}
        過去発注
      </Button>
      {candidates && candidates.length > 0 && (
        <div className="absolute left-0 top-full z-10 mt-1 max-h-56 w-[30rem] overflow-y-auto rounded border bg-background shadow">
          {candidates.map((c) => (
            <button
              key={c.poItemId}
              type="button"
              onClick={() => apply(c)}
              className="flex w-full flex-col gap-0.5 border-b px-2 py-1.5 text-left text-xs last:border-b-0 hover:bg-accent"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-muted-foreground">
                  {c.poNumber}
                  {c.orderDate ? ` ・ ${c.orderDate}` : ""}
                </span>
                <span className="truncate">
                  {c.poTitle ?? "（無題の発注）"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">
                  {c.displayName}
                  {(c.color || c.colorCode) && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      / {c.color ?? c.colorCode}
                    </span>
                  )}
                </span>
                <span className="font-mono whitespace-nowrap">
                  {c.currency} {c.unitPrice.toLocaleString("ja-JP")}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PastWoSearch({
  form,
  idx,
  costCategoryId,
}: {
  form: UseFormReturn<RoughEstimateFormValues>
  idx: number
  costCategoryId: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const [candidates, setCandidates] = useState<PastWoItemCandidate[] | null>(null)

  const search = () => {
    if (!costCategoryId) {
      toast.error("費目を選択してください")
      return
    }
    startTransition(async () => {
      const rows = await listPastWoItemsByCostCategory(costCategoryId)
      setCandidates(rows)
      if (rows.length === 0) toast.info("該当する過去作業発注明細がありません")
    })
  }
  const apply = (c: PastWoItemCandidate) =>
    preserveDialogScroll(() => {
      form.setValue(`items.${idx}.itemName`, c.workDescription || "（過去作業発注）", {
        shouldValidate: true,
      })
      form.setValue(`items.${idx}.quantity`, c.quantity != null ? String(c.quantity) : "")
      form.setValue(`items.${idx}.unit`, c.unit ?? "")
      form.setValue(`items.${idx}.unitPrice`, String(c.unitPrice))
      form.setValue(`items.${idx}.currency`, c.currency)
      form.setValue(`items.${idx}.costCategoryId`, c.costCategoryId)
      form.setValue(`items.${idx}.sourceWoItemId`, c.woItemId)
      setCandidates(null)
      toast.success(`${c.woNumber} から引き当てました`)
    })

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={search}
        disabled={isPending}
        title="過去作業発注から検索"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="mr-1 h-4 w-4" />
        )}
        過去作業発注
      </Button>
      {candidates && candidates.length > 0 && (
        <div className="absolute right-0 z-10 mt-1 max-h-56 w-96 overflow-y-auto rounded border bg-background shadow">
          {candidates.map((c) => (
            <button
              key={c.woItemId}
              type="button"
              onClick={() => apply(c)}
              className="flex w-full flex-col gap-0.5 border-b px-2 py-1.5 text-left text-xs last:border-b-0 hover:bg-accent"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-muted-foreground">
                  {c.woNumber}
                </span>
                <span className="truncate font-medium">
                  {c.woTitle ?? "（無題の作業発注）"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{c.workDescription}</span>
                <span className="font-mono">
                  {c.currency} {c.unitPrice.toLocaleString("ja-JP")}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// helpers
// =============================================================================
function isBlank(v: unknown): boolean {
  return v === "" || v === null || v === undefined
}

function toNumOrNull(v: unknown): number | null {
  if (isBlank(v)) return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** 明細行の JPY 換算小計（quantity×unitPrice→通貨換算）。数量or単価が空なら null。 */
function lineSubtotalJpy(
  it: RoughEstimateFormValues["items"][number] | undefined,
  usdRate: number | null,
): number | null {
  if (!it) return null
  const q = toNumOrNull(it.quantity)
  const p = toNumOrNull(it.unitPrice)
  if (q === null || p === null) return null
  const subtotal = q * p
  if (it.currency === Currency.USD) {
    return usdRate != null ? Math.round(subtotal * usdRate * 100) / 100 : null
  }
  return Math.round(subtotal * 100) / 100
}
