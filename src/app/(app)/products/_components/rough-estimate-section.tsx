"use client"

import { useEffect, useState, useTransition } from "react"
import { useForm, useFieldArray, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, Pencil, Trash2, Search, AlertTriangle } from "lucide-react"
import {
  Currency,
  RoughEstimateCategory,
  RoughEstimateItemSource,
  MarginRateSource,
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
  listPastPoItemsByMaterial,
  listPastWoItemsByCostCategory,
  type RoughEstimateListRow,
  type PastPoItemCandidate,
  type PastWoItemCandidate,
} from "@/lib/actions/rough-estimates"
import type {
  MaterialOption,
  CostCategoryOption,
} from "@/lib/actions/purchase-orders"
import {
  ROUGH_ESTIMATE_CATEGORY_LABELS,
  ROUGH_ESTIMATE_CATEGORY_OPTIONS,
  ROUGH_ESTIMATE_ITEM_SOURCE_LABELS,
  MARGIN_RATE_SOURCE_LABELS,
} from "@/lib/constants/rough-estimate-types"
import {
  summarizeRoughEstimate,
  type RoughEstimateLineForCalc,
} from "@/lib/rough-estimate/calc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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

type Props = {
  productId: string
  rows: RoughEstimateListRow[]
  brandDefaultMarginRate: number
  materials: MaterialOption[]
  costCategories: CostCategoryOption[]
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>見積番号</TableHead>
              <TableHead>発行日</TableHead>
              <TableHead className="text-right">提示MOQ</TableHead>
              <TableHead className="text-right">利益率</TableHead>
              <TableHead className="text-right">原価(自動)</TableHead>
              <TableHead className="text-right">提示価格(自動)</TableHead>
              <TableHead className="text-right">最終値(手打ち)</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">
                  {r.estimateNumber}
                  {r.title && (
                    <span className="ml-2 text-muted-foreground">{r.title}</span>
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
            ))}
          </TableBody>
        </Table>
      )}

      {dialogOpen && (
        <RoughEstimateFormDialog
          productId={productId}
          editingId={editingId}
          brandDefaultMarginRate={brandDefaultMarginRate}
          materials={materials}
          costCategories={costCategories}
          onClose={() => setDialogOpen(false)}
        />
      )}

      {deleting && (
        <DeleteConfirmDialog
          row={deleting}
          onClose={() => setDeleting(null)}
        />
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
  onClose,
}: {
  productId: string
  editingId: string | null
  brandDefaultMarginRate: number
  materials: MaterialOption[]
  costCategories: CostCategoryOption[]
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
      expectedQuantityBand: "",
      currency: Currency.JPY,
      validUntil: "",
      marginRate: String(brandDefaultMarginRate),
      marginRateSource: null,
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
        expectedQuantityBand: d.expectedQuantityBand ?? "",
        currency: d.currency,
        validUntil: d.validUntil ?? "",
        marginRate: d.marginRate != null ? String(d.marginRate) : "",
        marginRateSource: d.marginRateSource,
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

  // ---- ライブ集計（P2 純関数を直接使用） ----
  const watched = form.watch()
  const usdRateNum = toNumOrNull(watched.usdJpyRate)
  const marginNum = toNumOrNull(watched.marginRate)

  const lines: RoughEstimateLineForCalc[] = (watched.items ?? []).map((it) => ({
    itemCategory: it.itemCategory,
    subtotalJpy: lineSubtotalJpy(it, usdRateNum),
  }))
  const summary = summarizeRoughEstimate(lines, marginNum)

  // INITIAL_COST 行で数量未入力（単価あり）を検出（集計から静かに消えるのを防ぐ・P2注意点）。
  const initialCostMissingQty = (watched.items ?? []).some(
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
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingId ? "概算見積を編集" : "概算見積を作成"}
          </DialogTitle>
          <DialogDescription>
            量産軸の概算（提示価格）。初期費用は別枠で計上し1枚原価には混ぜません。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            読み込み中…
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-5"
            >
              {/* ヘッダ */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="md:col-span-3">
                      <FormLabel>タイトル（任意）</FormLabel>
                      <FormControl>
                        <Input placeholder="例：2026SS 概算" {...field} />
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
                      <FormLabel>提示MOQ</FormLabel>
                      <FormControl>
                        <Input
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
                  name="expectedQuantityBand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>想定数量帯</FormLabel>
                      <FormControl>
                        <Input placeholder="例：100〜300" {...field} />
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
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
                        <Input
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
                        <Input
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
                        <Input
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
                    materials={materials}
                    costCategories={costCategories}
                    usdRate={usdRateNum}
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

              {/* 集計サマリ */}
              <div className="rounded-md border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    原価小計（材料費＋工賃・INITIAL_COST 除外）
                  </span>
                  <span className="font-mono">
                    {jpy(summary.autoCostTotalJpy)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    初期費用小計（別枠・1枚原価に含めない）
                  </span>
                  <span className="font-mono text-amber-700">
                    {jpy(summary.initialCostTotalJpy)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    提示価格（自動）＝全費目 ×(1＋利益率)
                  </span>
                  <span className="font-mono font-medium">
                    {jpy(summary.autoPriceTotalJpy)}
                  </span>
                </div>

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
                          <Input
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
                      <Textarea
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
                  {isPending && (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  )}
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
// 明細1行（費目区分・source・品目日英・数量・単価・通貨・小計＋引き当てピッカー）
// =============================================================================
function ItemCard({
  form,
  idx,
  materials,
  costCategories,
  usdRate,
  onRemove,
  canRemove,
}: {
  form: ReturnType<typeof useForm<RoughEstimateFormValues>>
  idx: number
  materials: MaterialOption[]
  costCategories: CostCategoryOption[]
  usdRate: number | null
  onRemove: () => void
  canRemove: boolean
}) {
  const item = form.watch(`items.${idx}`)
  const isInitial = item?.itemCategory === RoughEstimateCategory.INITIAL_COST
  const subtotalJpy = lineSubtotalJpy(item, usdRate)

  return (
    <div
      className={`rounded-md border p-3 space-y-3 ${
        isInitial ? "border-amber-300 bg-amber-50" : "bg-muted/30"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={isInitial ? "outline" : "secondary"}>
            {ROUGH_ESTIMATE_CATEGORY_LABELS[item?.itemCategory ?? RoughEstimateCategory.MATERIAL]}
          </Badge>
          {isInitial && (
            <span className="text-[11px] text-amber-700">別枠・原価に含めない</span>
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

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <FormField
          control={form.control}
          name={`items.${idx}.itemCategory`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">費目区分</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SOURCE_OPTIONS.map((o) => (
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
                <Input placeholder="品目名" {...field} />
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
                <Input placeholder="Item name" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <FormField
          control={form.control}
          name={`items.${idx}.quantity`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">数量</FormLabel>
              <FormControl>
                <Input
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
                <Input placeholder="式/m/枚" {...field} />
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
                <Input
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
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
            {subtotalJpy === null ? "—" : `¥${subtotalJpy.toLocaleString("ja-JP")}`}
          </div>
        </FormItem>
      </div>

      {/* 引き当てピッカー（source に応じて材料 or 費目キーで過去実額を検索し行へ焼き込み） */}
      {item?.source === RoughEstimateItemSource.PAST_PO && (
        <PastPoPicker
          form={form}
          idx={idx}
          materials={materials}
        />
      )}
      {item?.source === RoughEstimateItemSource.PAST_WO && (
        <PastWoPicker
          form={form}
          idx={idx}
          costCategories={costCategories}
        />
      )}
    </div>
  )
}

// =============================================================================
// 過去 PoItem 引き当て（materialId → listPastPoItemsByMaterial → 行へ焼き込み）
// =============================================================================
function PastPoPicker({
  form,
  idx,
  materials,
}: {
  form: ReturnType<typeof useForm<RoughEstimateFormValues>>
  idx: number
  materials: MaterialOption[]
}) {
  const materialId = form.watch(`items.${idx}.materialId`)
  const [isPending, startTransition] = useTransition()
  const [candidates, setCandidates] = useState<PastPoItemCandidate[] | null>(null)

  const search = () => {
    if (!materialId) {
      toast.error("素材を選択してください")
      return
    }
    startTransition(async () => {
      const rows = await listPastPoItemsByMaterial(materialId)
      setCandidates(rows)
      if (rows.length === 0) toast.info("該当する過去発注明細がありません")
    })
  }

  const apply = (c: PastPoItemCandidate) => {
    form.setValue(`items.${idx}.itemName`, c.itemLabel ?? "（過去発注）", { shouldValidate: true })
    form.setValue(`items.${idx}.quantity`, c.quantity != null ? String(c.quantity) : "")
    form.setValue(`items.${idx}.unit`, c.unit ?? "")
    form.setValue(`items.${idx}.unitPrice`, String(c.unitPrice))
    form.setValue(`items.${idx}.currency`, c.currency)
    form.setValue(`items.${idx}.materialId`, c.materialId)
    form.setValue(`items.${idx}.sourcePoItemId`, c.poItemId)
    setCandidates(null)
    toast.success(`${c.poNumber} から引き当てました`)
  }

  return (
    <div className="rounded border border-dashed p-2 space-y-2">
      <div className="flex items-end gap-2">
        <FormField
          control={form.control}
          name={`items.${idx}.materialId`}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel className="text-xs">引き当て素材（PAST_PO）</FormLabel>
              <Select
                value={field.value ?? NONE}
                onValueChange={(v) => field.onChange(v === NONE ? null : v)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="素材を選択" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
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
        <Button type="button" variant="outline" size="sm" onClick={search} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>
      {candidates && candidates.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded border">
          {candidates.map((c) => (
            <button
              key={c.poItemId}
              type="button"
              onClick={() => apply(c)}
              className="flex w-full items-center justify-between gap-2 border-b px-2 py-1 text-left text-xs last:border-b-0 hover:bg-accent"
            >
              <span className="font-mono">{c.poNumber}</span>
              <span>{c.itemLabel ?? "—"}</span>
              <span className="font-mono">
                {c.currency} {c.unitPrice.toLocaleString("ja-JP")}
              </span>
              <span className="text-muted-foreground">{c.orderDate ?? ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// 過去 WoItem 引き当て（costCategoryId → listPastWoItemsByCostCategory → 焼き込み）
// =============================================================================
function PastWoPicker({
  form,
  idx,
  costCategories,
}: {
  form: ReturnType<typeof useForm<RoughEstimateFormValues>>
  idx: number
  costCategories: CostCategoryOption[]
}) {
  const costCategoryId = form.watch(`items.${idx}.costCategoryId`)
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

  const apply = (c: PastWoItemCandidate) => {
    form.setValue(`items.${idx}.itemName`, c.workDescription || "（過去作業発注）", { shouldValidate: true })
    form.setValue(`items.${idx}.quantity`, c.quantity != null ? String(c.quantity) : "")
    form.setValue(`items.${idx}.unit`, c.unit ?? "")
    form.setValue(`items.${idx}.unitPrice`, String(c.unitPrice))
    form.setValue(`items.${idx}.currency`, c.currency)
    form.setValue(`items.${idx}.costCategoryId`, c.costCategoryId)
    form.setValue(`items.${idx}.sourceWoItemId`, c.woItemId)
    setCandidates(null)
    toast.success(`${c.woNumber} から引き当てました`)
  }

  return (
    <div className="rounded border border-dashed p-2 space-y-2">
      <div className="flex items-end gap-2">
        <FormField
          control={form.control}
          name={`items.${idx}.costCategoryId`}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel className="text-xs">引き当て費目（PAST_WO）</FormLabel>
              <Select
                value={field.value ?? NONE}
                onValueChange={(v) => field.onChange(v === NONE ? null : v)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="費目を選択" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
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
        <Button type="button" variant="outline" size="sm" onClick={search} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>
      {candidates && candidates.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded border">
          {candidates.map((c) => (
            <button
              key={c.woItemId}
              type="button"
              onClick={() => apply(c)}
              className="flex w-full items-center justify-between gap-2 border-b px-2 py-1 text-left text-xs last:border-b-0 hover:bg-accent"
            >
              <span className="font-mono">{c.woNumber}</span>
              <span className="truncate">{c.workDescription}</span>
              <span className="font-mono">
                {c.currency} {c.unitPrice.toLocaleString("ja-JP")}
              </span>
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
