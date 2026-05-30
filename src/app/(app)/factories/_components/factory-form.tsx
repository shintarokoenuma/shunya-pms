"use client"

import { useState, useTransition } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  PaymentTermType,
  FactoryContractType,
  FactoryType,
} from "@prisma/client"
import {
  factoryInputSchema,
  type FactoryInput,
} from "@/lib/validators/factory"
import { createFactory, updateFactory } from "@/lib/actions/factories"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
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
  FACTORY_TYPE_OPTIONS,
  FACTORY_CONTRACT_TYPE_OPTIONS,
  FACTORY_STATUS_OPTIONS,
  PAYMENT_TERM_TYPE_OPTIONS,
  CURRENCY_OPTIONS,
  LANGUAGE_OPTIONS,
  COUNTRY_OPTIONS,
  CHAT_TOOL_PRESETS,
  PAYMENT_PRESETS,
} from "./labels"
import { AddressFields } from "@/components/forms/address-fields"
import { TimezoneField } from "@/components/forms/timezone-field"

export type AssignableUser = {
  id: string
  name: string
  email: string
}

type Props =
  | {
      mode: "create"
      assignableUsers: AssignableUser[]
      defaultValues?: Partial<FactoryInput>
    }
  | {
      mode: "edit"
      id: string
      assignableUsers: AssignableUser[]
      defaultValues: FactoryInput
    }

const DEFAULT_PRIMARY_CONTACT = {
  firstName: "",
  lastName: "",
  jobTitle: "",
  department: "",
  email: "",
  phone: "",
  mobile: "",
}

const CREATE_DEFAULTS: FactoryInput = {
  factoryCode: "",
  factoryName: "",
  factoryNameEn: "",
  factoryTypes: [],
  contractTypes: [],
  country: "JP",
  postalCode: "",
  prefecture: "",
  city: "",
  address: "",
  addressLine2: "",
  addressEn: "",
  phone: "",
  fax: "",
  email: "",
  chatTool: "",
  chatToolId: "",
  preferredLanguage: "JA",
  preferredCurrency: "JPY",
  timezone: "",
  taxId: "",
  isQualifiedInvoiceIssuer: true,
  paymentTermType: "DEPOSIT_COD",
  closingDay: null,
  paymentMonthOffset: null,
  paymentDay: null,
  monthlyCapacity: null,
  minimumOrderQty: null,
  averageLeadTimeDays: null,
  assignedToUserId: "",
  primaryContact: DEFAULT_PRIMARY_CONTACT,
  status: "ACTIVE",
  notes: "",
}

