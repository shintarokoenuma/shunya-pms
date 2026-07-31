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
import { Currency, WorkOrderType, WorkOrderCategory } from "@prisma/client"
import {
  workOrderInputSchema,
  type WorkOrderFormValues,
  type WorkOrderInput,
} from "@/lib/validators/work-order"
import {
  createWorkOrder,
  updateWorkOrder,
  generateNextWoNumberPreview,
  type FactoryOption,
  type ContractorOption,
  type CostCategoryOption,
} from "@/lib/actions/work-orders"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import type { OrderLinkProduct, OrderLinkSample } from "@/lib/actions/order-link"
import { primaryProductCode } from "@/lib/utils/product-code"
import { SearchableSelect } from "../../_components/searchable-select"
import { WORK_ORDER_TYPE_OPTIONS } from "@/lib/constants/work-order-types"
import { WORK_ORDER_CATEGORY_OPTIONS, BILLING_CLASSIFICATION_OPTIONS } from "./labels"

const NONE = "__none__"

export type WoContext = {
  progressTaskId?: string
  sampleProductionId?: string
  processingTypeId?: string | null
  label?: string // 「対象: 〔ラウンド〕の〔タスク名〕」
  /** 発注先の出し分け */
  orderToKind: "factory" | "contractor" | "either"
  suggestedWorkType: WorkOrderType
  suggestedWorkCategory: WorkOrderCategory
  /** PROCESSING 起点（workType は保存時に ProcessingType.workType で確定する旨の注記用） */
  isProcessing?: boolean
}

type Props =
  | {
      mode: "create"
      factories: FactoryOption[]
      contractors: ContractorOption[]
      costCategories: CostCategoryOption[]
      context: WoContext
      /** B-078-4: 直アクセス作成時の品番→サンプル紐付けピッカー候補（sample 経由導線では未指定）。 */
      linkOptions?: {
        products: OrderLinkProduct[]
        samples: OrderLinkSample[]
      }
    }
  | {
      // B-079: WO 編集（DRAFT のみ・PO edit と同型）
      mode: "edit"
      id: string
      factories: FactoryOption[]
      contractors: ContractorOption[]
      costCategories: CostCategoryOption[]
      defaultValues: WorkOrderFormValues
      currentWoNumber: string
    }

function emptyItem(
  currency: Currency = Currency.JPY,
): WorkOrderFormValues["items"][number] {
  return {
    workDescription: "",
    colorCode: "",
    size: "",
    quantity: "",
    unit: "",
    unitPrice: "",
    // 行通貨（T-0 / B-071）。新規行はヘッダ通貨を引き継ぐ。
    currency,
    costCategoryId: null,
    billingClassification: null,
    notes: "",
  }
}

