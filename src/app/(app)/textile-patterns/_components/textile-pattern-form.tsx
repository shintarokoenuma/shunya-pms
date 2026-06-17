"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
  textilePatternInputSchema,
  type TextilePatternFormValues,
  type TextilePatternInput,
} from "@/lib/validators/textile-pattern"
import type {
  TextilePatternStatusValue,
  PatternTypeOption,
} from "@/lib/types/textile-pattern"
import {
  createTextilePattern,
  updateTextilePattern,
} from "@/lib/actions/textile-patterns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { TEXTILE_PATTERN_STATUS_OPTIONS } from "./labels"

const NONE = "__none__"

type Props = {
  mode: "create" | "edit"
  initialId?: string
  initialValues?: Partial<TextilePatternFormValues>
  patternTypes: PatternTypeOption[]
}

const emptyDefaults: TextilePatternFormValues = {
  patternNumber: "",
  patternName: "",
  typeId: null,
  sortOrder: null,
  status: "ACTIVE",
}

export function TextilePatternForm({
  mode,
  initialId,
  initialValues,
  patternTypes,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<TextilePatternFormValues>({
    resolver: zodResolver(textilePatternInputSchema),
    defaultValues: { ...emptyDefaults, ...initialValues },
  })

  const onSubmit = (values: TextilePatternFormValues) => {
    startTransition(async () => {
      const payload = values as TextilePatternInput
      const result =
        mode === "create"
          ? await createTextilePattern(payload)
          : await updateTextilePattern(initialId!, payload)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(mode === "create" ? "柄を作成しました" : "柄を更新しました")
      router.push(`/textile-patterns/${result.data.id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
          <CardDescription>
            柄番号(D#)は会社内で一意。種別は柄種別マスターから選択（無地はカラーで対応するため対象外）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="patternNumber">
                柄番号(D#) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="patternNumber"
                {...form.register("patternNumber")}
                placeholder="例：BD-A"
                maxLength={10}
                className="font-mono"
              />
              {form.formState.errors.patternNumber && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.patternNumber.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="patternName">
                柄名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="patternName"
                {...form.register("patternName")}
                placeholder="例：black×white ボーダー"
                maxLength={100}
              />
              {form.formState.errors.patternName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.patternName.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="typeId">種別</Label>
            <Select
              value={form.watch("typeId") ?? NONE}
              onValueChange={(v) =>
                form.setValue("typeId", v === NONE ? null : v, {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id="typeId" className="sm:w-[280px]">
                <SelectValue placeholder="（未選択）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>（未選択）</SelectItem>
                {patternTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="font-mono text-xs text-muted-foreground mr-2">
                      {t.typeCode}
                    </span>
                    {t.typeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

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
                  form.setValue("status", v as TextilePatternStatusValue, {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEXTILE_PATTERN_STATUS_OPTIONS.map((o) => (
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
