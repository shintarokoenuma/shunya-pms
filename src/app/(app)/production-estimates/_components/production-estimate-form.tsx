"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  useForm,
  useFieldArray,
  useWatch,
  type SubmitHandler,
} from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  Loader2,
  Plus,
  Trash2,
  ChevronLeft,
  ArrowUp,
  ArrowDown,
  RotateCcw,
} from "lucide-react"
import {
  Currency,
  ProductionEstimateCategory,
  ProductionEstimateItemSource,
  FabricProcurementMode,
} from "@prisma/client"
import {
  productionEstimateInputSchema,
  type ProductionEstimateFormValues,
  type ProductionEstimateInput,
} from "@/lib/validators/production-estimate"
import {
  computeProductionEstimate,
  resolveFinalUnitPriceJpy,
  computeGrandTotalJpy,
  type ProductionEstimateLineForCalc,
} from "@/lib/production-estimate/calc"
import type {
  ProductionEstimateDTO,
  ProductionEstimateItemDTO,
} from "@/lib/actions/production-estimates"
import { updateProductionEstimate } from "@/lib/actions/production-estimates"
import type {
  MaterialOption,
  CostCategoryOption,
} from "@/lib/actions/purchase-orders"
import type { ProductionCostCurrency } from "@/lib/calc/production-cost"
import {
  PRODUCTION_ESTIMATE_CATEGORY_LABELS,
  PRODUCTION_ESTIMATE_SOURCE_LABELS,
  PE_CURRENCY_OPTIONS,
  PE_PROCUREMENT_MODE_OPTIONS,
} from "@/lib/constants/production-estimate-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
import { UnitSelect } from "./unit-select"
import {
  SearchableSelect,
  type SearchableOption,
} from "../../_components/searchable-select"

const PROC_NONE = "__none__"
const PICK_NONE = "__none__"

/** 空欄判定（QE-1R rough-estimate-section.tsx の isBlank と同一）。 */
function isBlankValue(v: unknown): boolean {
  return v === "" || v === null || v === undefined
}

/**
 * LABOR 数量 input で「手打ち（文字入力・削除・貼付）」とみなす InputEvent.inputType。
 * これ以外（スピナー上下ボタン・矢印キー＝inputType が空/step系）は整数へスナップする。
 * step="any" にして手打ち小数を :invalid にしない（要件: 手打ち小数可 ＞ スピナー整数）。
 */
const QTY_TYPING_INPUT_TYPES = new Set<string>([
  "insertText",
  "insertFromPaste",
  "insertCompositionText",
  "insertReplacementText",
  "deleteContentBackward",
  "deleteContentForward",
  "deleteWordBackward",
  "deleteWordForward",
  "deleteByCut",
])

/**
 * type=number（step="any"）の onChange で使う共通スナップ。
 * 手打ち（inputType が上記の編集系）は素通し、スピナー上下ボタン・矢印キー由来
 * （inputType が編集系でない＝空等）で非整数になった場合のみ整数へスナップする。
 * 方向は変更前値との大小で判定（Math.floor(prev)+1 / Math.ceil(prev)-1・負値は 0 に丸め）。
 */
function snapSpinnerInteger(
  inputType: string | undefined | null,
  rawValue: string,
  prevValue: number | null,
): string {
  if (
    QTY_TYPING_INPUT_TYPES.has(inputType ?? "") ||
    rawValue === "" ||
    Number.isInteger(Number(rawValue))
  ) {
    return rawValue
  }
  const prev = prevValue ?? 0
  const up = Number(rawValue) > prev
  const snapped = up ? Math.floor(prev) + 1 : Math.ceil(prev) - 1
  return String(snapped < 0 ? 0 : snapped)
}

type PEFormItem = NonNullable<ProductionEstimateFormValues["items"]>[number]

function jpy(n: number | null): string {
  return n === null ? "—" : `¥${n.toLocaleString("ja-JP")}`
}

