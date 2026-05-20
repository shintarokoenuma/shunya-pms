"use client"

import { useState, useTransition } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ClientBusinessType,
  ClientDisplayPattern,
  ClientSize,
  ClientStatus,
  LeadSource,
  PaymentTermType,
} from "@prisma/client"
import {
  clientBaseSchema,
  type ClientBaseInput,
} from "@/lib/validators/client"
import { createClient, updateClient } from "@/lib/actions/clients"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
import {
  BUSINESS_TYPE_LABEL,
  CLIENT_SIZE_LABEL,
  DISPLAY_PATTERN_LABEL,
  LEAD_SOURCE_LABEL,
  PAYMENT_TERM_LABEL,
  STATUS_LABEL,
} from "./labels"
import { AddressFields } from "@/components/forms/address-fields"
import { COUNTRY_OPTIONS } from "@/lib/constants/countries"

export type AssignableUser = {
  id: string
  name: string
  email: string
}

type Props =
  | {
      mode: "create"
      assignableUsers: AssignableUser[]
      defaultValues?: Partial<ClientBaseInput>
    }
  | {
      mode: "edit"
      id: string
      assignableUsers: AssignableUser[]
      defaultValues: ClientBaseInput
    }

const PAYMENT_TERMS = Object.keys(PaymentTermType) as Array<keyof typeof PaymentTermType>

const PAYMENT_PRESETS: Array<{
  label: string
  closingDay: number
  paymentMonthOffset: number
  paymentDay: number
}> = [
  { label: "月末締翌月末払", closingDay: 31, paymentMonthOffset: 1, paymentDay: 31 },
  { label: "月末締翌々月末払", closingDay: 31, paymentMonthOffset: 2, paymentDay: 31 },
  { label: "20日締翌月末払", closingDay: 20, paymentMonthOffset: 1, paymentDay: 31 },
  { label: "20日締翌月10日払", closingDay: 20, paymentMonthOffset: 1, paymentDay: 10 },
]

