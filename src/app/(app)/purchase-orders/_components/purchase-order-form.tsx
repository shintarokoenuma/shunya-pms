"use client"

import { useEffect, useState, useTransition } from "react"
import { useForm, useFieldArray, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Currency } from "@prisma/client"
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CURRENCY_OPTIONS } from "@/lib/constants/currencies"
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
    }
  | {
      mode: "edit"
      id: string
      suppliers: SupplierOption[]
      costCategories: CostCategoryOption[]
      materials: MaterialOption[]
      defaultValues: PurchaseOrderFormValues
      currentPoNumber: string
    }

function emptyItem(): PurchaseOrderFormValues["items"][number] {
  return {
    materialId: null,
    customItemName: "",
    description: "",
    supplierItemCode: "",
    designCode: "",
    sizeSpec: "",
    colorCode: "",
    specification: "",
    notes: "",
    quantity: "",
    unit: "",
    unitPrice: "",
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
          items: [emptyItem()],
        }

  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderInputSchema),
    defaultValues,
  })
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
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="md:w-[480px]">
                        <SelectValue placeholder="仕入先を選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {props.suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            {s.supplierCode}
                          </span>
                          {s.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                onClick={() => append(emptyItem())}
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
  onRemove,
  canRemove,
}: {
  idx: number
  form: ReturnType<typeof useForm<PurchaseOrderFormValues>>
  materials: MaterialOption[]
  costCategories: CostCategoryOption[]
  onRemove: () => void
  canRemove: boolean
}) {
  const base = `items.${idx}` as const
  const isPhysicalAsset = form.watch(`items.${idx}.isPhysicalAsset`)
  const materialId = form.watch(`items.${idx}.materialId`)

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          明細 {idx + 1}
        </span>
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
          name={`${base}.sizeSpec`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>サイズ</FormLabel>
              <FormControl>
                <Input
                  list={`size-suggest-${idx}`}
                  placeholder="例：20cm / 15mm / 20L"
                  {...field}
                />
              </FormControl>
              <datalist id={`size-suggest-${idx}`}>
                <option value="cm" />
                <option value="mm" />
                <option value="L" />
              </datalist>
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
                {["個", "m", "反", "一式", "kg", "巻", "セット", "枚"].map((u) => (
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
