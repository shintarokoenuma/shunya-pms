"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
  ExpenseCategoryStatus,
  ExpenseType,
  CalculationType,
  Currency,
} from "@prisma/client"
import {
  expenseCategoryInputSchema,
  type ExpenseCategoryFormValues,
  type ExpenseCategoryInput,
} from "@/lib/validators/expense-category"
import {
  createExpenseCategory,
  updateExpenseCategory,
} from "@/lib/actions/expense-categories"
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  EXPENSE_CATEGORY_STATUS_OPTIONS,
  EXPENSE_TYPE_LABELS,
  CALCULATION_TYPE_OPTIONS,
  CALCULATION_TYPE_DESCRIPTIONS,
  CURRENCY_OPTIONS,
} from "./labels"

type Props = {
  mode: "create" | "edit"
  initialId?: string
  initialValues?: Partial<ExpenseCategoryFormValues>
}

/**
 * 業務的グルーピングごとの ExpenseType
 * SelectContent 内で SelectGroup として表示する
 */
const EXPENSE_TYPE_GROUPS: {
  label: string
  values: ExpenseType[]
}[] = [
  {
    label: "製造関連",
    values: ["PATTERN_FEE", "GRADING_FEE", "SAMPLE_FEE", "INSPECTION_FEE"],
  },
  {
    label: "加工関連",
    values: [
      "PROCESSING_FEE",
      "PRINTING_FEE",
      "EMBROIDERY_FEE",
      "WASHING_FEE",
    ],
  },
  {
    label: "輸送・通関関連",
    values: [
      "TRANSPORT_FEE",
      "CUSTOMS_FEE",
      "TARIFF",
      "IMPORT_TAX",
      "STORAGE_FEE",
    ],
  },
  {
    label: "その他",
    values: ["PHOTOGRAPHY_FEE", "RENTAL_FEE", "OTHER"],
  },
]

export function ExpenseCategoryForm({ mode, initialId, initialValues }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<ExpenseCategoryFormValues>({
    resolver: zodResolver(expenseCategoryInputSchema),
    defaultValues: {
      expenseCode: initialValues?.expenseCode ?? "",
      expenseName: initialValues?.expenseName ?? "",
      expenseNameEn: initialValues?.expenseNameEn ?? "",
      expenseType: initialValues?.expenseType ?? ExpenseType.PATTERN_FEE,
      standardAmount: initialValues?.standardAmount ?? null,
      currency: initialValues?.currency ?? Currency.JPY,
      calculationType:
        initialValues?.calculationType ?? CalculationType.FIXED,
      notes: initialValues?.notes ?? "",
      status: initialValues?.status ?? ExpenseCategoryStatus.ACTIVE,
    },
  })

  // calculationType の変化を監視（UI 制御用）
  const watchCalcType = form.watch("calculationType") ?? CalculationType.FIXED
  const isPercentage = watchCalcType === CalculationType.PERCENTAGE

  const onSubmit = (values: ExpenseCategoryFormValues) => {
    startTransition(async () => {
      const payload = values as ExpenseCategoryInput
      const result =
        mode === "create"
          ? await createExpenseCategory(payload)
          : await updateExpenseCategory(initialId!, payload)

      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        mode === "create"
          ? "諸経費カテゴリを作成しました"
          : "諸経費カテゴリを更新しました",
      )
      router.push(`/expense-categories/${result.data.id}`)
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
            諸経費カテゴリの識別情報。コードは会社内で一意。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="expenseCode">
                コード <span className="text-destructive">*</span>
              </Label>
              <Input
                id="expenseCode"
                {...form.register("expenseCode")}
                placeholder="PATTERN_FEE / INSPECTION_FEE"
                maxLength={50}
              />
              {form.formState.errors.expenseCode && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.expenseCode.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="expenseName">
                名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="expenseName"
                {...form.register("expenseName")}
                placeholder="パターン代 / 検品費"
                maxLength={100}
              />
              {form.formState.errors.expenseName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.expenseName.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expenseNameEn">英名（任意）</Label>
            <Input
              id="expenseNameEn"
              {...form.register("expenseNameEn")}
              placeholder="Pattern Fee / Inspection Fee"
              maxLength={100}
            />
            {form.formState.errors.expenseNameEn && (
              <p className="text-xs text-destructive">
                {form.formState.errors.expenseNameEn.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─────────────────── 分類 ─────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>分類</CardTitle>
          <CardDescription>
            業務上の費用種別。見積もりエンジン側のカテゴリ分けに使用されます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label htmlFor="expenseType">
              費用種別 <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.watch("expenseType")}
              onValueChange={(v) =>
                form.setValue("expenseType", v as ExpenseType, {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="expenseType">
                <SelectValue placeholder="費用種別を選択" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_TYPE_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.values.map((v) => (
                      <SelectItem key={v} value={v}>
                        {EXPENSE_TYPE_LABELS[v]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.expenseType && (
              <p className="text-xs text-destructive">
                {form.formState.errors.expenseType.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─────────────────── 標準金額・計算方法 ─────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>標準金額・計算方法</CardTitle>
          <CardDescription>
            見積もり作成時のデフォルト値。金額未設定の場合、案件ごとに手入力します。
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
                標準金額{isPercentage ? "(%)" : "（任意）"}
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
                form.setValue("status", v as ExpenseCategoryStatus, {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="ステータス" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORY_STATUS_OPTIONS.map((opt) => (
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
