"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
  CostCategoryStatus,
  CalculationType,
  Currency,
  type ExternalCostCategory,
} from "@prisma/client"
import {
  costCategoryInputSchema,
  type CostCategoryFormValues,
  type CostCategoryInput,
} from "@/lib/validators/cost-category"
import {
  createCostCategory,
  updateCostCategory,
  listCostCategoryParentCandidates,
} from "@/lib/actions/cost-categories"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  COST_CATEGORY_STATUS_OPTIONS,
  EXTERNAL_COST_CATEGORY_LABELS,
  CALCULATION_TYPE_OPTIONS,
  CALCULATION_TYPE_DESCRIPTIONS,
  CURRENCY_OPTIONS,
} from "./labels"
import { CodeSuggester } from "@/components/code-suggester"
import { COST_TERM_DICT } from "@/lib/constants/code-dicts/cost"

type ParentCandidate = {
  id: string
  categoryCode: string
  categoryName: string
  level: number
  externalCategory: ExternalCostCategory
}

type Props = {
  mode: "create" | "edit"
  initialId?: string
  initialValues?: Partial<CostCategoryFormValues> & {
    isSystemReserved?: boolean
  }
}

export function CostCategoryForm({ mode, initialId, initialValues }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [parentCandidates, setParentCandidates] = useState<ParentCandidate[]>(
    [],
  )

  const isSystemReserved = initialValues?.isSystemReserved ?? false

  const form = useForm<CostCategoryFormValues>({
    resolver: zodResolver(costCategoryInputSchema),
    defaultValues: {
      categoryCode: initialValues?.categoryCode ?? "",
      categoryName: initialValues?.categoryName ?? "",
      categoryNameEn: initialValues?.categoryNameEn ?? "",
      // 新規作成は Lv2 固定。編集は initialValues に従う
      level: initialValues?.level ?? 2,
      parentCategoryId: initialValues?.parentCategoryId ?? null,
      externalCategory:
        initialValues?.externalCategory ?? ("MATERIAL" as ExternalCostCategory),
      standardAmount: initialValues?.standardAmount ?? null,
      currency: initialValues?.currency ?? Currency.JPY,
      calculationType:
        initialValues?.calculationType ?? CalculationType.FIXED,
      notes: initialValues?.notes ?? "",
      status: initialValues?.status ?? CostCategoryStatus.ACTIVE,
    },
  })

  // 親候補ロード (Lv2 のみ)
  const currentLevel = Number(form.watch("level")) as 1 | 2
  useEffect(() => {
    if (currentLevel === 2) {
      listCostCategoryParentCandidates().then((rows) =>
        setParentCandidates(rows as ParentCandidate[]),
      )
    }
  }, [currentLevel])

  // 親選択時に externalCategory を継承
  const watchedParentId = form.watch("parentCategoryId")
  useEffect(() => {
    if (currentLevel === 2 && watchedParentId) {
      const p = parentCandidates.find((c) => c.id === watchedParentId)
      if (p && p.externalCategory !== form.getValues("externalCategory")) {
        form.setValue("externalCategory", p.externalCategory, {
          shouldDirty: true,
        })
      }
    }
  }, [watchedParentId, parentCandidates, currentLevel, form])

  const watchCalcType = form.watch("calculationType") ?? CalculationType.FIXED
  const isPercentage = watchCalcType === CalculationType.PERCENTAGE
  const watchedExternalCategory = form.watch("externalCategory")

  const onSubmit = (values: CostCategoryFormValues) => {
    startTransition(async () => {
      const payload = values as CostCategoryInput
      const result =
        mode === "create"
          ? await createCostCategory(payload)
          : await updateCostCategory(initialId!, payload)

      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        mode === "create"
          ? "原価費目を作成しました"
          : "原価費目を更新しました",
      )
      router.push(`/cost-categories/${result.data.id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* ─────────────────── 基本情報 ─────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
          <CardDescription>
            原価費目の識別情報。コードは会社内で一意。
            {isSystemReserved && (
              <span className="ml-1 text-destructive">
                ※ システム予約行: 名称・英名のみ編集可
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="categoryName">
                名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="categoryName"
                {...form.register("categoryName")}
                placeholder="パターン代 / 検品費"
                maxLength={100}
              />
              {form.formState.errors.categoryName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.categoryName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="categoryCode">
                コード <span className="text-destructive">*</span>
              </Label>
              <Input
                id="categoryCode"
                {...form.register("categoryCode")}
                placeholder="PATTERN_FEE / INSPECTION_FEE"
                maxLength={50}
                disabled={isSystemReserved}
                className="font-mono"
              />
              {form.formState.errors.categoryCode && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.categoryCode.message}
                </p>
              )}
              {!isSystemReserved && (
                <CodeSuggester
                  name={form.watch("categoryName") ?? ""}
                  parentCode={
                    parentCandidates.find(
                      (p) => p.id === form.watch("parentCategoryId"),
                    )?.categoryCode ?? null
                  }
                  dict={COST_TERM_DICT}
                  onSelect={(code) =>
                    form.setValue("categoryCode", code, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="categoryNameEn">英名（任意）</Label>
            <Input
              id="categoryNameEn"
              {...form.register("categoryNameEn")}
              placeholder="Pattern Fee / Inspection Fee"
              maxLength={100}
            />
            {form.formState.errors.categoryNameEn && (
              <p className="text-xs text-destructive">
                {form.formState.errors.categoryNameEn.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─────────────────── 階層・大分類 ─────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>階層・大分類</CardTitle>
          <CardDescription>
            {currentLevel === 1
              ? "Lv1 (大分類) は予約 4 行のみ。新規追加・大分類変更はできません。"
              : "Lv2 (小分類) は親 (Lv1) を選んで作成。大分類は親から自動継承されます。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentLevel === 2 && !isSystemReserved && (
            <div className="space-y-1.5">
              <Label htmlFor="parentCategoryId">
                親カテゴリ (Lv1){" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.watch("parentCategoryId") ?? ""}
                onValueChange={(v) =>
                  form.setValue("parentCategoryId", v || null, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                disabled={parentCandidates.length === 0}
              >
                <SelectTrigger id="parentCategoryId">
                  <SelectValue
                    placeholder={
                      parentCandidates.length === 0
                        ? "稼働中の Lv1 カテゴリがありません"
                        : "親カテゴリを選択"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {parentCandidates.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-mono text-xs text-muted-foreground mr-2">
                        {p.categoryCode}
                      </span>
                      {p.categoryName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.parentCategoryId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.parentCategoryId.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>大分類 (自動)</Label>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {EXTERNAL_COST_CATEGORY_LABELS[watchedExternalCategory] ?? "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentLevel === 1
                ? "Lv1 では固定です。"
                : "親 (Lv1) を選ぶと自動でセットされます。"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─────────────────── 標準金額・計算方法 ─────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>標準金額・計算方法</CardTitle>
          <CardDescription>
            見積もり作成時のデフォルト値。葉ノード (Lv2) で設定します。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="calculationType">
              計算方法 <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.watch("calculationType")}
              onValueChange={(v) =>
                form.setValue("calculationType", v as CalculationType, {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="calculationType">
                <SelectValue placeholder="計算方法を選択" />
              </SelectTrigger>
              <SelectContent>
                {CALCULATION_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {CALCULATION_TYPE_DESCRIPTIONS[watchCalcType]}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="standardAmount">
                標準金額{isPercentage ? " (%)" : "（任意）"}
              </Label>
              <Input
                id="standardAmount"
                type="number"
                step="0.01"
                min="0"
                {...form.register("standardAmount")}
                placeholder={isPercentage ? "例: 3（= 3%）" : "例: 30000"}
              />
              {form.formState.errors.standardAmount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.standardAmount.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">
                通貨
                {isPercentage && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    （％時は無効）
                  </span>
                )}
              </Label>
              <Select
                value={form.watch("currency")}
                onValueChange={(v) =>
                  form.setValue("currency", v as Currency, {
                    shouldValidate: true,
                  })
                }
                disabled={isPercentage}
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="通貨" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─────────────────── ステータス・メモ ─────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>ステータス・メモ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="status">ステータス</Label>
            <Select
              value={form.watch("status")}
              onValueChange={(v) =>
                form.setValue("status", v as CostCategoryStatus, {
                  shouldValidate: true,
                })
              }
              disabled={isSystemReserved}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="ステータス" />
              </SelectTrigger>
              <SelectContent>
                {COST_CATEGORY_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">メモ</Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              placeholder="使用条件や注意事項など"
              rows={4}
              maxLength={2000}
            />
            {form.formState.errors.notes && (
              <p className="text-xs text-destructive">
                {form.formState.errors.notes.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─────────────────── アクションボタン ─────────────────── */}
      <div className="flex items-center justify-end gap-2">
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
          {mode === "create" ? "作成" : "更新"}
        </Button>
      </div>
    </form>
  )
}