export function FactoryForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FactoryInput>({
    resolver: zodResolver(factoryInputSchema) as never,
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : {
            ...CREATE_DEFAULTS,
            ...(props.defaultValues ?? {}),
          },
  })

  const paymentTermType = form.watch("paymentTermType")
  const country = form.watch("country")
  const isJP = country === "JP"

  const onSubmit: SubmitHandler<FactoryInput> = (values) => {
    setServerError(null)
    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createFactory(values)
          : await updateFactory(props.id, values)
      if (!result.ok) {
        setServerError(result.error)
        toast.error(result.error)
        return
      }
      toast.success(
        props.mode === "create" ? "工場を作成しました" : "工場を更新しました"
      )
      router.push(`/factories/${result.data.id}`)
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

        {/* ===== 基本情報 ===== */}
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="factoryName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>工場名 *</FormLabel>
                  <FormControl>
                    <Input placeholder="例: 株式会社サンプル縫製" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="factoryNameEn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>工場名(英語)</FormLabel>
                  <FormControl>
                    <Input placeholder="Sample Sewing Co., Ltd." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="factoryCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>工場コード *</FormLabel>
                    <FormControl>
                      <Input placeholder="例: SEW-001" {...field} />
                    </FormControl>
                    <FormDescription>
                      英大文字・数字・ハイフン・アンダースコア
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
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FACTORY_STATUS_OPTIONS.map((o) => (
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
            </div>

            <FormField
              control={form.control}
              name="factoryTypes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>工場タイプ *</FormLabel>
                  <FormDescription>該当するタイプをすべて選択してください</FormDescription>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {FACTORY_TYPE_OPTIONS.map((o) => {
                      const checked = field.value?.includes(o.value as FactoryType) ?? false
                      return (
                        <label
                          key={o.value}
                          className="flex items-center gap-2 cursor-pointer rounded-md border p-2 hover:bg-muted"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => {
                              const current = field.value ?? []
                              if (c) {
                                field.onChange([...current, o.value as FactoryType])
                              } else {
                                field.onChange(
                                  current.filter((v) => v !== o.value)
                                )
                              }
                            }}
                          />
                          <span className="text-sm">{o.label}</span>
                        </label>
                      )
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contractTypes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>契約形態</FormLabel>
                  <FormDescription>該当する契約形態をすべて選択してください(任意)</FormDescription>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {FACTORY_CONTRACT_TYPE_OPTIONS.map((o) => {
                      const checked = field.value?.includes(o.value as FactoryContractType) ?? false
                      return (
                        <label
                          key={o.value}
                          className="flex items-center gap-2 cursor-pointer rounded-md border p-2 hover:bg-muted"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => {
                              const current = field.value ?? []
                              if (c) {
                                field.onChange([...current, o.value as FactoryContractType])
                              } else {
                                field.onChange(
                                  current.filter((v) => v !== o.value)
                                )
                              }
                            }}
                          />
                          <span className="text-sm">{o.label}</span>
                        </label>
                      )
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ===== 連絡先 ===== */}
        <Card>
          <CardHeader>
            <CardTitle>連絡先・所在地</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <AddressFields country={country} />

            <FormField
              control={form.control}
              name="addressEn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>住所(英語)</FormLabel>
                  <FormControl>
                    <Input placeholder="1-1-1 Marunouchi, Chiyoda-ku, Tokyo 100-0001 Japan" {...field} />
                  </FormControl>
                  <FormDescription>海外取引で使用</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>電話</FormLabel>
                    <FormControl>
                      <Input placeholder="03-1234-5678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>FAX</FormLabel>
                    <FormControl>
                      <Input placeholder="03-1234-5679" {...field} />
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
                    <FormLabel>メール</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="info@example.com"
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

        {/* ===== 海外取引用 ===== */}
        <Card>
          <CardHeader>
            <CardTitle>海外取引用</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="chatTool"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>チャットツール</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value || "_none"}
                        onValueChange={(v) =>
                          field.onChange(v === "_none" ? "" : v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選択" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">未設定</SelectItem>
                          {CHAT_TOOL_PRESETS.map((preset) => (
                            <SelectItem key={preset} value={preset}>
                              {preset}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>WeChat / LINE 等</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="chatToolId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>チャットID</FormLabel>
                    <FormControl>
                      <Input placeholder="user_id_123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="preferredLanguage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>優先言語</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGE_OPTIONS.map((o) => (
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
              <FormField
                control={form.control}
                name="preferredCurrency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>優先通貨</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCY_OPTIONS.map((o) => (
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
              <TimezoneField />
            </div>
          </CardContent>
        </Card>

        {/* ===== 取引条件 ===== */}
        <Card>
          <CardHeader>
            <CardTitle>取引条件</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="taxId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>適格請求書発行事業者番号{isJP && " *"}</FormLabel>
                  <FormControl>
                    <Input placeholder="T1234567890123" {...field} />
                  </FormControl>
                  <FormDescription>
                    {isJP
                      ? "国内工場は必須。T + 13桁の数字"
                      : "海外工場は任意。T + 13桁の数字"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isQualifiedInvoiceIssuer"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <FormLabel className="text-base">適格請求書発行事業者</FormLabel>
                    <FormDescription>
                      インボイス制度の発行事業者として登録されているか
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentTermType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>支払条件 *</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="md:w-[280px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_TERM_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    新規取引は「デポジット + COD」が推奨です
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {paymentTermType === PaymentTermType.MONTHLY_CLOSING && (
              <>
                <div className="space-y-2">
                  <Label>プリセット</Label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_PRESETS.map((preset) => {
                      const isActive =
                        form.watch("closingDay") === preset.closingDay &&
                        form.watch("paymentMonthOffset") === preset.paymentMonthOffset &&
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
                            form.setValue("paymentMonthOffset", preset.paymentMonthOffset, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
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

                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="closingDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>締め日 *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            placeholder="31"
                            value={typeof field.value === "number" ? field.value : ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === "" ? null : Number(e.target.value)
                              )
                            }
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
                              field.onChange(v === "" ? null : Number(v))
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
                            type="number"
                            min={1}
                            max={31}
                            placeholder="31"
                            value={typeof field.value === "number" ? field.value : ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === "" ? null : Number(e.target.value)
                              )
                            }
                          />
                        </FormControl>
                        <FormDescription>1〜31。31を入力すると月末扱い</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ===== 製造キャパシティ ===== */}
        <Card>
          <CardHeader>
            <CardTitle>製造キャパシティ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="monthlyCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>月間生産可能数</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="1000"
                        value={typeof field.value === "number" ? field.value : ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>月あたりの生産可能数(任意)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minimumOrderQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>最小ロット</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="50"
                        value={typeof field.value === "number" ? field.value : ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>1オーダーあたりの最小数(任意)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="averageLeadTimeDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>標準リードタイム(日)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="30"
                        value={typeof field.value === "number" ? field.value : ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>発注から納品までの標準日数(任意)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* ===== shunya 側担当 ===== */}
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
                  <FormControl>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger className="md:w-[400px]">
                        <SelectValue placeholder="選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {props.assignableUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}({u.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ===== 先方担当者 ===== */}
        <Card>
          <CardHeader>
            <CardTitle>先方担当者(主担当)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="primaryContact.lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>姓 *</FormLabel>
                    <FormControl>
                      <Input placeholder="山田" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input placeholder="太郎" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input placeholder="工場長" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input placeholder="生産管理部" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="primaryContact.email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>メール</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="taro@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="primaryContact.phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>電話</FormLabel>
                    <FormControl>
                      <Input placeholder="03-1234-5678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="primaryContact.mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>携帯</FormLabel>
                    <FormControl>
                      <Input placeholder="090-1234-5678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* ===== メモ ===== */}
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
                  <FormControl>
                    <Textarea
                      placeholder="特記事項・備考"
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

        {/* ===== 送信ボタン ===== */}
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
            {isPending
              ? "送信中..."
              : props.mode === "create"
                ? "作成する"
                : "更新する"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
