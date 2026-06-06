"use client"

import { useEffect, useState, useTransition } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
  sampleProductionBaseSchema,
  type SampleProductionFormValues,
  type SampleProductionInput,
} from "@/lib/validators/sample-production"
import {
  createSampleProduction,
  updateSampleProduction,
  generateNextSampleNumberPreview,
} from "@/lib/actions/sample-productions"
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

export type ProductRef = {
  id: string
  productCode: string
  clientProductCode: string | null
  productName: string
}

export type UserSelectOption = { id: string; name: string }

type Props =
  | {
      mode: "create"
      product: ProductRef
      parentSampleId?: string
      parentLabel?: string
      users: UserSelectOption[]
    }
  | {
      mode: "edit"
      id: string
      product: ProductRef
      users: UserSelectOption[]
      defaultValues: SampleProductionFormValues
      currentSampleNumber: string
    }

const NO_USER = "__none__"

export function SampleProductionForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const defaultValues: SampleProductionFormValues =
    props.mode === "edit"
      ? props.defaultValues
      : {
          productId: props.product.id,
          parentSampleId: props.parentSampleId ?? null,
          title: "",
          description: "",
          sampleQuantity: 1,
          plannedStartDate: "",
          plannedCompletionDate: "",
          assignedToUserId: null,
          internalNotes: "",
        }

  const form = useForm<SampleProductionFormValues>({
    resolver: zodResolver(sampleProductionBaseSchema),
    defaultValues,
  })

  // create モード時：SP番号プレビュー（入力非依存・当年の次番号）
  const [preview, setPreview] = useState("")
  const [previewLoading, setPreviewLoading] = useState(props.mode === "create")
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (props.mode === "edit") return
    let cancelled = false
    // setState はすべて async コールバック内（同期 setState を避ける）
    generateNextSampleNumberPreview()
      .then((r) => {
        if (cancelled) return
        if (r.ok) setPreview(r.data.preview)
        else setPreviewError(r.error)
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [props.mode])

  const onSubmit: SubmitHandler<SampleProductionFormValues> = (values) => {
    startTransition(async () => {
      const payload = values as SampleProductionInput
      if (props.mode === "create") {
        const result = await createSampleProduction(payload)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success(`サンプルを作成しました（${result.data.sampleNumber}）`)
        router.push(`/samples/${result.data.id}`)
      } else {
        const result = await updateSampleProduction(props.id, payload)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success("サンプルを更新しました")
        router.push(`/samples/${result.data.id}`)
      }
      router.refresh()
    })
  }

  const displayedSampleNumber =
    props.mode === "edit"
      ? props.currentSampleNumber
      : preview || "（保存時に採番）"

  const primaryCode =
    props.product.clientProductCode?.trim() || props.product.productCode

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* ───────────── カード 1: 対象品番 ───────────── */}
        <Card>
          <CardHeader>
            <CardTitle>対象品番</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="font-medium">{props.product.productName}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                {primaryCode}
                {props.product.clientProductCode?.trim() &&
                  props.product.clientProductCode.trim() !==
                    props.product.productCode && (
                    <span className="ml-2">社内: {props.product.productCode}</span>
                  )}
              </div>
            </div>

            {/* SP番号（自動採番・編集不可） */}
            <div className="space-y-1.5">
              <div className="text-sm font-medium leading-none">SP番号</div>
              <Input
                value={displayedSampleNumber}
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
                  {props.parentSampleId && props.parentLabel
                    ? `／修正サンプル（${props.parentLabel} の次ラウンド）`
                    : ""}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  SP番号は編集できません
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ───────────── カード 2: 基本情報 ───────────── */}
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>タイトル</FormLabel>
                  <FormControl>
                    <Input placeholder="例：1stサンプル / 襟修正版" {...field} />
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
                  <FormLabel>摘要・指示</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="このサンプルの目的・指示内容"
                      rows={3}
                      maxLength={10000}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sampleQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>製作数 *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      className="md:w-[160px]"
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
          </CardContent>
        </Card>

        {/* ───────────── カード 3: 予定日 ───────────── */}
        <Card>
          <CardHeader>
            <CardTitle>予定日</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="plannedStartDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>開始予定日</FormLabel>
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
            <FormField
              control={form.control}
              name="plannedCompletionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>完成予定日</FormLabel>
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

        {/* ───────────── カード 4: 担当者・メモ ───────────── */}
        <Card>
          <CardHeader>
            <CardTitle>担当者・メモ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="assignedToUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>担当者</FormLabel>
                  <Select
                    value={field.value ?? NO_USER}
                    onValueChange={(v) =>
                      field.onChange(v === NO_USER ? null : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="md:w-[280px]">
                        <SelectValue placeholder="（未選択）" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_USER}>（未選択）</SelectItem>
                      {props.users.map((u) => (
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
