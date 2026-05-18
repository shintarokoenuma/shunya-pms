"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  ClientBusinessType,
  ClientDisplayPattern,
  ClientSize,
  ClientStatus,
  LeadSource,
} from "@prisma/client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

import {
  clientBaseSchema,
  type ClientBaseInput,
} from "@/lib/validators/client"
import { createClient, updateClient } from "@/lib/actions/clients"

import {
  BUSINESS_TYPE_LABEL,
  CLIENT_SIZE_LABEL,
  CLIENT_STATUS_LABEL,
  DISPLAY_PATTERN_LABEL,
  LEAD_SOURCE_LABEL,
} from "./labels"

type ClientFormProps =
  | {
      mode: "create"
      defaultValues?: Partial<ClientBaseInput>
    }
  | {
      mode: "edit"
      clientId: string
      defaultValues: ClientBaseInput
    }

export function ClientForm(props: ClientFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<ClientBaseInput>({
    resolver: zodResolver(clientBaseSchema) as never,
    defaultValues: {
      clientCode: "",
      companyName: "",
      legalEntity: "",
      businessType: ClientBusinessType.APPAREL_BRAND,
      country: "JP",
      phone: "",
      email: "",
      website: "",
      address: "",
      displayPattern: ClientDisplayPattern.B,
      referrer: "",
      status: ClientStatus.ACTIVE,
      notes: "",
      ...props.defaultValues,
    },
  })

  function onSubmit(values: ClientBaseInput) {
    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createClient(values)
          : await updateClient(props.clientId, values)

      if (!result.ok) {
        toast.error(result.error)
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([name, messages]) => {
            form.setError(name as keyof ClientBaseInput, {
              message: messages?.[0] ?? "入力エラー",
            })
          })
        }
        return
      }

      toast.success(
        props.mode === "create"
          ? "クライアントを作成しました"
          : "クライアントを更新しました"
      )
      router.push(`/clients/${result.data.id}`)
      router.refresh()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 基本情報 */}
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="clientCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>クライアントコード *</FormLabel>
                  <FormControl>
                    <Input placeholder="例: MARKA" {...field} />
                  </FormControl>
                  <FormDescription>英数字・ハイフン・アンダースコア</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>会社名 *</FormLabel>
                  <FormControl>
                    <Input placeholder="例: 株式会社マルカ" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="legalEntity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>法人格 / 正式名称</FormLabel>
                  <FormControl>
                    <Input placeholder="例: MARKA Co., Ltd." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 分類 */}
        <Card>
          <CardHeader>
            <CardTitle>分類</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="businessType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>業態 *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="業態を選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(BUSINESS_TYPE_LABEL).map(([v, label]) => (
                        <SelectItem key={v} value={v}>
                          {label}
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
              name="clientSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>規模</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="規模を選択（任意）" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(CLIENT_SIZE_LABEL).map(([v, label]) => (
                        <SelectItem key={v} value={v}>
                          {label}
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

        {/* 連絡先 */}
        <Card>
          <CardHeader>
            <CardTitle>連絡先</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>国コード *</FormLabel>
                  <FormControl>
                    <Input placeholder="JP" maxLength={2} {...field} />
                  </FormControl>
                  <FormDescription>ISO 3166-1 alpha-2（例: JP, US, CN, VN）</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>電話番号</FormLabel>
                  <FormControl>
                    <Input placeholder="03-1234-5678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>メールアドレス</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="info@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Webサイト</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>住所</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="〒XXX-XXXX 東京都..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 表示 */}
        <Card>
          <CardHeader>
            <CardTitle>表示</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="displayPattern"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>表示パターン *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="表示パターンを選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(DISPLAY_PATTERN_LABEL).map(([v, label]) => (
                        <SelectItem key={v} value={v}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>原価開示の段階</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 営業情報 */}
        <Card>
          <CardHeader>
            <CardTitle>営業情報</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="leadSource"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>流入経路</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="流入経路を選択（任意）" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(LEAD_SOURCE_LABEL).map(([v, label]) => (
                        <SelectItem key={v} value={v}>
                          {label}
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
              name="referrer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>紹介者</FormLabel>
                  <FormControl>
                    <Input placeholder="紹介者の名前" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 運用 */}
        <Card>
          <CardHeader>
            <CardTitle>運用</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ステータス *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="ステータスを選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(CLIENT_STATUS_LABEL).map(([v, label]) => (
                        <SelectItem key={v} value={v}>
                          {label}
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
              name="notes"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>メモ</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="社内メモ（取引履歴、特殊条件など）"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* アクション */}
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
            {isPending
              ? "保存中..."
              : props.mode === "create"
              ? "作成"
              : "保存"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
