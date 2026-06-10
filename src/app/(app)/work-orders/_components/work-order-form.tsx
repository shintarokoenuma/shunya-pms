"use client"

import { useEffect, useState, useTransition } from "react"
import { useForm, useFieldArray, type SubmitHandler } from "react-hook-form"
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

type Props = {
  mode: "create"
  factories: FactoryOption[]
  contractors: ContractorOption[]
  costCategories: CostCategoryOption[]
  context: WoContext
}

function emptyItem(): WorkOrderFormValues["items"][number] {
  return {
    workDescription: "",
    colorCode: "",
    size: "",
    quantity: "",
    unit: "",
    unitPrice: "",
    costCategoryId: null,
    billingClassification: null,
    notes: "",
  }
}

export function WorkOrderForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { context } = props

  // 発注先トグル（either のとき factory/contractor を切替）
  const [orderTo, setOrderTo] = useState<"factory" | "contractor">(
    context.orderToKind === "contractor" ? "contractor" : "factory",
  )

  const defaultValues: WorkOrderFormValues = {
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
    items: [emptyItem()],
  }

  const form = useForm<WorkOrderFormValues>({
    resolver: zodResolver(workOrderInputSchema),
    defaultValues,
  })
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const [preview, setPreview] = useState("")
  const [previewLoading, setPreviewLoading] = useState(true)

  useEffect(() => {
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
  }, [])

  const onSubmit: SubmitHandler<WorkOrderFormValues> = (values) => {
    startTransition(async () => {
      const r = await createWorkOrder(values as WorkOrderInput)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`作業発注を作成しました（${r.data.woNumber}）`)
      router.push(`/work-orders/${r.data.id}`)
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
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => {
                        field.onChange(v)
                        form.setValue("contractorId", null)
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="md:w-[480px]">
                          <SelectValue placeholder="工場を選択" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {props.factories.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            <span className="font-mono text-xs text-muted-foreground mr-2">
                              {f.factoryCode}
                            </span>
                            {f.factoryName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => {
                        field.onChange(v)
                        form.setValue("factoryId", null)
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="md:w-[480px]">
                          <SelectValue placeholder="外注先を選択" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {props.contractors.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="font-mono text-xs text-muted-foreground mr-2">
                              {c.contractorCode}
                            </span>
                            {c.contractorName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
            作成する
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
