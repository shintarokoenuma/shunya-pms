"use client"

import { useTransition } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { BuyerStatus } from "@prisma/client"
import {
  buyerBaseSchema,
  type BuyerBaseInput,
  type BuyerInput,
} from "@/lib/validators/buyer"
import { createBuyer, updateBuyer } from "@/lib/actions/buyers"
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
import { AddressFields } from "@/components/forms/address-fields"
import {
  BUYER_STATUS_OPTIONS,
  COUNTRY_OPTIONS,
} from "./labels"

export type ClientSelectOption = {
  id: string
  clientCode: string
  companyName: string
}

type Props =
  | {
      mode: "create"
      clients: ClientSelectOption[]
      defaultValues?: Partial<BuyerBaseInput>
    }
  | {
      mode: "edit"
      id: string
      clients: ClientSelectOption[]
      defaultValues: BuyerBaseInput
    }

const NO_CLIENT = "__none__"

const CREATE_DEFAULTS: BuyerBaseInput = {
  buyerCode: "",
  buyerName: "",
  buyerNameEn: "",
  clientId: null,
  country: "JP",
  postalCode: "",
  prefecture: "",
  city: "",
  address: "",
  addressLine2: "",
  contactPerson: "",
  phone: "",
  email: "",
  notes: "",
  status: BuyerStatus.ACTIVE,
}

export function BuyerForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<BuyerBaseInput>({
    resolver: zodResolver(buyerBaseSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : {
            ...CREATE_DEFAULTS,
            ...(props.defaultValues ?? {}),
          },
  })

  const country = form.watch("country") ?? "JP"

  const onSubmit: SubmitHandler<BuyerBaseInput> = (values) => {
    startTransition(async () => {
      const payload = values as BuyerInput
      const result =
        props.mode === "create"
          ? await createBuyer(payload)
          : await updateBuyer(props.id, payload)

      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        props.mode === "create"
          ? "バイヤーを作成しました"
          : "バイヤーを更新しました",
      )
      router.push(`/buyers/${result.data.id}`)
      router.refresh()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* ───────────────────── 基本情報 ───────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="buyerCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>バイヤーコード *</FormLabel>
                  <FormControl>
                    <Input placeholder="例：BEAMS-DOM" {...field} />
                  </FormControl>
                  <FormDescription>
                    英数字・ハイフン・アンダースコア（最大 50 文字）
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="buyerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>バイヤー名 *</FormLabel>
                  <FormControl>
                    <Input placeholder="例：BEAMS / BEAMS 国内事業部" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="buyerNameEn"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>バイヤー名（英語）</FormLabel>
                  <FormControl>
                    <Input placeholder="例：BEAMS Co., Ltd." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ───────────────────── 関連クライアント ───────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>関連クライアント</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>クライアント</FormLabel>
                  <Select
                    value={field.value ?? NO_CLIENT}
                    onValueChange={(v) =>
                      field.onChange(v === NO_CLIENT ? null : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="md:w-[480px]">
                        <SelectValue placeholder="クライアントを選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_CLIENT}>
                        指定なし
                      </SelectItem>
                      {props.clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            {c.clientCode}
                          </span>
                          {c.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Case B（事業部単位）の場合は必ず指定。Case A も基本は指定推奨。
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ───────────────────── 連絡先 ───────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>連絡先</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>国 *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="md:w-[240px]">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COUNTRY_OPTIONS.map((o) => (
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

            <AddressFields country={country} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>担当者名</FormLabel>
                    <FormControl>
                      <Input placeholder="例：山田 太郎" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>電話</FormLabel>
                    <FormControl>
                      <Input placeholder="例：03-1234-5678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>メール</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="例：contact@example.com"
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

        {/* ───────────────────── メモ + ステータス ───────────────────── */}
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
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="md:w-[240px]">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BUYER_STATUS_OPTIONS.map((o) => (
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
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>メモ</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="運用上の特記事項など"
                      rows={4}
                      maxLength={5000}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ───────────────────── 送信ボタン ───────────────────── */}
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
