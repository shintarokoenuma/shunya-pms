"use client"

import { useState, useTransition } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  PaymentTermType,
  ContractorContractType,
  ContractorSpecialty,
} from "@prisma/client"
import {
  contractorInputSchema,
  type ContractorInput,
} from "@/lib/validators/contractor"
import { createContractor, updateContractor } from "@/lib/actions/contractors"
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
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group"
import {
  CONTRACTOR_SPECIALTY_OPTIONS,
  CONTRACTOR_CONTRACT_TYPE_OPTIONS,
  CONTRACTOR_STATUS_OPTIONS,
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
      defaultValues?: Partial<ContractorInput>
    }
  | {
      mode: "edit"
      id: string
      assignableUsers: AssignableUser[]
      defaultValues: ContractorInput
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

const CREATE_DEFAULTS: ContractorInput = {
  contractorCode: "",
  contractorName: "",
  contractorNameEn: "",
  isIndividual: true,
  specialties: [],
  contractType: "PER_TASK",
  packageFee: null,
  hourlyRate: null,
  monthlyFee: null,
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
  paymentTermType: "MONTHLY_CLOSING",
  closingDay: null,
  paymentMonthOffset: null,
  paymentDay: null,
  assignedToUserId: "",
  primaryContact: DEFAULT_PRIMARY_CONTACT,
  status: "ACTIVE",
  notes: "",
}

// 料金体系の表示制御マップ
// contractType に応じてどのフィールドを表示するか
const FEE_DISPLAY_MAP: Record<
  ContractorContractType,
  {
    package: boolean
    hourly: boolean
    monthly: boolean
    showPerTaskNotice: boolean
  }
> = {
  PACKAGE: { package: true, hourly: false, monthly: false, showPerTaskNotice: false },
  HOURLY: { package: false, hourly: true, monthly: false, showPerTaskNotice: false },
  MONTHLY: { package: false, hourly: false, monthly: true, showPerTaskNotice: false },
  PER_TASK: { package: false, hourly: false, monthly: false, showPerTaskNotice: true },
  HYBRID: { package: true, hourly: true, monthly: true, showPerTaskNotice: false },
}

function formatFee(v: number | null): string {
  if (v === null) return ""
  return new Intl.NumberFormat("ja-JP").format(v)
}

export function ContractorForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<ContractorInput>({
    resolver: zodResolver(contractorInputSchema) as never,
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
  const isIndividual = form.watch("isIndividual")
  const contractType = form.watch("contractType")
  const isQualifiedInvoiceIssuer = form.watch("isQualifiedInvoiceIssuer")
  const packageFee = form.watch("packageFee")
  const hourlyRate = form.watch("hourlyRate")
  const monthlyFee = form.watch("monthlyFee")

  // 料金体系の表示制御
  const feeDisplay = FEE_DISPLAY_MAP[contractType]

  // 非表示中の値の警告メッセージを組み立て
  const hiddenFeeWarnings: string[] = []
  if (!feeDisplay.package && packageFee !== null) {
    hiddenFeeWarnings.push(`パッケージ料金 ¥${formatFee(packageFee)}`)
  }
  if (!feeDisplay.hourly && hourlyRate !== null) {
    hiddenFeeWarnings.push(`時給 ¥${formatFee(hourlyRate)}`)
  }
  if (!feeDisplay.monthly && monthlyFee !== null) {
    hiddenFeeWarnings.push(`月額固定 ¥${formatFee(monthlyFee)}`)
  }

  const onSubmit: SubmitHandler<ContractorInput> = (values) => {
    setServerError(null)
    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createContractor(values)
          : await updateContractor(props.id, values)
      if (!result.ok) {
        setServerError(result.error)
        toast.error(result.error)
        return
      }
      toast.success(
        props.mode === "create" ? "外注先を作成しました" : "外注先を更新しました"
      )
      router.push(`/contractors/${result.data.id}`)
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
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="contractorCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>外注先コード *</FormLabel>
                    <FormControl>
                      <Input placeholder="例: PT-001" {...field} />
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
                          {CONTRACTOR_STATUS_OPTIONS.map((o) => (
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
              name="contractorName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>外注先名 *</FormLabel>
                  <FormControl>
                    <Input placeholder="例: 山田パターン工房 / 株式会社サンプル" {...field} />
                  </FormControl>
                  <FormDescription>
                    個人事業主の場合は屋号または氏名、法人の場合は会社名
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contractorNameEn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>外注先名(英語)</FormLabel>
                  <FormControl>
                    <Input placeholder="Sample Pattern Co., Ltd." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isIndividual"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>区分 *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value ? "true" : "false"}
                      onValueChange={(v) => field.onChange(v === "true")}
                      className="flex gap-6"
                    >
                      <label className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value="true" />
                        <span className="text-sm">個人事業主</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value="false" />
                        <span className="text-sm">法人</span>
                      </label>
                    </RadioGroup>
                  </FormControl>
                  <FormDescription>
                    法人の場合は「先方担当者」カードで主担当を入力してください
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ===== 専門分野・契約形態 ===== */}
        <Card>
          <CardHeader>
            <CardTitle>専門分野・契約形態</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="specialties"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>専門分野 *</FormLabel>
                  <FormDescription>該当する分野をすべて選択してください</FormDescription>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {CONTRACTOR_SPECIALTY_OPTIONS.map((o) => {
                      const checked = field.value?.includes(o.value as ContractorSpecialty) ?? false
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
                                field.onChange([...current, o.value as ContractorSpecialty])
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
              name="contractType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>契約形態 *</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="md:w-[400px]">
                        <SelectValue placeholder="選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTRACTOR_CONTRACT_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    契約形態に応じて「料金体系」カードの入力項目が切り替わります
                  </FormDescription>
                  {hiddenFeeWarnings.length > 0 && (
                    <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                      ※ 現在非表示: {hiddenFeeWarnings.join(" / ")} が登録されています。
                      契約形態を変更すると入力欄に再表示できます。
                    </div>
                  )}
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

        {/* ===== 料金体系 ===== */}
        <Card>
          <CardHeader>
            <CardTitle>料金体系</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              契約形態: <strong>{CONTRACTOR_CONTRACT_TYPE_OPTIONS.find((o) => o.value === contractType)?.label}</strong>
            </div>

            {feeDisplay.showPerTaskNotice && (
              <div className="rounded-md border bg-muted p-3 text-sm">
                個別作業単価は <strong>Phase 2 で実装予定</strong>です。
                それまでは見積もり時に都度設定してください。
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              {feeDisplay.package && (
                <FormField
                  control={form.control}
                  name="packageFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>パッケージ料金</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="30000"
                          value={typeof field.value === "number" ? field.value : ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? null : Number(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormDescription>1案件あたりの基本料金</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {feeDisplay.hourly && (
                <FormField
                  control={form.control}
                  name="hourlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>時給</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="3000"
                          value={typeof field.value === "number" ? field.value : ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? null : Number(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormDescription>1時間あたりの単価</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {feeDisplay.monthly && (
                <FormField
                  control={form.control}
                  name="monthlyFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>月額固定</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="200000"
                          value={typeof field.value === "number" ? field.value : ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? null : Number(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormDescription>月額のフリーランス契約料</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
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
              name="isQualifiedInvoiceIssuer"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <FormLabel className="text-base">適格請求書発行事業者</FormLabel>
                    <FormDescription>
                      インボイス制度の発行事業者として登録されているか。
                      個人事業主・免税事業者の場合はオフに切り替えてください。
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
              name="taxId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    適格請求書発行事業者番号
                    {isJP && isQualifiedInvoiceIssuer && " *"}
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="T1234567890123" {...field} />
                  </FormControl>
                  <FormDescription>
                    {isJP && isQualifiedInvoiceIssuer
                      ? "国内かつ適格請求書発行事業者の場合は必須。T + 13桁の数字"
                      : "T + 13桁の数字(任意)"}
                  </FormDescription>
                  <FormMessage />
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
                    外注先は「月末締め払い」が一般的
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
                  <FormLabel>担当者</FormLabel>
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

        {/* ===== 先方担当者(法人のみ) ===== */}
        {isIndividual === false && (
          <Card>
            <CardHeader>
              <CardTitle>先方担当者(主担当)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                法人の場合、主担当者の <strong>姓・名</strong> は必須です
              </div>
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
                        <Input placeholder="代表取締役 / パタンナー" {...field} />
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
                        <Input placeholder="技術部" {...field} />
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
        )}

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
