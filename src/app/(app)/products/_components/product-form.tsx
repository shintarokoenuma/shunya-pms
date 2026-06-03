"use client"

import { useEffect, useState, useTransition } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { ProductStatus } from "@prisma/client"
import {
  productBaseSchema,
  type ProductBaseInput,
  type ProductInput,
} from "@/lib/validators/product"
import {
  createProduct,
  updateProduct,
  generateNextProductCodePreview,
  listModelCodesForBrandSelect,
} from "@/lib/actions/products"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { PRODUCT_STATUS_OPTIONS } from "./labels"

export type BrandSelectOption = {
  id: string
  brandCode: string
  brandName: string
  clientId: string
  clientName: string | null
}

export type CategorySelectOption = {
  id: string
  categoryCode: string
  categoryName: string
  level: number
}

export type ModelCodeSelectOption = {
  id: string
  modelCode: string
  modelName: string
}

type Props =
  | {
      mode: "create"
      brands: BrandSelectOption[]
      categories: CategorySelectOption[]
      defaultValues?: Partial<ProductBaseInput>
    }
  | {
      mode: "edit"
      id: string
      brands: BrandSelectOption[]
      categories: CategorySelectOption[]
      defaultValues: ProductBaseInput
      currentProductCode: string
      currentModelCode: { id: string; modelCode: string; modelName: string }
    }

const CREATE_DEFAULTS: ProductBaseInput = {
  productName: "",
  productNameEn: "",
  description: "",
  clientProductCode: "",
  clientId: "",
  brandId: "",
  categoryId: null,
  modelCodeMode: "existing",
  modelCodeId: null,
  newModelCodeModelName: "",
  season: "",
  year: new Date().getFullYear(),
  status: ProductStatus.PLANNING,
}

