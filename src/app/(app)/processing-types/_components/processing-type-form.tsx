"use client"

import { useEffect, useState, useTransition } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { ProcessingTypeStatus } from "@prisma/client"
import {
  processingTypeBaseSchema,
  type ProcessingTypeFormValues,
  type ProcessingTypeInput,
} from "@/lib/validators/processing-type"
import {
  createProcessingType,
  updateProcessingType,
  generateNextProcessingTypeCodePreview,
} from "@/lib/actions/processing-types"
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
import { PROCESSING_TYPE_STATUS_OPTIONS } from "./labels"

type Props =
  | { mode: "create" }
  | {
      mode: "edit"
      id: string
      defaultValues: ProcessingTypeFormValues
      currentCode: string
    }

const CREATE_DEFAULTS: ProcessingTypeFormValues = {
  name: "",
  nameEn: "",
  description: "",
  sortOrder: 0,
  status: ProcessingTypeStatus.ACTIVE,
}

export function ProcessingTypeForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<ProcessingTypeFormValues>({
    resolver: zodResolver(processingTypeBaseSchema),
    defaultValues: props.mode === "edit" ? props.defaultValues : CREATE_DEFAULTS,
  })

  // create モード時：コードプレビュー（入力非依存・次番号）
  const [preview, setPreview] = useState("")
  const [previewLoading, setPreviewLoading] = useState(props.mode === "create")
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (props.mode === "edit") return
    let cancelled = false
    generateNextProcessingTypeCodePreview()
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

  const onSubmit: SubmitHandler<ProcessingTypeFormValues> = (values) => {
    startTransition(async () => {
      const payload = values as ProcessingTypeInput
      if (props.mode === "create") {
        const result = await createProcessingType(payload)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success(`加工種別を作成しました（${result.data.code}）`)
        router.push(`/processing-types/${result.data.id}`)
      } else {
        const result = await updateProcessingType(props.id, payload)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success("加工種別を更新しました")
        router.push(`/processing-types/${result.data.id}`)
      }
      router.refresh()
    })
  }

  const displayedCode =
    props.mode === "edit" ? props.currentCode : preview || "（保存時に採番）"

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* コード（自動採番・編集不可） */}
            <div className="space-y-1.5">
              <div className="text-sm font-medium leading-none">コード</div>
              <Input
                value={displayedCode}
                readOnly
                disabled
                className="font-mono md:w-[240px]"
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
                  コードは編集できません
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名称 *</FormLabel>
                    <FormControl>
                      <Input placeholder="例：洗い" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nameEn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名称（英語）</FormLabel>
                    <FormControl>
                      <Input placeholder="例：Washing" {...field} />
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
                  <FormLabel>補足</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="加工種別の補足説明"
                      rows={3}
                      maxLength={10000}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>並び順</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
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
                    <FormDescription>
                      小さいほど一覧の上に表示されます（既定 0）
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ステータス</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="md:w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROCESSING_TYPE_STATUS_OPTIONS.map((o) => (
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
