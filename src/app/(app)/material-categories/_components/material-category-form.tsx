"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { MaterialCategoryStatus } from "@prisma/client"
import {
  materialCategoryInputSchema,
  type MaterialCategoryFormValues,
  type MaterialCategoryInput,
} from "@/lib/validators/material-category"
import {
  createMaterialCategory,
  updateMaterialCategory,
  listMaterialCategoryParentCandidates,
} from "@/lib/actions/material-categories"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  MATERIAL_CATEGORY_STATUS_OPTIONS,
  MATERIAL_CATEGORY_LEVEL_OPTIONS,
} from "./labels"
import { MaterialCategoryCodeSuggester } from "./material-category-code-suggester"

type ParentCandidate = {
  id: string
  categoryCode: string
  categoryName: string
  level: number
}

type Props = {
  mode: "create" | "edit"
  initialId?: string
  initialValues?: Partial<MaterialCategoryFormValues>
}

const emptyDefaults: MaterialCategoryFormValues = {
  categoryCode: "",
  categoryName: "",
  categoryNameEn: "",
  parentCategoryId: null,
  level: 1,
  status: MaterialCategoryStatus.ACTIVE,
}

export function MaterialCategoryForm({
  mode,
  initialId,
  initialValues,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [parentCandidates, setParentCandidates] = useState<ParentCandidate[]>(
    [],
  )
  const [parentLoading, setParentLoading] = useState(false)

  const form = useForm<MaterialCategoryFormValues>({
    resolver: zodResolver(materialCategoryInputSchema),
    defaultValues: { ...emptyDefaults, ...initialValues },
  })

  const watchedLevel = form.watch("level")
  const currentLevel = Number(watchedLevel) as 1 | 2 | 3

  useEffect(() => {
    if (currentLevel === 1) {
      setParentCandidates([])
      if (form.getValues("parentCategoryId") !== null) {
        form.setValue("parentCategoryId", null)
      }
      return
    }
    setParentLoading(true)
    listMaterialCategoryParentCandidates(currentLevel)
      .then((candidates) => setParentCandidates(candidates))
      .finally(() => setParentLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevel])

  const onSubmit = (values: MaterialCategoryFormValues) => {
    startTransition(async () => {
      const payload = values as MaterialCategoryInput

      const result =
        mode === "create"
          ? await createMaterialCategory(payload)
          : await updateMaterialCategory(initialId!, payload)

      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        mode === "create"
          ? "素材カテゴリを作成しました"
          : "素材カテゴリを更新しました",
      )
      router.push(`/material-categories/${result.data.id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* ───────────────── 基本情報 ───────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
          <CardDescription>
            素材カテゴリの識別情報。コードは会社内で一意。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="categoryName">
                カテゴリ名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="categoryName"
                {...form.register("categoryName")}
                placeholder="例：表地 / コットン / ポプリン"
                maxLength={255}
              />
              {form.formState.errors.categoryName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.categoryName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="categoryCode">
                カテゴリコード <span className="text-destructive">*</span>
              </Label>
              <Input
                id="categoryCode"
                {...form.register("categoryCode")}
                placeholder="例：FABRIC-COTTON-POPLIN"
                maxLength={50}
                className="font-mono"
              />
              {form.formState.errors.categoryCode && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.categoryCode.message}
                </p>
              )}
              <MaterialCategoryCodeSuggester
                categoryName={form.watch("categoryName") ?? ""}
                parentCategoryCode={
                  parentCandidates.find(
                    (p) => p.id === form.watch("parentCategoryId"),
                  )?.categoryCode ?? null
                }
                onSelect={(code) =>
                  form.setValue("categoryCode", code, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="categoryNameEn">カテゴリ名（英）</Label>
            <Input
              id="categoryNameEn"
              {...form.register("categoryNameEn")}
              placeholder="例：Cotton Poplin"
              maxLength={255}
            />
            {form.formState.errors.categoryNameEn && (
              <p className="text-xs text-destructive">
                {form.formState.errors.categoryNameEn.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ───────────────── 階層構造 ───────────────── */}
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
                form.setValue("parentCategoryId", null, { shouldDirty: true })
              }}
              className="flex flex-wrap gap-4"
            >
              {MATERIAL_CATEGORY_LEVEL_OPTIONS.map((o) => (
                <div key={o.value} className="flex items-center gap-2">
                  <RadioGroupItem
                    value={String(o.value)}
                    id={`level-${o.value}`}
                  />
                  <Label
                    htmlFor={`level-${o.value}`}
                    className="cursor-pointer"
                  >
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

      {/* ───────────────── ステータス ───────────────── */}
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
                form.setValue("status", v as MaterialCategoryStatus, {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATERIAL_CATEGORY_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ───────────────── 送信ボタン ───────────────── */}
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