export function ClientForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<ClientBaseInput>({
    resolver: zodResolver(clientBaseSchema) as never,
    defaultValues: {
      clientCode: "",
      companyName: "",
      legalEntity: "",
      businessType: ClientBusinessType.APPAREL_BRAND,
      clientSize: undefined,
      country: "JP",
      phone: "",
      email: "",
      website: "",
      postalCode: "",
      prefecture: "",
      city: "",
      address: "",
      addressLine2: "",
      useSeparateBillingAddress: false,
      billingPostalCode: "",
      billingPrefecture: "",
      billingCity: "",
      billingAddress: "",
      billingAddressLine2: "",
      useSeparateShippingAddress: false,
      shippingPostalCode: "",
      shippingPrefecture: "",
      shippingCity: "",
      shippingAddress: "",
      shippingAddressLine2: "",
      displayPattern: ClientDisplayPattern.B,
      leadSource: undefined,
      referrer: "",
      paymentTermType: PaymentTermType.DEPOSIT_COD,
      closingDay: undefined,
      paymentMonthOffset: undefined,
      paymentDay: undefined,
      depositRequired: true,
      depositPercentage: 30,
      assignedToUserId: "",
      primaryContact: {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        jobTitle: "",
        department: "",
      },
      status: ClientStatus.ACTIVE,
      notes: "",
      ...props.defaultValues,
    },
  })

  const country = (form.watch("country") ?? "") as string
  const useSeparateBilling = form.watch("useSeparateBillingAddress")
  const useSeparateShipping = form.watch("useSeparateShippingAddress")
  const paymentTermType = form.watch("paymentTermType")

  const onSubmit: SubmitHandler<ClientBaseInput> = (data) => {
    setServerError(null)
    startTransition(async () => {
      const action =
        props.mode === "create"
          ? () => createClient(data)
          : () => updateClient(props.id, data)
      const result = await action()
      if (!result.ok) {
        setServerError(result.error)
        if (result.fieldErrors) {
          for (const [k, msgs] of Object.entries(result.fieldErrors)) {
            const msg = Array.isArray(msgs) ? msgs[0] : String(msgs)
            form.setError(k as keyof ClientBaseInput, { message: msg })
          }
        }
        toast.error(result.error)
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
              name="clientCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>クライアントコード *</FormLabel>
                  <FormControl>
                    <Input placeholder="MARKA" {...field} />
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
                    <Input placeholder="株式会社マルカ" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="legalEntity"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>法人格 / 正式名称</FormLabel>
                  <FormControl>
                    <Input placeholder="MARUKA Co., Ltd." {...field} />
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
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(BUSINESS_TYPE_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
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
                    onValueChange={(v) => field.onChange(v === "_none" ? undefined : v)}
                    value={field.value ?? "_none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="規模を選択(任意)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none">未選択</SelectItem>
                      {Object.entries(CLIENT_SIZE_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 連絡先・住所 */}
        <Card>
          <CardHeader>
            <CardTitle>連絡先・住所</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>国 *</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="md:w-[240px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>電話番号 *</FormLabel>
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
                  <FormLabel>メールアドレス *</FormLabel>
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
                <FormItem className="md:col-span-2">
                  <FormLabel>Web サイト</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="md:col-span-2">
              <AddressFields country={country} />
            </div>
          </CardContent>
        </Card>

        {/* 請求書発送先住所(任意) */}
        <Card>
          <CardHeader>
            <CardTitle>請求書発送先住所</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="useSeparateBillingAddress"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 space-y-0">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">マスター住所と別にする</FormLabel>
                </FormItem>
              )}
            />
            {useSeparateBilling && (
              <AddressFields prefix="billing" country={country} />
            )}
          </CardContent>
        </Card>

        {/* 商品配送先住所(任意) */}
        <Card>
          <CardHeader>
            <CardTitle>商品配送先住所</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="useSeparateShippingAddress"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 space-y-0">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">マスター住所と別にする</FormLabel>
                </FormItem>
              )}
            />
            {useSeparateShipping && (
              <AddressFields prefix="shipping" country={country} />
            )}
          </CardContent>
        </Card>

        {/* 取引条件 */}
        <Card>
          <CardHeader>
            <CardTitle>取引条件</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="paymentTermType"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>支払条件 *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {PAYMENT_TERMS.map((k) => (
                        <SelectItem key={k} value={k}>{PAYMENT_TERM_LABEL[k as PaymentTermType]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>新規取引は「デポジット + COD」が推奨です</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {paymentTermType === PaymentTermType.MONTHLY_CLOSING && (
              <>
                <div className="md:col-span-2 space-y-2">
                  <Label>プリセット</Label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_PRESETS.map((preset) => {
                      const isActive =
                        form.watch("closingDay") === preset.closingDay &&
                        form.watch("paymentMonthOffset") ===
                          preset.paymentMonthOffset &&
                        form.watch("paymentDay") === preset.paymentDay
                      return (
                        <Button
                          key={preset.label}
                          type="button"
                          size="sm"
                          variant={isActive ? "default" : "outline"}
                          onClick={() => {
                            form.setValue("closingDay", preset.closingDay, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                            form.setValue(
                              "paymentMonthOffset",
                              preset.paymentMonthOffset,
                              { shouldDirty: true, shouldValidate: true }
                            )
                            form.setValue("paymentDay", preset.paymentDay, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }}
                        >
                          {preset.label}
                        </Button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    プリセットを選ぶと下の3項目が自動入力されます。微調整も可能です。
                  </p>
                </div>
                <FormField
                  control={form.control}
                  name="closingDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>締め日 *</FormLabel>
                      <FormControl>
                        <Input
                          type="number" min={1} max={31}
                          placeholder="31"
                          value={typeof field.value === "number" ? field.value : ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>1〜31。31を入力すると月末扱い</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentMonthOffset"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>支払い月 *</FormLabel>
                      <FormControl>
                        <Select
                          value={
                            field.value === undefined || field.value === null
                              ? ""
                              : String(field.value)
                          }
                          onValueChange={(v) =>
                            field.onChange(v === "" ? undefined : Number(v))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="選択" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">当月</SelectItem>
                            <SelectItem value="1">翌月</SelectItem>
                            <SelectItem value="2">翌々月</SelectItem>
                            <SelectItem value="3">3ヶ月後</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription>締日からどの月の支払いか</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>支払日 *</FormLabel>
                      <FormControl>
                        <Input
                          type="number" min={1} max={31}
                          placeholder="31"
                          value={typeof field.value === "number" ? field.value : ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>1〜31。31を入力すると月末扱い</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            {paymentTermType === PaymentTermType.DEPOSIT_COD && (
              <FormField
                control={form.control}
                name="depositPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>デポジット比率 (%) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number" min={0} max={100} step="0.01"
                        placeholder="30"
                        value={typeof field.value === "number" ? field.value : ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>新規取引のデフォルト 30 %</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        {/* shunya 側担当者 */}
        <Card>
          <CardHeader>
            <CardTitle>shunya 側担当</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="assignedToUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>担当者 *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="担当者を選択" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {props.assignableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}({u.email})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 先方担当者(主担当) */}
        <Card>
          <CardHeader>
            <CardTitle>先方担当者(主担当)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="primaryContact.lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>姓 *</FormLabel>
                  <FormControl><Input placeholder="山田" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="primaryContact.firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>名 *</FormLabel>
                  <FormControl><Input placeholder="太郎" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="primaryContact.email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>メール *</FormLabel>
                  <FormControl><Input type="email" placeholder="t.yamada@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="primaryContact.phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>電話 *</FormLabel>
                  <FormControl><Input placeholder="03-1234-5678" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="primaryContact.department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>部署</FormLabel>
                  <FormControl><Input placeholder="商品企画部" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="primaryContact.jobTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>役職</FormLabel>
                  <FormControl><Input placeholder="ディレクター" {...field} /></FormControl>
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
          <CardContent>
            <FormField
              control={form.control}
              name="displayPattern"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>表示パターン *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(DISPLAY_PATTERN_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
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
                    onValueChange={(v) => field.onChange(v === "_none" ? undefined : v)}
                    value={field.value ?? "_none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="流入経路を選択(任意)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none">未選択</SelectItem>
                      {Object.entries(LEAD_SOURCE_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
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
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.entries(STATUS_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
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
                    <Textarea rows={4} placeholder="社内メモ(取引履歴、特殊条件など)" {...field} />
                  </FormControl>
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
