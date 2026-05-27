"use client"

import { useEffect, useState, useTransition } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Info, Loader2 } from "lucide-react"
import {
  ModelCodeStatus,
  OwnershipType,
  type Prisma,
} from "@prisma/client"
import {
  modelCodeBaseSchema,
  type ModelCodeBaseInput,
  type ModelCodeInput,
} from "@/lib/validators/model-code"
import {
  createModelCode,
  updateModelCode,
  generateNextModelCodePreview,
} from "@/lib/actions/model-codes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import {
  MODEL_CODE_STATUS_OPTIONS,
  OWNERSHIP_TYPE_OPTIONS,
} from "./labels"

export type BrandSelectOption = {
  id: string
  brandCode: string
  brandName: string
  clientName: string | null
}

export type CategorySelectOption = {
  id: string
  categoryCode: string
  categoryName: string
  level: number
  breadcrumb: string
}

export type ReadOnlyAggregates = {
  totalRepetitions: number
  totalProductionQty: number
  totalRevenue: Prisma.Decimal | number | null
  totalPatternCost: Prisma.Decimal | number | null
  totalDesignCost: Prisma.Decimal | number | null
  costPerUnit: Prisma.Decimal | number | null
  hasPattern: boolean
  hasDesign: boolean
  hasGrading: boolean
  latestProductId: string | null
}

type Props =
  | {
      mode: "create"
      brands: BrandSelectOption[]
      categories: CategorySelectOption[]
      defaultValues?: Partial<ModelCodeBaseInput>
    }
  | {
      mode: "edit"
      id: string
      brands: BrandSelectOption[]
      categories: CategorySelectOption[]
      defaultValues: ModelCodeBaseInput
      currentModelCode: string
      aggregates: ReadOnlyAggregates
    }

const NO_CATEGORY = "__none__"

const CREATE_DEFAULTS: ModelCodeBaseInput = {
  brandId: "",
  modelName: "",
  modelNameEn: "",
  description: "",
  categoryId: null,
  silhouette: "",
  patternOwnership: OwnershipType.SHUNYA,
  designOwnership: OwnershipType.SHUNYA,
  status: ModelCodeStatus.ACTIVE,
}

function formatDecimal(
  value: Prisma.Decimal | number | null | undefined,
): string {
  if (value === null || value === undefined) return "—"
  const n =
    typeof value === "number"
      ? value
      : "toNumber" in value
        ? value.toNumber()
        : Number(value)
  if (!Number.isFinite(n)) return "—"
  return n.toLocaleString("ja-JP", { maximumFractionDigits: 4 })
}

