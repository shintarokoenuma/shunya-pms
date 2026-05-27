"use client"

import { useTransition } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
  Currency,
  MaterialStatus,
  MaterialType,
} from "@prisma/client"
import {
  materialBaseSchema,
  type MaterialBaseInput,
  type MaterialInput,
} from "@/lib/validators/material"
import { createMaterial, updateMaterial } from "@/lib/actions/materials"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
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
  MATERIAL_STATUS_OPTIONS,
  MATERIAL_TYPE_OPTIONS,
  CURRENCY_OPTIONS,
} from "./labels"

export type SupplierSelectOption = {
  id: string
  supplierCode: string
  companyName: string
}

type Props =
  | {
      mode: "create"
      suppliers: SupplierSelectOption[]
      defaultValues?: Partial<MaterialBaseInput>
    }
  | {
      mode: "edit"
      id: string
      suppliers: SupplierSelectOption[]
      defaultValues: MaterialBaseInput
    }

const NO_CATEGORY = "__none__"

const CREATE_DEFAULTS: MaterialBaseInput = {
  materialCode: "",
  materialName: "",
  materialNameEn: "",
  materialType: MaterialType.FABRIC,
  categoryId: null,
  primarySupplierId: "",
  unitPrice: null,
  currency: Currency.JPY,
  unit: "",
  minimumOrderQty: null,
  specification: "",
  notes: "",
  status: MaterialStatus.ACTIVE,
}

export function MaterialForm(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<MaterialBaseInput>({
    resolver: zodResolver(materialBaseSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : {
            ...CREATE_DEFAULTS,
            ...(props.defaultValues ?? {}),
          },
  })

  const onSubmit: SubmitHandler<MaterialBaseInput> = (values) => {
    startTransition(async () => {
      const payload = values as MaterialInput
      const result =
        props.mode === "create"
          ? await createMaterial(payload)
          : await updateMaterial(props.id, payload)

      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        props.mode === "create"
          ? "素材を作成しました"
          : "素材を更新しました",
      )
      router.push(`/materials/${result.data.id}`)
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
              name="materialCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>素材コード *</FormLabel>
                  <FormControl>
                    <Input placeholder="例：FAB-COT-001" {...field} />
                  </FormControl>
                  <FormDescription>
                    例: FAB-COT-001（生地）/ BTN-SQR-12mm（ボタン）/
                    ZIP-METAL-15cm（ファスナー）など、自由に命名できます
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="materialName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>素材名 *</FormLabel>
                    <FormControl>
                      <Input placeholder="例：コットン 100% 平織り" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="materialNameEn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>素材名（英語）</FormLabel>
                    <FormControl>
                      <Input placeholder="例：100% Cotton Poplin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* ───────────────────── カード 2: 分類・仕入先 ───────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>分類・仕入先</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="materialType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>素材タイプ *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="md:w-[280px]">
                        <SelectValue placeholder="素材タイプを選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MATERIAL_TYPE_OPTIONS.map((o) => (
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
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>素材カテゴリ</FormLabel>
                  <Select
                    value={field.value ?? NO_CATEGORY}
                    onValueChange={(v) =>
                      field.onChange(v === NO_CATEGORY ? null : v)
                    }
                    disabled
                  >
                    <FormControl>
                      <SelectTrigger className="md:w-[320px]">
                        <SelectValue placeholder="（未選択）" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>（未選択）</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    素材カテゴリマスター実装後に選択可能になります
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="primarySupplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>主要仕入先 *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="md:w-[480px]">
                        <SelectValue placeholder="仕入先を選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {props.suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            {s.supplierCode}
                          </span>
                          {s.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    BOM / PO で参照されるため、必須項目です
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ───────────────────── カード 3: 単価 ───────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>単価</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>単価</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        placeholder="例：1200"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? null : e.target.value,
                          )
                        }
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>通貨</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map((o) => (
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
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>単位 *</FormLabel>
                    <FormControl>
                      <Input placeholder="m / 個 / kg / 巻き" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="minimumOrderQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>最小発注数（MOQ）</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="例：50"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? null : e.target.value,
                        )
                      }
                      onBlur={field.onBlur}
                      name={field.name}
                      className="md:w-[240px]"
                    />
                  </FormControl>
                  <FormDescription>単位欄で指定した単位の数量</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ───────────────────── カード 4: メモ・ステータス ───────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>メモ・ステータス</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="specification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>仕様</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="例：表面起毛、防シワ加工済み、染色堅牢度 4 級以上"
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>メモ</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="運用上の特記事項など"
                      rows={3}
                      maxLength={5000}
                      {...field}
                    />
                  </FormControl>
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
                      <SelectTrigger className="md:w-[240px]">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MATERIAL_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    ACTIVE / INACTIVE（一時休止）/ DISCONTINUED（廃番）/ ARCHIVED
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Phase 1A-13b / 13c プレビュー（保存後に詳細画面で見える内容を予告） */}
        {props.mode === "create" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">後続フェーズで追加予定</CardTitle>
              <CardDescription>
                生地特有データ（fabricWeight / composition 等）は Phase 1A-13b、
                画像 / 色展開 / 参考サイトは Phase 1A-13c で UI が追加されます
              </CardDescription>
            </CardHeader>
          </Card>
        )}

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