export function WorkOrderForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEdit = props.mode === "edit"

  // 編集時は発注先種別を固定しない合成 context（トグルは either 扱い）。作成時は props.context。
  const context: WoContext =
    props.mode === "edit"
      ? {
          orderToKind: "either",
          suggestedWorkType: props.defaultValues.workType,
          suggestedWorkCategory: props.defaultValues.workCategory,
        }
      : props.context
  const linkOptions = props.mode === "create" ? props.linkOptions : undefined

  // 発注先トグル（either のとき factory/contractor を切替）。編集時は既存値から初期化。
  const [orderTo, setOrderTo] = useState<"factory" | "contractor">(
    props.mode === "edit"
      ? props.defaultValues.contractorId
        ? "contractor"
        : "factory"
      : context.orderToKind === "contractor"
        ? "contractor"
        : "factory",
  )

  const defaultValues: WorkOrderFormValues =
    props.mode === "edit"
      ? props.defaultValues
      : {
          factoryId: null,
          contractorId: null,
          workType: context.suggestedWorkType,
          workCategory: context.suggestedWorkCategory,
          title: "",
          description: "",
          currency: Currency.JPY,
          expectedDeliveryDate: "",
          progressTaskId: context.progressTaskId ?? null,
          sampleProductionId: context.sampleProductionId ?? null,
          processingTypeId: context.processingTypeId ?? null,
          productId: null,
          items: [emptyItem(Currency.JPY)],
        }

  const form = useForm<WorkOrderFormValues>({
    resolver: zodResolver(workOrderInputSchema),
    defaultValues,
  })

  // 行通貨（T-0 / B-071）: ヘッダ通貨を変更したら「未タッチの行」だけ追従させる。
  // 判定は「行通貨＝直前のヘッダ通貨（＝継承状態）」。人が行単位で変えた行は上書きしない。
  const headerCurrency = useWatch({ control: form.control, name: "currency" })
  const prevHeaderCurrency = useRef<Currency>(Currency.JPY)
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

  // B-078-4: 直アクセス作成（sample 経由でない）は品番選択を必須にする（§4-1(d)）。編集時は非表示。
  const directMode = !context.sampleProductionId && !!linkOptions
  const linkProducts = linkOptions?.products ?? []
  const selectedProductId = useWatch({ control: form.control, name: "productId" })
  const linkSamples = (linkOptions?.samples ?? []).filter(
    (s) => s.productId === selectedProductId,
  )

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const [preview, setPreview] = useState(
    props.mode === "edit" ? props.currentWoNumber : "",
  )
  const [previewLoading, setPreviewLoading] = useState(!isEdit)

  useEffect(() => {
    if (isEdit) return // 編集時は既存 WO 番号を表示（採番プレビュー不要）
    let cancelled = false
    generateNextWoNumberPreview()
      .then((r) => {
        if (!cancelled && r.ok) setPreview(r.data.preview)
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isEdit])

  const onSubmit: SubmitHandler<WorkOrderFormValues> = (values) => {
    startTransition(async () => {
      const payload = values as WorkOrderInput
      if (props.mode === "edit") {
        const r = await updateWorkOrder(props.id, payload)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success("作業発注を更新しました")
        router.push(`/work-orders/${r.data.id}`)
      } else {
        const r = await createWorkOrder(payload)
        if (!r.ok) {
          toast.error(r.error)
          return
        }
        toast.success(`作業発注を作成しました（${r.data.woNumber}）`)
        router.push(`/work-orders/${r.data.id}`)
      }
      router.refresh()
    })
  }

  const showFactory =
    context.orderToKind === "factory" ||
    (context.orderToKind === "either" && orderTo === "factory")
  const showContractor =
    context.orderToKind === "contractor" ||
    (context.orderToKind === "either" && orderTo === "contractor")

  const displayedWoNumber = preview || "（保存時に採番）"

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

        {/* 発注先 */}
        <Card>
          <CardHeader>
            <CardTitle>発注先</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {context.label && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <span className="text-xs text-muted-foreground">対象</span>
                <div className="font-medium">{context.label}</div>
              </div>
            )}

            {context.orderToKind === "either" && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={orderTo === "factory" ? "default" : "outline"}
                  onClick={() => {
                    setOrderTo("factory")
                    form.setValue("contractorId", null)
                  }}
                >
                  工場
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={orderTo === "contractor" ? "default" : "outline"}
                  onClick={() => {
                    setOrderTo("contractor")
                    form.setValue("factoryId", null)
                  }}
                >
                  外注先
                </Button>
              </div>
            )}

            {showFactory && (
              <FormField
                control={form.control}
                name="factoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>工場 *</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={props.factories.map((f) => ({
                          value: f.id,
                          label: `${f.factoryCode} ${f.factoryName}`,
                          keywords: `${f.factoryCode} ${f.factoryName}`,
                          node: (
                            <>
                              <span className="font-mono text-xs text-muted-foreground mr-2">
                                {f.factoryCode}
                              </span>
                              {f.factoryName}
                            </>
                          ),
                        }))}
                        value={field.value ?? null}
                        onChange={(v) => {
                          field.onChange(v)
                          form.setValue("contractorId", null)
                        }}
                        placeholder="工場を選択"
                        searchPlaceholder="工場コード・名称で検索"
                        ariaLabel="工場"
                        className="md:w-[480px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {showContractor && (
              <FormField
                control={form.control}
                name="contractorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>外注先 *</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={props.contractors.map((c) => ({
                          value: c.id,
                          label: `${c.contractorCode} ${c.contractorName}`,
                          keywords: `${c.contractorCode} ${c.contractorName}`,
                          node: (
                            <>
                              <span className="font-mono text-xs text-muted-foreground mr-2">
                                {c.contractorCode}
                              </span>
                              {c.contractorName}
                            </>
                          ),
                        }))}
                        value={field.value ?? null}
                        onChange={(v) => {
                          field.onChange(v)
                          form.setValue("factoryId", null)
                        }}
                        placeholder="外注先を選択"
                        searchPlaceholder="外注先コード・名称で検索"
                        ariaLabel="外注先"
                        className="md:w-[480px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {form.formState.errors.factoryId?.message && (
              <p className="text-sm text-destructive">
                {form.formState.errors.factoryId.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 基本情報 */}
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="text-sm font-medium leading-none">WO番号</div>
              <Input
                value={displayedWoNumber}
                readOnly
                disabled
                className="font-mono md:w-[240px]"
              />
              <p className="text-xs text-muted-foreground">
                {previewLoading
                  ? "採番候補を取得中..."
                  : "※ 採番は保存時に確定します。表示中の番号は参考です。"}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="workType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>作業タイプ（大分類）*</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="作業タイプを選択" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WORK_ORDER_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {context.isProcessing && (
                      <FormDescription>
                        ※ 加工起点のため、保存時に加工種別マスターの大分類で確定します。
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="workCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>発注種類タグ *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="発注種類を選択" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WORK_ORDER_CATEGORY_OPTIONS.map((o) => (
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
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>タイトル</FormLabel>
                    <FormControl>
                      <Input placeholder="例：26SS サンプル縫製" {...field} />
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

            <FormField
              control={form.control}
              name="expectedDeliveryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>希望納期</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      className="md:w-[200px]"
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
            {/* 配列全体の refine（B-074 の工程数量一致等）は RHF が root に格納する。 */}
            {(form.formState.errors.items?.message ||
              form.formState.errors.items?.root?.message) && (
              <p className="text-sm text-destructive">
                {form.formState.errors.items?.message ??
                  form.formState.errors.items?.root?.message}
              </p>
            )}
            {fields.map((f, idx) => (
              <ItemRow
                key={f.id}
                idx={idx}
                form={form}
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
            {isEdit ? "更新する" : "作成する"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function ItemRow({
  idx,
  form,
  costCategories,
  onRemove,
  canRemove,
}: {
  idx: number
  form: ReturnType<typeof useForm<WorkOrderFormValues>>
  costCategories: CostCategoryOption[]
  onRemove: () => void
  canRemove: boolean
}) {
  const base = `items.${idx}` as const

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

      <FormField
        control={form.control}
        name={`${base}.workDescription`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>作業内容 *</FormLabel>
            <FormControl>
              <Input
                placeholder="例：本縫いサンプル製作 / ストーンバイオ加工 一式"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
                  value={
                    field.value === null || field.value === undefined
                      ? ""
                      : String(field.value)
                  }
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
                <Input list={`wo-unit-suggest-${idx}`} placeholder="枚 / 着 / 一式" {...field} />
              </FormControl>
              <datalist id={`wo-unit-suggest-${idx}`}>
                {["枚", "着", "個", "一式", "点", "本", "セット"].map((u) => (
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
                  value={
                    field.value === null || field.value === undefined
                      ? ""
                      : String(field.value)
                  }
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
        <FormField
          control={form.control}
          name={`${base}.colorCode`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>カラー</FormLabel>
              <FormControl>
                <Input placeholder="任意" {...field} />
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
                  field.onChange(
                    v === NONE
                      ? null
                      : (v as WorkOrderInput["items"][number]["billingClassification"]),
                  )
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
    </div>
  )
}