function toNum(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function itemToFormValues(
  it: ProductionEstimateItemDTO,
): PEFormItem {
  return {
    itemCategory: it.itemCategory,
    itemName: it.itemName,
    itemNameEn: it.itemNameEn ?? "",
    materialId: it.materialId,
    costCategoryId: it.costCategoryId,
    source: it.source,
    sourcePoItemId: it.sourcePoItemId,
    sourceWoItemId: it.sourceWoItemId,
    sourceBomItemId: it.sourceBomItemId,
    unitPrice: it.unitPrice ?? "",
    currency: it.currency,
    usagePerUnit: it.usagePerUnit ?? "",
    lossRate: it.lossRate ?? 0,
    procurementMode: it.procurementMode,
    rollLength: it.rollLength ?? "",
    rollPrice: it.rollPrice ?? "",
    rollCurrency: it.rollCurrency,
    cutFee: it.cutFee ?? "",
    quantity: it.quantity ?? "",
    unit: it.unit ?? "",
    isSeparateBilling: it.isSeparateBilling,
    presentedPriceManualJpy: it.presentedPriceManualJpy ?? "",
    notes: it.notes ?? "",
  }
}

function toFormValues(
  dto: ProductionEstimateDTO,
): ProductionEstimateFormValues {
  return {
    productId: dto.productId,
    sourceSampleProductionId: dto.sourceSampleProductionId,
    title: dto.title ?? "",
    notes: dto.notes ?? "",
    estimateQuantity: dto.estimateQuantity,
    currency: dto.currency,
    exchangeRateUsdJpy: dto.exchangeRateUsdJpy ?? "",
    marginRate: dto.marginRate ?? "",
    marginRateSource: dto.marginRateSource,
    initialCostBillingMode: dto.initialCostBillingMode,
    finalUnitPriceManualJpy: dto.finalUnitPriceManualJpy ?? "",
    items: dto.items.map(itemToFormValues),
  }
}

function emptyItem(
  category: ProductionEstimateCategory,
  separate = false,
  defaultQuantity: number | null = null,
): PEFormItem {
  const isMaterial = category === ProductionEstimateCategory.MATERIAL
  return {
    itemCategory: category,
    itemName: "",
    itemNameEn: "",
    materialId: null,
    costCategoryId: null,
    source: ProductionEstimateItemSource.MANUAL,
    sourcePoItemId: null,
    sourceWoItemId: null,
    sourceBomItemId: null,
    unitPrice: "",
    currency: Currency.JPY,
    // 案A: MATERIAL 行は所要量ベース。新規行は usagePerUnit=1 既定（単価×見積数量）。
    usagePerUnit: isMaterial ? 1 : "",
    lossRate: 0,
    procurementMode: null,
    rollLength: "",
    rollPrice: "",
    rollCurrency: null,
    cutFee: "",
    // LABOR 行は追加時に見積数量を既定（工程による例外は編集可）。
    quantity: defaultQuantity != null ? defaultQuantity : "",
    unit: "",
    isSeparateBilling: separate,
    presentedPriceManualJpy: "",
    notes: "",
  }
}

/** 除外理由 → PE UI の文言（AMOUNT_UNDECIDED は「計上外（単価未入力）」＝支給/在庫引き当て運用）。 */
function excludeLabel(reason: string): string {
  if (reason === "AMOUNT_UNDECIDED") return "計上外（単価未入力）"
  if (reason === "NON_TARGET_CURRENCY") return "計算除外（対象外通貨）"
  return "計算除外"
}

/** MATERIAL 行の所要量 = 使用量/枚 × 見積数量 × (1+ロス率/100)。 */
function requirementOf(
  usagePerUnit: number | null,
  lossRate: number,
  estimateQuantity: number,
): number | null {
  if (usagePerUnit === null) return null
  return usagePerUnit * estimateQuantity * (1 + lossRate / 100)
}

function fmtNum(n: number | null): string {
  return n === null ? "—" : n.toLocaleString("ja-JP", { maximumFractionDigits: 4 })
}

type Props = {
  estimate: ProductionEstimateDTO
  /** ブランド既定利益率（marginRateSource 判定用）。 */
  brandDefaultMarginRate: number | null
  /** B-080: 素材ピッカー候補（QE-1R と同供給・companyId スコープ・有効のみ）。 */
  materials: MaterialOption[]
  /** B-080: 費目ピッカー候補。 */
  costCategories: CostCategoryOption[]
}

export function ProductionEstimateForm({
  estimate,
  brandDefaultMarginRate,
  materials,
  costCategories,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  // B-080: ピッカーの選択肢（先頭に（未選択）＝クリア用・SearchableSelect は flat）。
  const materialOptions: SearchableOption[] = [
    { value: PICK_NONE, label: "（未選択）" },
    ...materials.map((m) => ({
      value: m.id,
      label: `${m.materialCode} ${m.materialName}`,
      keywords: `${m.materialCode} ${m.materialName}`,
    })),
  ]
  const costCategoryOptions: SearchableOption[] = [
    { value: PICK_NONE, label: "（未選択）" },
    ...costCategories.map((c) => ({
      value: c.id,
      label: `${c.categoryCode} ${c.categoryName}`,
      keywords: `${c.categoryCode} ${c.categoryName}`,
    })),
  ]
  // 作成直後 Σ SKU=0 → 分母未入力。入力を促す（autoFocus・案内）。
  const initialQtyZero = estimate.estimateQuantity === 0

  const form = useForm<ProductionEstimateFormValues>({
    resolver: zodResolver(productionEstimateInputSchema),
    defaultValues: toFormValues(estimate),
  })
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "items",
  })

  // LABOR 行の数量が見積数量に「追従解除（手入力）」された行の field id 集合。
  // 追従中 = LABOR・非別枠・未 released。数量編集で release、「戻す」で再追従。
  const [releasedIds, setReleasedIds] = useState<Set<string>>(new Set())
  const initedRef = useRef(false)
  useEffect(() => {
    if (initedRef.current || fields.length === 0) return
    initedRef.current = true
    const s = new Set<string>()
    fields.forEach((f, i) => {
      const it = estimate.items[i]
      // コピー値が見積数量と不一致の LABOR 非別枠行は追従解除状態で開始（コピー値を潰さない）。
      if (
        it &&
        it.itemCategory === "LABOR" &&
        !it.isSeparateBilling &&
        it.quantity !== estimate.estimateQuantity
      ) {
        s.add(f.id)
      }
    })
    setReleasedIds(s)
  }, [fields, estimate.items, estimate.estimateQuantity])

  const isFollowing = (
    fieldId: string,
    it: PEFormItem | undefined,
  ): boolean =>
    it?.itemCategory === ProductionEstimateCategory.LABOR &&
    !(it?.isSeparateBilling ?? false) &&
    !releasedIds.has(fieldId)

  const releaseFollow = (fieldId: string) =>
    setReleasedIds((prev) => new Set(prev).add(fieldId))
  const restoreFollow = (fieldId: string, idx: number) => {
    setReleasedIds((prev) => {
      const n = new Set(prev)
      n.delete(fieldId)
      return n
    })
    form.setValue(`items.${idx}.quantity`, estimateQuantity)
  }

  const watchedItems = useWatch({ control: form.control, name: "items" })
  const watchedQty = useWatch({ control: form.control, name: "estimateQuantity" })
  const watchedMargin = useWatch({ control: form.control, name: "marginRate" })
  const watchedRate = useWatch({
    control: form.control,
    name: "exchangeRateUsdJpy",
  })
  const watchedFinal = useWatch({
    control: form.control,
    name: "finalUnitPriceManualJpy",
  })

  const items = watchedItems ?? []
  const estimateQuantity = toNum(watchedQty) ?? 0
  const marginNum = toNum(watchedMargin)
  const rateNum = toNum(watchedRate)

  const calcLines: ProductionEstimateLineForCalc[] = items.map((it, i) => ({
    id: String(i),
    itemCategory:
      it.itemCategory === ProductionEstimateCategory.MATERIAL
        ? "MATERIAL"
        : "LABOR",
    isSeparateBilling: it.isSeparateBilling ?? false,
    usagePerUnit: toNum(it.usagePerUnit),
    lossRate: toNum(it.lossRate) ?? 0,
    procurementMode: (it.procurementMode as "ROLL" | "METER" | null) ?? null,
    rollLength: toNum(it.rollLength),
    rollPrice: toNum(it.rollPrice),
    rollCurrency: (it.rollCurrency as ProductionCostCurrency | null) ?? null,
    cutFee: toNum(it.cutFee),
    unitPrice: toNum(it.unitPrice),
    currency: (it.currency ?? Currency.JPY) as ProductionCostCurrency,
    // 追従中の LABOR 行は見積数量を有効数量として計算に使う。
    quantity: isFollowing(fields[i]?.id ?? String(i), it)
      ? estimateQuantity
      : toNum(it.quantity),
    unit: (it.unit as string) || null,
    presentedPriceManualJpy: toNum(it.presentedPriceManualJpy),
  }))
  const calc = computeProductionEstimate(
    calcLines,
    estimateQuantity,
    marginNum,
    rateNum,
  )
  const finalUnit = resolveFinalUnitPriceJpy(
    calc.autoUnitPriceJpy,
    toNum(watchedFinal),
  )
  const grandTotal = computeGrandTotalJpy(
    finalUnit.valueJpy,
    estimateQuantity,
    calc.separateTotalJpy,
  )

  const onSubmit: SubmitHandler<ProductionEstimateFormValues> = (values) => {
    startTransition(async () => {
      const mr = toNum(values.marginRate)
      const marginRateSource =
        mr === null
          ? null
          : brandDefaultMarginRate !== null && mr === brandDefaultMarginRate
            ? "BRAND_DEFAULT"
            : "MANUAL_OVERRIDE"
      const estQty = toNum(values.estimateQuantity) ?? 0
      // 追従中の LABOR 行は数量を見積数量で確定保存する。
      const normalizedItems = (values.items ?? []).map((it, i) =>
        isFollowing(fields[i]?.id ?? String(i), it as PEFormItem)
          ? { ...it, quantity: estQty }
          : it,
      )
      const payload = {
        ...values,
        items: normalizedItems,
        marginRateSource,
      } as unknown as ProductionEstimateInput
      const r = await updateProductionEstimate(estimate.id, payload)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("量産見積を更新しました")
      router.push(`/production-estimates/${estimate.id}`)
      router.refresh()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href={`/production-estimates/${estimate.id}`}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              詳細に戻る
            </Link>
          </Button>
          <h1 className="mt-1 font-mono text-2xl font-semibold tracking-tight">
            {estimate.estimateNumber} を編集
          </h1>
        </div>

        {/* ヘッダ */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel>タイトル</FormLabel>
                <FormControl>
                  <Input autoComplete="off" placeholder="任意" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="estimateQuantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>見積数量（分母）</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    type="number"
                    step="1"
                    autoFocus={initialQtyZero}
                    // 0（未設定）は空欄表示にして入力を促す。
                    value={field.value ? field.value : ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                {estimateQuantity <= 0 ? (
                  <p className="text-[10px] text-amber-600">
                    SKU 量産数が未入力のため、想定数量を入力してください
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    Σ SKU 量産数を既定値に。受注前の想定数量。
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="marginRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>利益率（％）</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        snapSpinnerInteger(
                          (e.nativeEvent as InputEvent).inputType,
                          e.target.value,
                          toNum(field.value),
                        ),
                      )
                    }
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
            name="exchangeRateUsdJpy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>USD/JPY レート</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    type="number"
                    step="any"
                    inputMode="decimal"
                    placeholder="USD 行があれば必須"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        snapSpinnerInteger(
                          (e.nativeEvent as InputEvent).inputType,
                          e.target.value,
                          toNum(field.value),
                        ),
                      )
                    }
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

        {/* 明細 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">明細</h2>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  append(emptyItem(ProductionEstimateCategory.MATERIAL))
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                材料費行
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  append(
                    emptyItem(
                      ProductionEstimateCategory.LABOR,
                      false,
                      estimateQuantity,
                    ),
                  )
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                工賃行
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  append(emptyItem(ProductionEstimateCategory.LABOR, true))
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                別枠（初期費用）行
              </Button>
            </div>
          </div>

          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">
              明細がありません。上のボタンで行を追加してください。
            </p>
          )}

          {fields.map((f, idx) => {
            const it = items[idx]
            const isSeparate = it?.isSeparateBilling ?? false
            const isMaterial =
              it?.itemCategory === ProductionEstimateCategory.MATERIAL
            const rowResult = calc.rows[idx]
            return (
              <div
                key={f.id}
                className={`space-y-3 rounded-md border p-3 ${
                  // 別枠アンバー最優先 > 費目色（MATERIAL=sky / LABOR=グレー）。
                  isSeparate
                    ? "border-amber-300 bg-amber-50"
                    : isMaterial
                      ? "border-sky-200 bg-sky-50/50"
                      : "bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isSeparate ? "outline" : "secondary"}
                      className={
                        isMaterial && !isSeparate
                          ? "border-sky-300 bg-sky-100 text-sky-700"
                          : undefined
                      }
                    >
                      {PRODUCTION_ESTIMATE_CATEGORY_LABELS[
                        (it?.itemCategory as ProductionEstimateCategory) ??
                          ProductionEstimateCategory.MATERIAL
                      ]}
                    </Badge>
                    {it?.source && (
                      <Badge variant="outline" className="text-[10px]">
                        {PRODUCTION_ESTIMATE_SOURCE_LABELS[it.source]}
                      </Badge>
                    )}
                    {isSeparate && (
                      <Badge
                        variant="outline"
                        className="border-amber-300 text-amber-700"
                      >
                        別枠計上（1枚原価外）
                      </Badge>
                    )}
                    {rowResult?.excluded && !isSeparate && (
                      <Badge
                        variant="outline"
                        className="border-destructive/40 text-destructive text-[10px]"
                      >
                        {excludeLabel(rowResult.excludeReason ?? "")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={idx === 0}
                      onClick={() => move(idx, idx - 1)}
                      aria-label="上へ"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={idx === fields.length - 1}
                      onClick={() => move(idx, idx + 1)}
                      aria-label="下へ"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => remove(idx)}
                      aria-label="削除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name={`items.${idx}.itemName`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">品目名</FormLabel>
                      <FormControl>
                        <Input autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* B-080: マスターピッカー（MATERIAL=素材 / LABOR=費目）。
                    QE-1R 同挙動: id を setValue → 品目名が空欄のときのみ名称を補完（上書きしない）・
                    素材は unit も空欄時のみ補完。PE はページのため preserveDialogScroll 不要。 */}
                <FormItem>
                  <FormLabel className="text-xs">
                    {isMaterial
                      ? "素材（選ぶと品目名を補完・任意）"
                      : "費目（選ぶと品目名を補完・任意）"}
                  </FormLabel>
                  <SearchableSelect
                    options={isMaterial ? materialOptions : costCategoryOptions}
                    value={
                      (isMaterial ? it?.materialId : it?.costCategoryId) ?? null
                    }
                    onChange={(v) => {
                      const picked = v === PICK_NONE ? null : v
                      if (isMaterial) {
                        form.setValue(`items.${idx}.materialId`, picked)
                        if (picked) {
                          const m = materials.find((x) => x.id === picked)
                          if (m) {
                            if (
                              isBlankValue(
                                form.getValues(`items.${idx}.itemName`),
                              )
                            ) {
                              form.setValue(
                                `items.${idx}.itemName`,
                                m.materialName,
                                { shouldValidate: true },
                              )
                            }
                            if (
                              isBlankValue(form.getValues(`items.${idx}.unit`))
                            ) {
                              form.setValue(`items.${idx}.unit`, m.unit)
                            }
                          }
                        }
                      } else {
                        form.setValue(`items.${idx}.costCategoryId`, picked)
                        if (
                          picked &&
                          isBlankValue(form.getValues(`items.${idx}.itemName`))
                        ) {
                          const c = costCategories.find((x) => x.id === picked)
                          if (c) {
                            form.setValue(
                              `items.${idx}.itemName`,
                              c.categoryName,
                              { shouldValidate: true },
                            )
                          }
                        }
                      }
                    }}
                    placeholder={
                      isMaterial ? "素材を選択（任意）" : "費目を選択（任意）"
                    }
                    searchPlaceholder={
                      isMaterial
                        ? "素材コード・名称で検索…"
                        : "費目コード・名称で検索…"
                    }
                    ariaLabel={isMaterial ? "素材" : "費目"}
                  />
                </FormItem>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                  <FormField
                    control={form.control}
                    name={`items.${idx}.unitPrice`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">単価</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete="off"
                            type="number"
                            step="any"
                            inputMode="decimal"
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                snapSpinnerInteger(
                                  (e.nativeEvent as InputEvent).inputType,
                                  e.target.value,
                                  toNum(field.value),
                                ),
                              )
                            }
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {isMaterial ? (
                    // 案A: MATERIAL は数量・単位入力を撤去し所要量（自動）を read-only 表示。
                    <FormItem className="md:col-span-2">
                      <FormLabel className="text-xs">所要量（自動）</FormLabel>
                      <div className="flex h-9 items-center font-mono text-xs">
                        {fmtNum(
                          requirementOf(
                            toNum(it?.usagePerUnit),
                            toNum(it?.lossRate) ?? 0,
                            estimateQuantity,
                          ),
                        )}{" "}
                        {it?.unit || ""}
                      </div>
                    </FormItem>
                  ) : (
                    <>
                      <FormField
                        control={form.control}
                        name={`items.${idx}.quantity`}
                        render={({ field }) => {
                          const following = isFollowing(f.id, it)
                          return (
                            <FormItem>
                              <FormLabel className="flex items-center justify-between text-xs">
                                <span>数量</span>
                                {!following && !isSeparate && (
                                  <button
                                    type="button"
                                    onClick={() => restoreFollow(f.id, idx)}
                                    className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    見積数量に戻す
                                  </button>
                                )}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  autoComplete="off"
                                  type="number"
                                  // step="any": 手打ち小数を :invalid にせず阻害しない。
                                  // スピナー/矢印（inputType が手打ち系でない）は整数へスナップ。
                                  step="any"
                                  inputMode="decimal"
                                  value={
                                    following ? estimateQuantity : field.value ?? ""
                                  }
                                  className={
                                    following
                                      ? "bg-muted text-muted-foreground"
                                      : undefined
                                  }
                                  onChange={(e) => {
                                    const v = snapSpinnerInteger(
                                      (e.nativeEvent as InputEvent).inputType,
                                      e.target.value,
                                      toNum(
                                        following ? estimateQuantity : field.value,
                                      ),
                                    )
                                    if (following) releaseFollow(f.id)
                                    field.onChange(v)
                                  }}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                />
                              </FormControl>
                              {following && (
                                <p className="text-[10px] text-muted-foreground">
                                  見積数量に追従中
                                </p>
                              )}
                            </FormItem>
                          )
                        }}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${idx}.unit`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">単位</FormLabel>
                            <UnitSelect
                              value={(field.value as string) ?? ""}
                              onChange={field.onChange}
                            />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                  <FormField
                    control={form.control}
                    name={`items.${idx}.currency`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">通貨</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent position="popper">
                            {PE_CURRENCY_OPTIONS.map((o) => (
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
                    <FormLabel className="text-xs">1枚あたり</FormLabel>
                    <div className="flex h-9 items-center font-mono text-xs font-medium">
                      {jpy(rowResult?.perUnitJpy ?? null)}
                    </div>
                  </FormItem>
                  <FormItem>
                    <FormLabel className="text-xs">行小計(JPY)</FormLabel>
                    <div className="flex h-9 items-center font-mono text-xs">
                      {jpy(rowResult?.subtotalJpy ?? null)}
                    </div>
                  </FormItem>
                </div>

                {/* 生地行の量計算材料 */}
                {isMaterial && (
                  <div className="grid grid-cols-2 gap-2 rounded-md border border-dashed p-2 md:grid-cols-5">
                    <FormField
                      control={form.control}
                      name={`items.${idx}.usagePerUnit`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">使用量/枚</FormLabel>
                          <FormControl>
                            <Input
                              autoComplete="off"
                              type="number"
                              step="any"
                              inputMode="decimal"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  snapSpinnerInteger(
                                    (e.nativeEvent as InputEvent).inputType,
                                    e.target.value,
                                    toNum(field.value),
                                  ),
                                )
                              }
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${idx}.unit`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">単位</FormLabel>
                          <UnitSelect
                            value={(field.value as string) ?? ""}
                            onChange={field.onChange}
                          />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${idx}.lossRate`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">ロス率(％)</FormLabel>
                          <FormControl>
                            <Input
                              autoComplete="off"
                              type="number"
                              step="any"
                              inputMode="decimal"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  snapSpinnerInteger(
                                    (e.nativeEvent as InputEvent).inputType,
                                    e.target.value,
                                    toNum(field.value),
                                  ),
                                )
                              }
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${idx}.procurementMode`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">販売モード</FormLabel>
                          <Select
                            value={field.value ?? PROC_NONE}
                            onValueChange={(v) => {
                              const next = v === PROC_NONE ? null : v
                              field.onChange(next)
                              // METER 以外へ切替時はカット代をクリア（バグ修正・二重ガードの2段目）。
                              if (next !== FabricProcurementMode.METER) {
                                form.setValue(`items.${idx}.cutFee`, "")
                              }
                            }}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent position="popper">
                              <SelectItem value={PROC_NONE}>—（付属）</SelectItem>
                              {PE_PROCUREMENT_MODE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${idx}.cutFee`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">カット代</FormLabel>
                          <FormControl>
                            <Input
                              autoComplete="off"
                              type="number"
                              step="any"
                              inputMode="decimal"
                              placeholder={
                                it?.procurementMode ===
                                FabricProcurementMode.METER
                                  ? "総額"
                                  : "METER のみ"
                              }
                              disabled={
                                it?.procurementMode !==
                                FabricProcurementMode.METER
                              }
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  snapSpinnerInteger(
                                    (e.nativeEvent as InputEvent).inputType,
                                    e.target.value,
                                    toNum(field.value),
                                  ),
                                )
                              }
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          </FormControl>
                          {it?.procurementMode ===
                            FabricProcurementMode.METER &&
                            toNum(it?.cutFee) !== null &&
                            estimateQuantity > 0 && (
                              <p className="text-[10px] text-muted-foreground">
                                → ¥
                                {(
                                  (toNum(it?.cutFee) as number) /
                                  estimateQuantity
                                ).toLocaleString("ja-JP", {
                                  maximumFractionDigits: 2,
                                })}
                                /枚
                              </p>
                            )}
                        </FormItem>
                      )}
                    />
                    {it?.procurementMode === FabricProcurementMode.ROLL && (
                      <>
                        <FormField
                          control={form.control}
                          name={`items.${idx}.rollLength`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">原反長</FormLabel>
                              <FormControl>
                                <Input
                                  autoComplete="off"
                                  type="number"
                                  step="any"
                                  inputMode="decimal"
                                  value={field.value ?? ""}
                                  onChange={(e) =>
                                    field.onChange(
                                      snapSpinnerInteger(
                                        (e.nativeEvent as InputEvent).inputType,
                                        e.target.value,
                                        toNum(field.value),
                                      ),
                                    )
                                  }
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`items.${idx}.rollPrice`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">反単価</FormLabel>
                              <FormControl>
                                <Input
                                  autoComplete="off"
                                  type="number"
                                  step="any"
                                  inputMode="decimal"
                                  value={field.value ?? ""}
                                  onChange={(e) =>
                                    field.onChange(
                                      snapSpinnerInteger(
                                        (e.nativeEvent as InputEvent).inputType,
                                        e.target.value,
                                        toNum(field.value),
                                      ),
                                    )
                                  }
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`items.${idx}.rollCurrency`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">反通貨</FormLabel>
                              <Select
                                value={field.value ?? Currency.JPY}
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent position="popper">
                                  {PE_CURRENCY_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                      {o.value}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                  </div>
                )}

                {/* 別枠計上切替 */}
                <FormField
                  control={form.control}
                  name={`items.${idx}.isSeparateBilling`}
                  render={({ field }) => (
                    <FormItem>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={field.value === true}
                          onCheckedChange={(c) => field.onChange(c === true)}
                        />
                        別枠計上（初期費用）
                        <span className="text-[11px] text-muted-foreground">
                          ＝1枚原価に含めず別途請求
                        </span>
                      </label>
                    </FormItem>
                  )}
                />

                {isSeparate && (
                  <FormField
                    control={form.control}
                    name={`items.${idx}.presentedPriceManualJpy`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">
                          提示額（手打ち・税抜・円）
                        </FormLabel>
                        <FormControl>
                          <Input
                            autoComplete="off"
                            type="number"
                            step="1"
                            placeholder="計上する場合に入力（空=非計上）"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <p className="text-[10px] text-muted-foreground">
                          別枠合計に計上されるのは金額を入力した行のみ（既定は非計上）。
                        </p>
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* 集計 */}
        <div className="space-y-2 rounded-md border p-4 text-sm">
          {estimateQuantity <= 0 ? (
            <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-700">
              見積数量（分母）を入力すると計算されます
            </div>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  材料費Σ（計上）
                  <span className="ml-1 text-xs">
                    （{jpy(calc.materialPerUnitJpy)}/枚）
                  </span>
                </span>
                <span className="font-mono">
                  {jpy(calc.materialNumeratorJpy)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  工賃・付属Σ（計上）
                  <span className="ml-1 text-xs">
                    （{jpy(calc.laborPerUnitJpy)}/枚）
                  </span>
                </span>
                <span className="font-mono">
                  {jpy(calc.laborNumeratorJpy)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  1枚原価（自動＝分子÷
                  {estimateQuantity.toLocaleString("ja-JP")}）
                </span>
                <span className="font-mono">{jpy(calc.autoUnitCostJpy)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  1枚単価（自動＝×利益率）
                </span>
                <span className="font-mono">{jpy(calc.autoUnitPriceJpy)}</span>
              </div>
            </>
          )}

          <FormField
            control={form.control}
            name="finalUnitPriceManualJpy"
            render={({ field }) => (
              <FormItem className="pt-2">
                <FormLabel>最終1枚単価（手打ち・整数円）</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      autoComplete="off"
                      type="number"
                      step="1"
                      placeholder={
                        calc.autoUnitPriceJpy != null
                          ? `未入力なら自動 ¥${calc.autoUnitPriceJpy.toLocaleString("ja-JP")}`
                          : "自動値（原価×利益率）"
                      }
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  {calc.autoUnitPriceJpy != null && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        field.onChange(String(calc.autoUnitPriceJpy))
                      }
                    >
                      自動値
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  手打ちは自動値を潰さず別列保存。空なら自動1枚単価を採用。
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-between border-t pt-2">
            <span className="text-muted-foreground">別枠合計（1枚原価外）</span>
            <span className="font-mono text-amber-700">
              {jpy(calc.separateTotalJpy)}
            </span>
          </div>
          <div className="flex justify-between text-base font-medium">
            <span>
              総合計（最終単価×{estimateQuantity.toLocaleString("ja-JP")}＋別枠）
            </span>
            <span className="font-mono">{jpy(grandTotal)}</span>
          </div>
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>備考</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button asChild variant="outline" type="button">
            <Link href={`/production-estimates/${estimate.id}`}>
              変更を破棄
            </Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            更新する
          </Button>
        </div>
      </form>
    </Form>
  )
}