export function ModelCodeForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<ModelCodeBaseInput>({
    resolver: zodResolver(modelCodeBaseSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : {
            ...CREATE_DEFAULTS,
            ...(props.defaultValues ?? {}),
          },
  })

  const brandId = form.watch("brandId")

  // create モード時：Brand 選択で modelCode プレビューを取得
  const [codePreview, setCodePreview] = useState("")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (props.mode === "edit") return
    if (!brandId) {
      setCodePreview("")
      setPreviewError(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)
    generateNextModelCodePreview(brandId)
      .then((r) => {
        if (cancelled) return
        if (r.ok) {
          setCodePreview(r.data.preview)
        } else {
          setCodePreview("")
          setPreviewError(r.error)
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [brandId, props.mode])

  const onSubmit: SubmitHandler<ModelCodeBaseInput> = (values) => {
    startTransition(async () => {
      const payload = values as ModelCodeInput
      if (props.mode === "create") {
        const result = await createModelCode(payload)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success(`型番を作成しました（${result.data.modelCode}）`)
        router.push(`/model-codes/${result.data.id}`)
      } else {
        const result = await updateModelCode(props.id, payload)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success("型番を更新しました")
        router.push(`/model-codes/${result.data.id}`)
      }
      router.refresh()
    })
  }

  const displayedModelCode =
    props.mode === "edit"
      ? props.currentModelCode
      : codePreview || "（ブランド選択後にプレビュー表示）"

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* ───────────────────── カード 1: 基本情報 ───────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* modelCode 表示（編集不可） */}
            <div className="space-y-1.5">
              <div className="text-sm font-medium leading-none">
                モデルコード
              </div>
              <Input
                value={displayedModelCode}
                readOnly
                disabled
                className="font-mono"
              />
              {props.mode === "create" ? (
                <p className="text-xs text-muted-foreground">
                  {previewLoading
                    ? "採番候補を取得中..."
                    : previewError
                      ? `プレビュー取得エラー：${previewError}`
                      : "※ 採番は保存時に確定します。表示中の番号は参考です。"}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  モデルコードは編集できません
                </p>
              )}
            </div>

            <FormField
              control={form.control}
              name="brandId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>関連ブランド *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="md:w-[480px]">
                        <SelectValue placeholder="ブランドを選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {props.brands.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            {b.brandCode}
                          </span>
                          {b.brandName}
                          {b.clientName && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              （{b.clientName}）
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    ブランド選択時にモデルコードが自動採番されます
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="modelName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>モデル名 *</FormLabel>
                    <FormControl>
                      <Input placeholder="例：オーバーサイズ Tシャツ" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="modelNameEn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>モデル名（英語）</FormLabel>
                    <FormControl>
                      <Input placeholder="例：Oversized T-Shirt" {...field} />
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
                  <FormLabel>説明</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="モデルの特徴・コンセプト等"
                      rows={3}
                      maxLength={10000}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ───────────────────── カード 2: 商品分類 ───────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>商品分類</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>商品カテゴリ</FormLabel>
                  <Select
                    value={field.value ?? NO_CATEGORY}
                    onValueChange={(v) =>
                      field.onChange(v === NO_CATEGORY ? null : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="md:w-[480px]">
                        <SelectValue placeholder="（未選択）" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>（未選択）</SelectItem>
                      {props.categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            {c.categoryCode}
                          </span>
                          {c.breadcrumb}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {props.categories.length === 0
                      ? "稼働中の商品カテゴリがありません。先に /product-categories から登録してください"
                      : "Lv1（大分類）/ Lv2（中分類）/ Lv3（小分類）から自由に選択できます"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="silhouette"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>シルエット</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例：オーバーサイズ / レギュラー / スリム"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ───────────────────── カード 3: 所有権 ───────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>所有権</CardTitle>
            <CardDescription>
              モデル単位の設定。個別案件で上書き可能です。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="patternOwnership"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>パターン所有権</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OWNERSHIP_TYPE_OPTIONS.map((o) => (
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
              name="designOwnership"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>デザイン所有権</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OWNERSHIP_TYPE_OPTIONS.map((o) => (
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
          </CardContent>
        </Card>

        {/* ─────────────── カード 4: 累積データ（読み取り専用） ─────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              累積データ
              <span className="text-xs font-normal text-muted-foreground inline-flex items-center gap-1">
                <Info className="h-3 w-3" />
                読み取り専用
              </span>
            </CardTitle>
            <CardDescription>
              ※ このセクションは Product / PatternVersion / DesignVersion
              が実装された段階で自動更新されます（Phase 1B 以降）
            </CardDescription>
          </CardHeader>
          <CardContent>
            {props.mode === "create" ? (
              <p className="text-sm text-muted-foreground">
                保存後、品番（Product）が発番されると累積データが表示されます。
              </p>
            ) : (
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-sm">
                <ReadOnlyRow
                  label="リピート回数"
                  value={`${props.aggregates.totalRepetitions} 回`}
                />
                <ReadOnlyRow
                  label="累計生産数"
                  value={`${props.aggregates.totalProductionQty.toLocaleString("ja-JP")} 点`}
                />
                <ReadOnlyRow
                  label="累計売上"
                  value={formatDecimal(props.aggregates.totalRevenue)}
                />
                <ReadOnlyRow
                  label="累計パターンコスト"
                  value={formatDecimal(props.aggregates.totalPatternCost)}
                />
                <ReadOnlyRow
                  label="累計デザインコスト"
                  value={formatDecimal(props.aggregates.totalDesignCost)}
                />
                <ReadOnlyRow
                  label="単位コスト"
                  value={formatDecimal(props.aggregates.costPerUnit)}
                />
              </dl>
            )}
          </CardContent>
        </Card>

        {/* ─────────────── カード 5: 保有資産（読み取り専用） ─────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              保有資産
              <span className="text-xs font-normal text-muted-foreground inline-flex items-center gap-1">
                <Info className="h-3 w-3" />
                読み取り専用
              </span>
            </CardTitle>
            <CardDescription>
              ※ このセクションは Product / PatternVersion / DesignVersion
              が実装された段階で自動更新されます（Phase 1B 以降）
            </CardDescription>
          </CardHeader>
          <CardContent>
            {props.mode === "create" ? (
              <p className="text-sm text-muted-foreground">
                保存後、パターン / グレーディング / デザインの保有状況が表示されます。
              </p>
            ) : (
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-sm">
                <ReadOnlyRow
                  label="パターン保有"
                  value={props.aggregates.hasPattern ? "あり" : "なし"}
                />
                <ReadOnlyRow
                  label="グレーディング保有"
                  value={props.aggregates.hasGrading ? "あり" : "なし"}
                />
                <ReadOnlyRow
                  label="デザイン保有"
                  value={props.aggregates.hasDesign ? "あり" : "なし"}
                />
                <ReadOnlyRow
                  label="最新使用品番"
                  value={props.aggregates.latestProductId ?? "—"}
                />
              </dl>
            )}
          </CardContent>
        </Card>

        {/* ───────────────────── カード 6: ステータス ───────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>ステータス</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ステータス</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="md:w-[240px]">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MODEL_CODE_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    ACTIVE / INACTIVE（一時休止）/ DISCONTINUED（廃番）/ ARCHIVED
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ───────────────────── 送信ボタン ───────────────────── */}
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

function ReadOnlyRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
