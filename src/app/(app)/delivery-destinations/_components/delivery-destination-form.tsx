"use client"

import { useTransition } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { DeliveryDestinationStatus } from "@prisma/client"
import {
  deliveryDestinationBaseSchema,
  type DeliveryDestinationBaseInput,
  type DeliveryDestinationInput,
} from "@/lib/validators/delivery-destination"
import {
  createDeliveryDestination,
  updateDeliveryDestination,
} from "@/lib/actions/delivery-destinations"
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
import { TimezoneField } from "@/components/forms/timezone-field"
import {
  DELIVERY_DESTINATION_STATUS_OPTIONS,
  COUNTRY_OPTIONS,
} from "./labels"

export type BuyerSelectOption = {
  id: string
  buyerCode: string
  buyerName: string
  clientCode: string | null
  companyName: string | null
}

type Props =
  | {
      mode: "create"
      buyers: BuyerSelectOption[]
      defaultValues?: Partial<DeliveryDestinationBaseInput>
    }
  | {
      mode: "edit"
      id: string
      buyers: BuyerSelectOption[]
      defaultValues: DeliveryDestinationBaseInput
    }

const CREATE_DEFAULTS: DeliveryDestinationBaseInput = {
  buyerId: "",
  destinationCode: "",
  destinationName: "",
  country: "JP",
  postalCode: "",
  prefecture: "",
  city: "",
  address: "",
  addressLine2: "",
  contactPerson: "",
  phone: "",
  email: "",
  deliveryNotes: "",
  preferredDeliveryDays: "",
  preferredDeliveryHours: "",
  timezone: "",
  notes: "",
  status: DeliveryDestinationStatus.ACTIVE,
}

export function DeliveryDestinationForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<DeliveryDestinationBaseInput>({
    resolver: zodResolver(deliveryDestinationBaseSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : {
            ...CREATE_DEFAULTS,
            ...(props.defaultValues ?? {}),
          },
  })

  const country = form.watch("country") ?? "JP"

  const onSubmit: SubmitHandler<DeliveryDestinationBaseInput> = (values) => {
    startTransition(async () => {
      const payload = values as DeliveryDestinationInput
      const result =
        props.mode === "create"
          ? await createDeliveryDestination(payload)
          : await updateDeliveryDestination(props.id, payload)

      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        props.mode === "create"
          ? "納品先を作成しました"
          : "納品先を更新しました",
      )
      router.push(`/delivery-destinations/${result.data.id}`)
      router.refresh()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* ───────────────────── カード 1: 基本情報 ───────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="buyerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>関連バイヤー *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="md:w-[480px]">
                        <SelectValue placeholder="バイヤーを選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {props.buyers.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            {b.buyerCode}
                          </span>
                          {b.buyerName}
                          {b.companyName && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              （{b.companyName}）
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    この納品先が紐づくバイヤー（必須）
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="destinationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>納品先名 *</FormLabel>
                    <FormControl>
                      <Input placeholder="例：BEAMS渋谷店" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="destinationCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>納品先コード *</FormLabel>
                    <FormControl>
                      <Input placeholder="例：BEAMS-DOM-SHIBUYA" {...field} />
                    </FormControl>
                    <FormDescription>
                      推奨形式：&lt;buyerCode&gt;-&lt;location&gt;
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
                        {DELIVERY_DESTINATION_STATUS_OPTIONS.map((o) => (
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

        {/* ───────────────────── カード 2: 住所 ───────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>住所</CardTitle>
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
          </CardContent>
        </Card>

        {/* ───────────────────── カード 3: 連絡先 ───────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>連絡先</CardTitle>
          </CardHeader>
          <CardContent>
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
                        placeholder="例：shibuya@beams.example.com"
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

        {/* ───────────────────── カード 4: 配送指示 ───────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>配送指示</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="deliveryNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>配送メモ</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="例：搬入口は裏口、エレベーター 3 号機使用。事前連絡必須。"
                      rows={3}
                      maxLength={5000}
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
                name="preferredDeliveryDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>希望納品曜日</FormLabel>
                    <FormControl>
                      <Input placeholder="例：火・木 / 平日のみ" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="preferredDeliveryHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>希望納品時間帯</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例：10:00-15:00 / 午前中"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <TimezoneField />
          </CardContent>
        </Card>

        {/* ───────────────────── カード 5: メモ ───────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>メモ</CardTitle>
          </CardHeader>
          <CardContent>
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
