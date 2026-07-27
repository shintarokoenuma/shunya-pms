"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import {
  useForm,
  useFieldArray,
  useWatch,
  type SubmitHandler,
} from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Currency } from "@prisma/client"
import { Badge } from "@/components/ui/badge"
import {
  purchaseOrderInputSchema,
  type PurchaseOrderFormValues,
  type PurchaseOrderInput,
} from "@/lib/validators/purchase-order"
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  generateNextPoNumberPreview,
  type SupplierOption,
  type CostCategoryOption,
  type MaterialOption,
} from "@/lib/actions/purchase-orders"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CURRENCY_OPTIONS } from "@/lib/constants/currencies"
import type { OrderLinkProduct, OrderLinkSample } from "@/lib/actions/order-link"
import { primaryProductCode } from "@/lib/utils/product-code"
import { SearchableSelect } from "../../_components/searchable-select"
import {
  EXTERNAL_COST_CATEGORY_LABELS,
  EXTERNAL_COST_CATEGORY_ORDER,
} from "@/lib/constants/cost-category-types"
import { BILLING_CLASSIFICATION_OPTIONS } from "./labels"

const NONE = "__none__"

export type PoContext = {
  progressTaskId?: string
  sampleProductionId?: string
  label?: string // 「対象: 〔ラウンド〕の〔タスク名〕」
}

type Props =
  | {
      mode: "create"
      suppliers: SupplierOption[]
      costCategories: CostCategoryOption[]
      materials: MaterialOption[]
      context?: PoContext
      /** B-078-4: 直アクセス作成時の品番→サンプル紐付けピッカー候補。 */
      linkOptions?: {
        products: OrderLinkProduct[]
        samples: OrderLinkSample[]
      }
    }
  | {
      mode: "edit"
      id: string
      suppliers: SupplierOption[]
      costCategories: CostCategoryOption[]
      materials: MaterialOption[]
      defaultValues: PurchaseOrderFormValues
      currentPoNumber: string
      /** B-065/(B): productColorwayId → カラーウェイ名（読み取り専用バッジ表示用）。 */
      colorwayNames?: Record<string, string>
    }

function emptyItem(
  currency: Currency = Currency.JPY,
): PurchaseOrderFormValues["items"][number] {
  return {
    materialId: null,
    productColorwayId: null,
    customItemName: "",
    description: "",
    supplierItemCode: "",
    designCode: "",
    sizeValue: "",
    sizeUnit: null,
    colorCode: "",
    specification: "",
    notes: "",
    quantity: "",
    unit: "",
    unitPrice: "",
    // 行通貨（T-0 / B-071）。新規行はヘッダ通貨を引き継ぐ。
    currency,
    costCategoryId: null,
    billingClassification: null,
    isPhysicalAsset: false,
    assetStorageStartDate: "",
    assetStorageExpiryDate: "",
  }
}

