"use client"

import { useState, useTransition } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BrandStatus } from "@prisma/client"
import {
  brandBaseSchema,
  type BrandBaseInput,
} from "@/lib/validators/brand"
import { createBrand, updateBrand } from "@/lib/actions/brands"
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
import { BRAND_STATUS_LABEL } from "./labels"

export type ClientOption = {
  id: string
  clientCode: string
  companyName: string
}

type Props =
  | {
      mode: "create"
      clientOptions: ClientOption[]
      defaultValues?: Partial<BrandBaseInput>
    }
  | {
      mode: "edit"
      id: string
      clientOptions: ClientOption[]
      defaultValues: BrandBaseInput
    }

export function BrandForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<BrandBaseInput>({
    resolver: zodResolver(brandBaseSchema) as never,
    defaultValues: {
      clientId: "",
      brandCode: "",
      brandName: "",
      brandNameEn: "",
      logoUrl: "",
      mainColorHex: "",
      concept: "",
      defaultMarginRate: undefined,
      status: BrandStatus.ACTIVE,
      ...props.defaultValues,
    },
  })

  const onSubmit: SubmitHandler<BrandBaseInput> = (data) => {
    setServerError(null)
    startTransition(async () => {
      const action =
        props.mode === "create"
          ? () => createBrand(data)
          : () => updateBrand(props.id, data)
      const result = await action()
      if (!result.ok) {
        setServerError(result.error)
        if (result.fieldErrors) {
          for (const [k, msgs] of Object.entries(result.fieldErrors)) {
            const msg = Array.isArray(msgs) ? msgs[0] : String(msgs)
            form.setError(k as keyof BrandBaseInput, { message: msg })
          }
        }
        toast.error(result.error)
        return
      }
      toast.success(
        props.mode === "create"
          ? "ブランドを作成しました"
          : "ブランドを更新しました"
      )
      router.push(`/brands/${result.data.id}`)
      router.refresh()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {serverError && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {serverError}
          </div>
        )}

        {/* 基本情報 */}
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>クライアント *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="クライアントを選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {props.clientOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.companyName} ({c.clientCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>このブランドを所有する法人</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brandCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ブランドコード *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="MK"
                      maxLength={5}
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormDescription>
                    2~5文字の英大文字。品番略号として使われます（例: MK-26SS-TS-001）
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brandName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ブランド名 *</FormLabel>
                  <FormControl>
                    <Input placeholder="MARKA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brandNameEn"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>ブランド名（英語）</FormLabel>
                  <FormControl>
                    <Input placeholder="MARKA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ブランディング */}
        <Card>
          <CardHeader>
            <CardTitle>ブランディング</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>ロゴ URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/logo.png" {...field} />
                  </FormControl>
                  <FormDescription>外部URL。ファイルアップロードは Phase 2 で対応予定</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="mainColorHex"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>メインカラー</FormLabel>
                  <div className="flex gap-2 items-center">
                    <FormControl>
                      <Input placeholder="#000000" maxLength={7} {...field} />
                    </FormControl>
                    {field.value && /^#[0-9A-Fa-f]{6}$/.test(field.value) && (
                      <div
                        className="h-9 w-9 rounded border"
                        style={{ backgroundColor: field.value }}
                      />
                    )}
                  </div>
                  <FormDescription>#RRGGBB 形式</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="concept"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>コンセプト</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="ブランドコンセプト、世界観、ターゲット層など"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 設定 */}
        <Card>
          <CardHeader>
            <CardTitle>設定</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="defaultMarginRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>デフォルトマージン率 (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      placeholder="35"
                      value={typeof field.value === "number" ? field.value : ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? undefined : Number(e.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    見積もりエンジンのマージン4階層継承で BRAND_LEVEL として参照されます
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
                  <FormLabel>ステータス *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(BRAND_STATUS_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
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

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            キャンセル
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "送信中..." : props.mode === "create" ? "作成" : "保存"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