export function ProductForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<ProductBaseInput>({
    resolver: zodResolver(productBaseSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : { ...CREATE_DEFAULTS, ...(props.defaultValues ?? {}) },
  })

  const brandId = form.watch("brandId")
  const categoryId = form.watch("categoryId")
  const season = form.watch("season")
  const modelCodeMode = form.watch("modelCodeMode")

  // ───────── Brand 選択 → Client 自動表示
  const selectedBrand = props.brands.find((b) => b.id === brandId)
  const displayedClientName = selectedBrand?.clientName ?? null

  // ───────── Brand 選択 → ModelCode リスト取得（mode=existing 用）
  const [modelCodes, setModelCodes] = useState<ModelCodeSelectOption[]>([])
  const [modelCodesLoading, setModelCodesLoading] = useState(false)

  useEffect(() => {
    if (props.mode === "edit") return
    if (!brandId) {
      setModelCodes([])
      return
    }
    let cancelled = false
    setModelCodesLoading(true)
    listModelCodesForBrandSelect(brandId)
      .then((rows) => {
        if (cancelled) return
        setModelCodes(rows)
      })
      .finally(() => {
        if (!cancelled) setModelCodesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [brandId, props.mode])

  // ───────── Brand 変更時に依存フィールドをクリア
  const [prevBrandId, setPrevBrandId] = useState<string>(
    props.mode === "edit" ? props.defaultValues.brandId : "",
  )
  useEffect(() => {
    if (props.mode === "edit") return
    if (brandId !== prevBrandId) {
      // 既存 ModelCode 選択をリセット
      form.setValue("modelCodeId", null)
      setPrevBrandId(brandId)
    }
  }, [brandId, prevBrandId, props.mode, form])

  // ───────── productCode プレビュー
  const [codePreview, setCodePreview] = useState("")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (props.mode === "edit") return
    if (!brandId || !categoryId || !season || season.trim() === "") {
      setCodePreview("")
      setPreviewError(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)
    generateNextProductCodePreview({ brandId, season, categoryId })
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
  }, [brandId, categoryId, season, props.mode])

  const onSubmit: SubmitHandler<ProductBaseInput> = (values) => {
    startTransition(async () => {
      const payload = values as ProductInput
      if (props.mode === "create") {
        const result = await createProduct(payload)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success(`品番を作成しました（${result.data.productCode}）`)
        router.push(`/products/${result.data.id}`)
      } else {
        const result = await updateProduct(props.id, payload)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success("品番を更新しました")
        router.push(`/products/${result.data.id}`)
      }
      router.refresh()
    })
  }

  const displayedProductCode =
    props.mode === "edit"
      ? props.currentProductCode
      : codePreview || "（ブランド・シーズン・カテゴリ選択後にプレビュー表示）"

  const isEditMode = props.mode === "edit"

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* ───── カード 1: 関連エンティティ（マスター参照） ───── */}
        <Card>
          <CardHeader>
            <CardTitle>関連エンティティ</CardTitle>
            <CardDescription>
              {isEditMode
                ? "ブランド・クライアント・カテゴリは編集できません（採番整合性のため）"
                : "ブランドを選ぶとクライアントは自動で確定します。カテゴリは社内品番の採番に使用します。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="brandId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ブランド *</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isEditMode}
                  >
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
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* クライアント（読み取り表示） */}
            <div className="space-y-1.5">
              <Label>クライアント</Label>
              <Input
                value={
                  displayedClientName ??
                  (brandId ? "—" : "（ブランド選択後に自動表示）")
                }
                readOnly
                disabled
              />
              <p className="text-xs text-muted-foreground">
                クライアントはブランドから自動導出されます（編集不可）
              </p>
            </div>

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>商品カテゴリ *</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(v === "" ? null : v)}
                    disabled={isEditMode}
                  >
                    <FormControl>
                      <SelectTrigger className="md:w-[480px]">
                        <SelectValue placeholder="カテゴリを選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {props.categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            {c.categoryCode}
                          </span>
                          {c.categoryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {props.categories.length === 0
                      ? "稼働中のカテゴリがありません。先に /product-categories で登録してください"
                      : "カテゴリの categoryCode が社内品番の一部に使われます"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ───── カード 2: モデルコード（モード切替） ───── */}
        <Card>
          <CardHeader>
            <CardTitle>モデルコード</CardTitle>
            <CardDescription>
              {isEditMode
                ? "モデルコードは編集できません"
                : "既存モデルから選ぶか、新規モデルコードを発番します"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditMode ? (
              <div className="space-y-1.5">
                <Label>現在のモデルコード</Label>
                <Input
                  value={`${props.currentModelCode.modelCode}  ${props.currentModelCode.modelName}`}
                  readOnly
                  disabled
                  className="font-mono"
                />
              </div>
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="modelCodeMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>モード</FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="flex flex-col gap-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="existing" id="mc-existing" />
                            <Label
                              htmlFor="mc-existing"
                              className="font-normal cursor-pointer"
                            >
                              既存のモデルコードから選ぶ
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="new" id="mc-new" />
                            <Label
                              htmlFor="mc-new"
                              className="font-normal cursor-pointer"
                            >
                              新規モデルコードを発番する（M-
                              {selectedBrand?.brandCode ?? "..."}-####）
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {modelCodeMode === "existing" && (
                  <FormField
                    control={form.control}
                    name="modelCodeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>既存モデルコード *</FormLabel>
                        <Select
                          value={field.value ?? ""}
                          onValueChange={(v) =>
                            field.onChange(v === "" ? null : v)
                          }
                          disabled={!brandId || modelCodesLoading}
                        >
                          <FormControl>
                            <SelectTrigger className="md:w-[480px]">
                              <SelectValue
                                placeholder={
                                  !brandId
                                    ? "先にブランドを選択してください"
                                    : modelCodesLoading
                                      ? "読み込み中..."
                                      : modelCodes.length === 0
                                        ? "稼働中モデルコードがありません"
                                        : "モデルコードを選択"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {modelCodes.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                <span className="font-mono text-xs text-muted-foreground mr-2">
                                  {m.modelCode}
                                </span>
                                {m.modelName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {modelCodeMode === "new" && (
                  <FormField
                    control={form.control}
                    name="newModelCodeModelName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>新規モデル名 *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="例：オーバーサイズ Tシャツ"
                            maxLength={255}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          保存時に M-{selectedBrand?.brandCode ?? "..."}
                          -#### で発番されます
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ───── カード 3: 基本情報 ───── */}
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>社内品番</Label>
              <Input
                value={displayedProductCode}
                readOnly
                disabled
                className="font-mono"
              />
              {isEditMode ? (
                <p className="text-xs text-muted-foreground">
                  社内品番は編集できません
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {previewLoading
                    ? "採番候補を取得中..."
                    : previewError
                      ? `プレビュー取得エラー：${previewError}`
                      : "※ 採番は保存時に確定します。表示中の番号は参考です。"}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="productName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>商品名 *</FormLabel>
                    <FormControl>
                      <Input placeholder="例：オーバーサイズ Tシャツ" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="productNameEn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>商品名（英語）</FormLabel>
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
              name="clientProductCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>先方品番</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例：MARKA-25001"
                      maxLength={50}
                      className="md:w-[320px] font-mono"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    クライアント側で振られた品番（任意）
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>説明</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="品番の特徴・備考等"
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

        {/* ───── カード 4: シーズン ───── */}
        <Card>
          <CardHeader>
            <CardTitle>シーズン</CardTitle>
            <CardDescription>
              シーズンの seasonCode（例: 26SS）が社内品番の一部に使われます
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="season"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>シーズン *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例：26SS / 26FW / 26AW / 26Pre / 26Cruise / 26Resort"
                        maxLength={20}
                        className="font-mono"
                        disabled={isEditMode}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      2桁年 + SS/FW/AW/Pre/Cruise/Resort（例: 26SS）
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>年度 *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={2000}
                        max={2100}
                        placeholder="2026"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* ───── カード 5: ステータス ───── */}
        <Card>
          <CardHeader>
            <CardTitle>ステータス</CardTitle>
            <CardDescription>
              ステータス変更時は履歴（ProductStatusHistory）に記録されます
            </CardDescription>
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
                      <SelectTrigger className="md:w-[320px]">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRODUCT_STATUS_OPTIONS.map((o) => (
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

        {/* ───── 送信ボタン ───── */}
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
