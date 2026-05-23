"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { ProductCategoryStatus } from "@prisma/client"
import {
  productCategoryInputSchema,
  type ProductCategoryFormValues,
  type ProductCategoryInput,
} from "@/lib/validators/product-category"
import {
  createProductCategory,
  updateProductCategory,
  listParentCandidates,
} from "@/lib/actions/product-categories"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  PRODUCT_CATEGORY_STATUS_OPTIONS,
  PRODUCT_CATEGORY_LEVEL_OPTIONS,
} from "./labels"

type ParentCandidate = {
  id: string
  categoryCode: string
  categoryName: string
  level: number
}

type Props = {
  mode: "create" | "edit"
  initialId?: string
  initialValues?: Partial<ProductCategoryFormValues>
}

const emptyDefaults: ProductCategoryFormValues = {
  categoryCode: "",
  categoryName: "",
  categoryNameEn: "",
  parentCategoryId: null,
  level: 1,
  standardFabricUsage: null,
  standardLossRate: null,
  standardSewingFee: null,
  status: ProductCategoryStatus.ACTIVE,
}

export function ProductCategoryForm({ mode, initialId, initialValues }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [parentCandidates, setParentCandidates] = useState<ParentCandidate[]>([])
  const [parentLoading, setParentLoading] = useState(false)

  const form = useForm<ProductCategoryFormValues>({
    resolver: zodResolver(productCategoryInputSchema),
    defaultValues: { ...emptyDefaults, ...initialValues },
  })

  // level を購読し、変更時に親候補を再取得
  const watchedLevel = form.watch("level")
  // RHF の watch は string | number 両方を返しうるため number に正規化
  const currentLevel = Number(watchedLevel) as 1 | 2 | 3

  useEffect(() => {
    if (currentLevel === 1) {
      setParentCandidates([])
      // level=1 のときは parentCategoryId を null に
      if (form.getValues("parentCategoryId") !== null) {
        form.setValue("parentCategoryId", null)
      }
      return
    }
    setParentLoading(true)
    listParentCandidates(currentLevel)
      .then((candidates) => {
        setParentCandidates(candidates)
        // 編集時、既存の parentCategoryId が候補に含まれていなければクリア
        // ただし初回 mount 直後は initialValues 由来の値を尊重したいので、
        // ここでのクリアは行わない（ユーザーが手動で level を変えた場合のみ要対応）
      })
      .finally(() => setParentLoading(false))
    // 依存配列に form を入れないこと（無限ループ防止）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevel])

  const onSubmit = (values: ProductCategoryFormValues) => {
    startTransition(async () => {
      const payload = values as ProductCategoryInput

      const result =
        mode === "create"
          ? await createProductCategory(payload)
          : await updateProductCategory(initialId!, payload)

      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        mode === "create"
          ? "商品カテゴリを作成しました"
          : "商品カテゴリを更新しました",
      )
      router.push(`/product-categories/${result.data.id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* ───────────────────────── 基本情報 ───────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
          <CardDescription>
            カテゴリの識別情報。コードと名前は会社内で一意。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="categoryCode">
                カテゴリコード <span className="text-destructive">*</span>
              </Label>
              <Input
                id="categoryCode"
                {...form.register("categoryCode")}
                placeholder="TS / JK / PT"
                maxLength={10}
              />
              {form.formState.errors.categoryCode && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.categoryCode.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="categoryName">
                カテゴリ名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="categoryName"
                {...form.register("categoryName")}
                placeholder="Tシャツ"
                maxLength={100}
              />
              {form.formState.errors.categoryName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.categoryName.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="categoryNameEn">カテゴリ名（英）</Label>
            <Input
              id="categoryNameEn"
              {...form.register("categoryNameEn")}
              placeholder="T-Shirt"
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

      {/* ───────────────────────── 階層構造 ───────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>階層構造</CardTitle>
          <CardDescription>
            大分類 → 中分類 → 小分類の 3 階層で管理。中分類・小分類は親カテゴリを選んでください。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>
              階層レベル <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={String(currentLevel)}
              onValueChange={(v) => {
                form.setValue("level", Number(v) as 1 | 2 | 3, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
                // level 変更時、parent をリセットして再選択を促す
                form.setValue("parentCategoryId", null, { shouldDirty: true })
              }}
              className="flex flex-wrap gap-4"
            >
              {PRODUCT_CATEGORY_LEVEL_OPTIONS.map((o) => (
                <div key={o.value} className="flex items-center gap-2">
                  <RadioGroupItem value={String(o.value)} id={`level-${o.value}`} />
                  <Label htmlFor={`level-${o.value}`} className="cursor-pointer">
                    {o.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {form.formState.errors.level && (
              <p className="text-xs text-destructive">
                {form.formState.errors.level.message}
              </p>
            )}
          </div>

          {currentLevel !== 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="parentCategoryId">
                親カテゴリ <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.watch("parentCategoryId") ?? ""}
                onValueChange={(v) =>
                  form.setValue("parentCategoryId", v || null, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                disabled={parentLoading || parentCandidates.length === 0}
              >
                <SelectTrigger id="parentCategoryId">
                  <SelectValue
                    placeholder={
                      parentLoading
                        ? "読み込み中..."
                        : parentCandidates.length === 0
                          ? currentLevel === 2
                            ? "稼働中の大分類がありません。先に大分類を作成してください"
                            : "稼働中の中分類がありません。先に中分類を作成してください"
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
        </CardContent>
      </Card>

      {/* ───────────────────────── 標準値 ───────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>標準値（業務支援）</CardTitle>
          <CardDescription>
            見積もり時のデフォルト値として参照されます。すべて任意入力。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="standardFabricUsage">標準用尺（m / 枚）</Label>
              <Input
                id="standardFabricUsage"
                type="number"
                step="0.0001"
                min="0"
                {...form.register("standardFabricUsage")}
                placeholder="例: 1.5"
              />
              {form.formState.errors.standardFabricUsage && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.standardFabricUsage.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="standardLossRate">標準ロス率（%）</Label>
              <Input
                id="standardLossRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                {...form.register("standardLossRate")}
                placeholder="例: 3.5"
              />
              {form.formState.errors.standardLossRate && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.standardLossRate.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="standardSewingFee">標準縫製工賃（円）</Label>
              <Input
                id="standardSewingFee"
                type="number"
                step="0.01"
                min="0"
                {...form.register("standardSewingFee")}
                placeholder="例: 500"
              />
              {form.formState.errors.standardSewingFee && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.standardSewingFee.message}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ───────────────────────── ステータス ───────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>ステータス</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-w-sm">
            <Label htmlFor="status">ステータス</Label>
            <Select
              value={form.watch("status")}
              onValueChange={(v) =>
                form.setValue("status", v as ProductCategoryStatus, {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_CATEGORY_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ───────────────────────── 送信ボタン ───────────────────────── */}
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
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "作成する" : "更新する"}
        </Button>
      </div>
    </form>
  )
}
