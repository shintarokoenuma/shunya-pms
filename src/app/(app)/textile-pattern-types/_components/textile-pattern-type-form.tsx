"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
  textilePatternTypeInputSchema,
  type TextilePatternTypeFormValues,
  type TextilePatternTypeInput,
  type TextilePatternTypeStatusValue,
} from "@/lib/validators/textile-pattern-type"
import {
  createTextilePatternType,
  updateTextilePatternType,
} from "@/lib/actions/textile-pattern-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
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
import { TEXTILE_PATTERN_TYPE_STATUS_OPTIONS } from "./labels"

type Props = {
  mode: "create" | "edit"
  initialId?: string
  initialValues?: Partial<TextilePatternTypeFormValues>
}

const emptyDefaults: TextilePatternTypeFormValues = {
  typeCode: "",
  typeName: "",
  description: "",
  sortOrder: null,
  status: "ACTIVE",
}

export function TextilePatternTypeForm({
  mode,
  initialId,
  initialValues,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<TextilePatternTypeFormValues>({
    resolver: zodResolver(textilePatternTypeInputSchema),
    defaultValues: { ...emptyDefaults, ...initialValues },
  })

  const onSubmit = (values: TextilePatternTypeFormValues) => {
    startTransition(async () => {
      const payload = values as TextilePatternTypeInput
      const result =
        mode === "create"
          ? await createTextilePatternType(payload)
          : await updateTextilePatternType(initialId!, payload)

      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        mode === "create" ? "柄種別を作成しました" : "柄種別を更新しました",
      )
      router.push(`/textile-pattern-types/${result.data.id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* ───────────────── 基本情報 ───────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
          <CardDescription>
            柄の分類を表す共通言語。コードは会社内で一意。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="typeName">
                柄種別名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="typeName"
                {...form.register("typeName")}
                placeholder="例：ボーダー / ストライプ"
                maxLength={100}
              />
              {form.formState.errors.typeName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.typeName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="typeCode">
                コード <span className="text-destructive">*</span>
              </Label>
              <Input
                id="typeCode"
                {...form.register("typeCode")}
                placeholder="例：BD / ST / CK"
                maxLength={10}
                className="font-mono"
              />
              {form.formState.errors.typeCode && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.typeCode.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                英大文字・数字・アンダースコアのみ
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">説明</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder="例：横縞 / 格子（ギンガム・タータン等を内包）"
              maxLength={500}
              rows={3}
            />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ───────────────── 表示順 / ステータス ───────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>表示順 / ステータス</CardTitle>
          <CardDescription>
            表示順を空欄にすると末尾（既存最大 + 10）に追加されます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sortOrder">表示順</Label>
              <Input
                id="sortOrder"
                {...form.register("sortOrder")}
                placeholder="例：35（空欄＝末尾自動）"
                inputMode="numeric"
                className="font-mono"
              />
              {form.formState.errors.sortOrder && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.sortOrder.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">ステータス</Label>
              <Select
                value={form.watch("status") ?? "ACTIVE"}
                onValueChange={(v) =>
                  form.setValue("status", v as TextilePatternTypeStatusValue, {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEXTILE_PATTERN_TYPE_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ───────────────── 送信 ───────────────── */}
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
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "作成する" : "更新する"}
        </Button>
      </div>
    </form>
  )
}