export function PurchaseOrderForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const defaultValues: PurchaseOrderFormValues =
    props.mode === "edit"
      ? props.defaultValues
      : {
          supplierId: "",
          title: "",
          description: "",
          currency: Currency.JPY,
          expectedDeliveryDate: "",
          progressTaskId: props.context?.progressTaskId ?? null,
          sampleProductionId: props.context?.sampleProductionId ?? null,
          productId: null,
          items: [emptyItem(Currency.JPY)],
        }

  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderInputSchema),
    defaultValues,
  })

  // 行通貨（T-0 / B-071）: ヘッダ通貨を変更したら「未タッチの行」だけ追従させる。
  // 判定は「行通貨＝直前のヘッダ通貨（＝継承状態）」。人が変えた行は上書きしない。
  const headerCurrency = useWatch({ control: form.control, name: "currency" })
  const prevHeaderCurrency = useRef<Currency>(defaultValues.currency)
  useEffect(() => {
    if (!headerCurrency) return
    const prev = prevHeaderCurrency.current
    if (headerCurrency === prev) return
    form.getValues("items").forEach((it, i) => {
      if (it.currency == null || it.currency === prev) {
        form.setValue(`items.${i}.currency`, headerCurrency)
      }
    })
    prevHeaderCurrency.current = headerCurrency
  }, [headerCurrency, form])

  // B-078-4: 直アクセス作成（sample 経由でない）は品番選択を必須にする（§4-1(d)）。
  const poLinkOptions = props.mode === "create" ? props.linkOptions : undefined
  const poSampleCtx =
    props.mode === "create" ? props.context?.sampleProductionId : undefined
  const directMode = !poSampleCtx && !!poLinkOptions
  const linkProducts = poLinkOptions?.products ?? []
  const selectedProductId = useWatch({ control: form.control, name: "productId" })
  const linkSamples = (poLinkOptions?.samples ?? []).filter(
    (s) => s.productId === selectedProductId,
  )

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const [preview, setPreview] = useState("")
  const [previewLoading, setPreviewLoading] = useState(props.mode === "create")

  useEffect(() => {
    if (props.mode === "edit") return
    let cancelled = false
    generateNextPoNumberPreview()
      .then((r) => {
        if (!cancelled && r.ok) setPreview(r.data.preview)
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [props.mode])

  const onSubmit: SubmitHandler<PurchaseOrderFormValues> = (values) => {
    startTransition(async () => {
      const payload = values as PurchaseOrderInput
      if (props.mode === "create") {
        const r = await createPurchaseOrder(payload)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success(`発注を作成しました（${r.data.poNumber}）`)
        router.push(`/purchase-orders/${r.data.id}`)
      } else {
        const r = await updatePurchaseOrder(props.id, payload)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success("発注を更新しました")
        router.push(`/purchase-orders/${r.data.id}`)
      }
      router.refresh()
    })
  }

  const displayedPoNumber =
    props.mode === "edit" ? props.currentPoNumber : preview || "（保存時に採番）"

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* B-078-4: 品番紐付け（直アクセス作成時・§4-1(d) 案件化強制） */}
        {directMode && (
          <Card>
            <CardHeader>
              <CardTitle>紐付け（品番）</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>品番 *</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={linkProducts.map((p) => ({
                          value: p.id,
                          label: `${primaryProductCode(p)}  ${p.productName}`,
                          keywords: `${p.productCode} ${p.clientProductCode ?? ""} ${p.productName}`,
                          node: (
                            <>
                              <span className="font-mono text-xs text-muted-foreground mr-2">
                                {primaryProductCode(p)}
                              </span>
                              {p.productName}
                            </>
                          ),
                        }))}
                        value={field.value ?? null}
                        onChange={(v) => {
                          field.onChange(v)
                          form.setValue("sampleProductionId", null)
                        }}
                        placeholder="品番を選択"
                        searchPlaceholder="品番コード・品名で検索"
                        ariaLabel="品番"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sampleProductionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>サンプル（任意）</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={[
                          { value: NONE, label: "紐付けなし" },
                          ...linkSamples.map((s) => ({
                            value: s.id,
                            label: `${s.sampleNumber} ${s.title ?? ""}`,
                            keywords: `${s.sampleNumber} ${s.title ?? ""}`,
                            node: (
                              <>
                                <span className="font-mono text-xs text-muted-foreground mr-2">
                                  {s.sampleNumber}
                                </span>
                                {s.title ?? ""}
                              </>
                            ),
                          })),
                        ]}
                        value={field.value ?? NONE}
                        onChange={(v) => field.onChange(v === NONE ? null : v)}
                        disabled={!selectedProductId}
                        placeholder="紐付けなし"
                        searchPlaceholder="SP番号・タイトルで検索"
                        ariaLabel="サンプル"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        {/* 基本情報 */}
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {props.mode === "create" && props.context?.label && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <span className="text-xs text-muted-foreground">対象</span>
                <div className="font-medium">{props.context.label}</div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="text-sm font-medium leading-none">PO番号</div>
              <Input value={displayedPoNumber} readOnly disabled className="font-mono md:w-[240px]" />
              <p className="text-xs text-muted-foreground">
                {props.mode === "create"
                  ? previewLoading
                    ? "採番候補を取得中..."
                    : "※ 採番は保存時に確定します。表示中の番号は参考です。"
                  : "PO番号は編集できません"}
              </p>
            </div>

            <FormField
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>発注先 *</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={props.suppliers.map((s) => ({
                        value: s.id,
                        label: `${s.supplierCode} ${s.companyName}`,
                        keywords: `${s.supplierCode} ${s.companyName}`,
                        node: (
                          <>
                            <span className="font-mono text-xs text-muted-foreground mr-2">
                              {s.supplierCode}
                            </span>
                            {s.companyName}
                          </>
                        ),
                      }))}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      placeholder="仕入先を選択"
                      searchPlaceholder="仕入先コード・名称で検索"
                      ariaLabel="仕入先"
                      className="md:w-[480px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>タイトル</FormLabel>
                    <FormControl>
                      <Input placeholder="例：26SS 生地手配" {...field} />
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
                    <FormLabel>通貨</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="md:w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map((o) => (
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="expectedDeliveryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>希望納期</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
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

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>摘要</FormLabel>
                  <FormControl>
                    <Textarea rows={2} maxLength={10000} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 明細 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>明細</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => append(emptyItem(form.getValues("currency")))}
              >
                <Plus className="mr-1 h-4 w-4" />
                行を追加
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {form.formState.errors.items?.message && (
              <p className="text-sm text-destructive">
                {form.formState.errors.items.message}
              </p>
            )}
            {fields.map((f, idx) => (
              <ItemRow
                key={f.id}
                idx={idx}
                form={form}
                materials={props.materials}
                costCategories={props.costCategories}
                colorwayNames={
                  props.mode === "edit" ? props.colorwayNames : undefined
                }
                onRemove={() => (fields.length > 1 ? remove(idx) : null)}
                canRemove={fields.length > 1}
              />
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            キャンセル
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {props.mode === "create" ? "作成する" : "更新する"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function ItemRow({
  idx,
  form,
  materials,
  costCategories,
  colorwayNames,
  onRemove,
  canRemove,
}: {
  idx: number
  form: ReturnType<typeof useForm<PurchaseOrderFormValues>>
  materials: MaterialOption[]
  costCategories: CostCategoryOption[]
  colorwayNames?: Record<string, string>
  onRemove: () => void
  canRemove: boolean
}) {
  const base = `items.${idx}` as const
  const isPhysicalAsset = form.watch(`items.${idx}.isPhysicalAsset`)
  const materialId = form.watch(`items.${idx}.materialId`)
  // B-065/(B): 生成された色別明細のカラーウェイを読み取り専用バッジで温存表示。
  const productColorwayId = form.watch(`items.${idx}.productColorwayId`)
  const colorwayLabel = productColorwayId
    ? colorwayNames?.[productColorwayId]
    : undefined

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            明細 {idx + 1}
          </span>
          {productColorwayId && (
            <Badge
              variant="outline"
              className="border-violet-300 text-violet-700 text-[10px]"
            >
              {colorwayLabel ?? "カラーウェイ指定"}
            </Badge>
          )}
        </div>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name={`${base}.materialId`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>素材（マスター）</FormLabel>
              <Select
                value={field.value ?? NONE}
                onValueChange={(v) => {
                  field.onChange(v === NONE ? null : v)
                  const m = materials.find((mm) => mm.id === v)
                  if (m) form.setValue(`items.${idx}.unit`, m.unit)
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="（自由入力）" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NONE}>（自由入力）</SelectItem>
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
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${base}.customItemName`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>品目名（自由入力）</FormLabel>
              <FormControl>
                <Input
                  placeholder={materialId ? "素材選択中" : "例：本体生地"}
                  disabled={!!materialId}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* v1.1 実務化項目 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <FormField
          control={form.control}
          name={`${base}.supplierItemCode`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>仕入先品番</FormLabel>
              <FormControl>
                <Input placeholder="例：20000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${base}.designCode`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>デザイン番号</FormLabel>
              <FormControl>
                <Input placeholder="例：D-A" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${base}.colorCode`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>カラー番号</FormLabel>
              <FormControl>
                <Input placeholder="例：C#100" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${base}.sizeValue`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>サイズ（数値）</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  placeholder="例：20"
                  value={field.value === null || field.value === undefined ? "" : String(field.value)}
                  onChange={(e) => field.onChange(e.target.value)}
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
          name={`${base}.sizeUnit`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>サイズ単位</FormLabel>
              <Select
                value={field.value ?? NONE}
                onValueChange={(v) =>
                  field.onChange(
                    v === NONE ? null : (v as "cm" | "mm" | "m" | "inch"),
                  )
                }
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="単位" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NONE}>（未選択）</SelectItem>
                  {["cm", "mm", "m", "inch"].map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name={`${base}.specification`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>仕様・規格</FormLabel>
            <FormControl>
              <Textarea
                rows={2}
                maxLength={10000}
                placeholder="例：エレメント金属/スライダーDA8/オープン、生地幅110cm/反50m 等"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <FormField
          control={form.control}
          name={`${base}.quantity`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>数量 *</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  value={field.value === null || field.value === undefined ? "" : String(field.value)}
                  onChange={(e) => field.onChange(e.target.value)}
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
          name={`${base}.unit`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>単位 *</FormLabel>
              <FormControl>
                <Input
                  list={`unit-suggest-${idx}`}
                  placeholder="個 / m / 反 / 一式"
                  {...field}
                />
              </FormControl>
              <datalist id={`unit-suggest-${idx}`}>
                {["個", "m", "反", "一式", "kg", "g", "巻", "セット", "枚"].map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${base}.unitPrice`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>単価（未定可）</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  placeholder="未定なら空欄"
                  value={field.value === null || field.value === undefined ? "" : String(field.value)}
                  onChange={(e) => field.onChange(e.target.value)}
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
          name={`${base}.currency`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>通貨</FormLabel>
              <Select
                value={field.value ?? Currency.JPY}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((o) => (
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name={`${base}.costCategoryId`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>費目</FormLabel>
              <Select
                value={field.value ?? NONE}
                onValueChange={(v) => field.onChange(v === NONE ? null : v)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="（未選択）" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NONE}>（未選択）</SelectItem>
                  {/* 大分類（材料→縫製→加工→諸経費）でグループ化・分類内は日本語名順（action で整列済み）。 */}
                  {EXTERNAL_COST_CATEGORY_ORDER.map((ext) => {
                    const group = costCategories.filter(
                      (c) => c.externalCategory === ext,
                    )
                    if (group.length === 0) return null
                    return (
                      <SelectGroup key={ext}>
                        <SelectLabel>
                          {EXTERNAL_COST_CATEGORY_LABELS[ext]}
                        </SelectLabel>
                        {group.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="font-mono text-xs text-muted-foreground mr-2">
                              {c.categoryCode}
                            </span>
                            {c.categoryName}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )
                  })}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${base}.billingClassification`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>売り立て区分</FormLabel>
              <Select
                value={field.value ?? NONE}
                onValueChange={(v) =>
                  field.onChange(v === NONE ? null : (v as PurchaseOrderInput["items"][number]["billingClassification"]))
                }
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="（未選択）" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NONE}>（未選択）</SelectItem>
                  {BILLING_CLASSIFICATION_OPTIONS.map((o) => (
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
      </div>

      <FormField
        control={form.control}
        name={`${base}.notes`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>メモ</FormLabel>
            <FormControl>
              <Textarea rows={2} maxLength={10000} placeholder="任意" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={`${base}.isPhysicalAsset`}
        render={({ field }) => (
          <FormItem>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={field.value === true}
                onCheckedChange={(c) => field.onChange(c === true)}
              />
              現物資産（版・型・刺繍パンチ等）
            </label>
          </FormItem>
        )}
      />
      {isPhysicalAsset && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name={`${base}.assetStorageStartDate`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>保管開始日</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>任意（運用に応じて）</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`${base}.assetStorageExpiryDate`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>保管期限</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
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
      )}
    </div>
  )
}
