"use client"

import { useEffect, useState, useTransition } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { ProductStatus, SeasonType } from "@prisma/client"
import {
  productBaseSchema,
  type ProductFormValues,
  type ProductInput,
} from "@/lib/validators/product"
import {
  createProduct,
  updateProduct,
  generateNextProductCodePreview,
} from "@/lib/actions/products"
import {
  SEASON_TYPE_OPTIONS,
  composeSeason,
} from "@/lib/constants/season-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
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
import { PRODUCT_STATUS_OPTIONS } from "./labels"

export type BrandSelectOption = {
  id: string
  brandCode: string
  brandName: string
  clientName: string | null
}

export type CategorySelectOption = {
  id: string
  categoryCode: string
  breadcrumb: string
}

export type UserSelectOption = {
  id: string
  name: string
}

type Props =
  | {
      mode: "create"
      brands: BrandSelectOption[]
      categories: CategorySelectOption[]
      users: UserSelectOption[]
      defaultValues?: Partial<ProductFormValues>
    }
  | {
      mode: "edit"
      id: string
      brands: BrandSelectOption[]
      categories: CategorySelectOption[]
      users: UserSelectOption[]
      defaultValues: ProductFormValues
      currentProductCode: string
    }

const NO_USER = "__none__"

const CREATE_DEFAULTS: ProductFormValues = {
  brandId: "",
  categoryId: "",
  clientProductCode: "",
  productName: "",
  productNameEn: "",
  description: "",
  silhouette: "",
  // season は year + seasonType から合成（サーバ側）。フォームは year と seasonType を入力。
  // seasonType は未選択（undefined）開始＝必須なので未選択だと送信時に弾く。year は当年を初期表示。
  seasonType: undefined as unknown as SeasonType,
  year: String(new Date().getFullYear()),
  expectedQuantity: "",
  desiredDeliveryDate: "",
  assignedToUserId: null,
  designerId: null,
  patternMakerId: null,
  internalNotes: "",
  status: ProductStatus.PLANNING,
}

export function ProductForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productBaseSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : { ...CREATE_DEFAULTS, ...(props.defaultValues ?? {}) },
  })

  const brandId = form.watch("brandId")
  const categoryId = form.watch("categoryId")
  const year = form.watch("year")
  const seasonType = form.watch("seasonType")

  // year プルダウン選択肢：現在年-1 〜 +3（動的）。
  const currentYear = new Date().getFullYear()
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2, currentYear + 3]

  // create モード時：Brand × year × seasonType × category 揃ったら社内品番プレビューを取得。
  // season 文字列は year + seasonType から合成して採番プレビューに渡す（保存時と同じ合成）。
  const [codePreview, setCodePreview] = useState("")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (props.mode === "edit") return
    const yearNum = typeof year === "number" ? year : Number(year)
    const yearValid = Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 2100
    // year と seasonType の両方が揃わなければプレビューを出さない（旧「season 空ならスキップ」と同等のガード）
    if (!brandId || !categoryId || !yearValid || !seasonType) {
      setCodePreview("")
      setPreviewError(null)
      return
    }
    const composed = composeSeason(yearNum, seasonType)
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)
    generateNextProductCodePreview({ brandId, categoryId, season: composed })
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
  }, [brandId, categoryId, year, seasonType, props.mode])

  const onSubmit: SubmitHandler<ProductFormValues> = (values) => {
    startTransition(async () => {
      const payload = values as ProductInput
      if (props.mode === "create") {
        const result = await createProduct(payload)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success(`品番カルテを作成しました（${result.data.productCode}）`)
        router.push(`/products/${result.data.id}`)
      } else {
        const result = await updateProduct(props.id, payload)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success("品番カルテを更新しました")
        router.push(`/products/${result.data.id}`)
      }
      router.refresh()
    })
  }

  const displayedProductCode =
    props.mode === "edit"
      ? props.currentProductCode
      : codePreview || "（ブランド・シーズン・カテゴリ選択後にプレビュー表示）"

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* ───────────── カード 1: 基本情報 ───────────── */}
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="productName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>品名 *</FormLabel>
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
                    <FormLabel>品名（英語）</FormLabel>
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
                      placeholder="品番の特徴・コンセプト等"
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

        {/* ───────────── カード 2: 品番・分類 ───────────── */}
        <Card>
          <CardHeader>
            <CardTitle>品番・分類</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 社内品番（自動採番・編集不可） */}
            <div className="space-y-1.5">
              <div className="text-sm font-medium leading-none">社内品番</div>
              <Input
                value={displayedProductCode}
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
                  社内品番は編集できません
                </p>
              )}
            </div>

            <FormField
              control={form.control}
              name="brandId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ブランド *</FormLabel>
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
                    社内品番のブランド略号とクライアントの導出に使われます
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>商品カテゴリ *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
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
                          {c.breadcrumb}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {props.categories.length === 0
                      ? "稼働中の商品カテゴリがありません。先に /product-categories から登録してください"
                      : "社内品番の採番に使われます（必須）"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clientProductCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>先方品番</FormLabel>
                    <FormControl>
                      <Input placeholder="例：MARKA-25001" {...field} />
                    </FormControl>
                    <FormDescription>
                      量産確定時に入力。一覧・詳細の主表示が先方品番に切り替わります
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
            </div>
          </CardContent>
        </Card>

        {/* ───────────── カード 3: シーズン ───────────── */}
        <Card>
          <CardHeader>
            <CardTitle>シーズン</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>年度 *</FormLabel>
                  <Select
                    value={
                      field.value === null || field.value === undefined
                        ? ""
                        : String(field.value)
                    }
                    onValueChange={(v) => field.onChange(v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="年度を選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {yearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
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
              name="seasonType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>シーズン *</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(v as SeasonType)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="シーズンを選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SEASON_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}（{o.value}）
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    年度と組み合わせて社内品番の採番に使われます（例 {currentYear % 100}SS）
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ───────────── カード 4: 担当者 ───────────── */}
        <Card>
          <CardHeader>
            <CardTitle>担当者</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UserSelectField
              control={form.control}
              name="assignedToUserId"
              label="担当者"
              users={props.users}
            />
            <UserSelectField
              control={form.control}
              name="designerId"
              label="デザイナー"
              users={props.users}
            />
            <UserSelectField
              control={form.control}
              name="patternMakerId"
              label="パタンナー"
              users={props.users}
            />
          </CardContent>
        </Card>

        {/* ───────────── カード 5: 数量・納期 ───────────── */}
        <Card>
          <CardHeader>
            <CardTitle>数量・納期</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="expectedQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>想定数量</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder="例：300"
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
              name="desiredDeliveryDate"
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
          </CardContent>
        </Card>

        {/* ───────────── カード 6: メモ + ステータス ───────────── */}
        <Card>
          <CardHeader>
            <CardTitle>メモ・ステータス</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ステータス</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="md:w-[280px]">
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
                  <FormDescription>
                    アーカイブは詳細ページの操作ボタンから行います
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="internalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>社内メモ</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="社内向けの備考"
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

        {/* ───────────── 送信ボタン ───────────── */}
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

function UserSelectField({
  control,
  name,
  label,
  users,
}: {
  control: ReturnType<typeof useForm<ProductFormValues>>["control"]
  name: "assignedToUserId" | "designerId" | "patternMakerId"
  label: string
  users: UserSelectOption[]
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            value={field.value ?? NO_USER}
            onValueChange={(v) => field.onChange(v === NO_USER ? null : v)}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="（未選択）" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value={NO_USER}>（未選択）</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
