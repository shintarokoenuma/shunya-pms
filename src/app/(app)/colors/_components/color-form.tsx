"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
  colorInputSchema,
  type ColorFormValues,
  type ColorInput,
  type ColorStatusValue,
} from "@/lib/validators/color"
import { createColor, updateColor } from "@/lib/actions/colors"
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
import {
  COLOR_STATUS_OPTIONS,
  HUE_GROUP_LABELS,
} from "./labels"
import { ColorSwatch } from "./color-swatch"

const COLOR_NUMBER_PATTERN = /^\d{2}$/

type Props = {
  mode: "create" | "edit"
  initialId?: string
  initialValues?: Partial<ColorFormValues>
}

const emptyDefaults: ColorFormValues = {
  colorNumber: "",
  colorName: "",
  colorNameEn: "",
  cmyk: "",
  hex: "",
  impression: "",
  status: "ACTIVE",
}

export function ColorForm({ mode, initialId, initialValues }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<ColorFormValues>({
    resolver: zodResolver(colorInputSchema),
    defaultValues: { ...emptyDefaults, ...initialValues },
  })

  const watchedColorNumber = form.watch("colorNumber") ?? ""
  const watchedHex = form.watch("hex") ?? ""
  const isUndefinedColor = watchedColorNumber === "00"
  const isValidColorNumber = COLOR_NUMBER_PATTERN.test(watchedColorNumber)
  const hueGroup = isValidColorNumber
    ? parseInt(watchedColorNumber[0], 10)
    : null
  const toneStep = isValidColorNumber
    ? parseInt(watchedColorNumber[1], 10)
    : null

  const onSubmit = (values: ColorFormValues) => {
    startTransition(async () => {
      const payload = values as ColorInput
      const result =
        mode === "create"
          ? await createColor(payload)
          : await updateColor(initialId!, payload)

      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(mode === "create" ? "色を作成しました" : "色を更新しました")
      router.push(`/colors/${result.data.id}`)
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
            色番号 2 桁体系: 十の位 = 色相系統（0〜9）、一の位 = トーン段階。
            色番号「00」は「カラー未定（マルチ／プリント）」を表す予約値です。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="colorName">
                色名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="colorName"
                {...form.register("colorName")}
                placeholder="例：ネイビー / サックス"
                maxLength={100}
              />
              {form.formState.errors.colorName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.colorName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="colorNumber">
                色番号（2 桁） <span className="text-destructive">*</span>
              </Label>
              <Input
                id="colorNumber"
                {...form.register("colorNumber")}
                placeholder="例：57"
                maxLength={2}
                className="font-mono"
                inputMode="numeric"
              />
              {form.formState.errors.colorNumber && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.colorNumber.message}
                </p>
              )}
              {hueGroup !== null && toneStep !== null && (
                <p className="text-xs text-muted-foreground">
                  色相: {hueGroup} {HUE_GROUP_LABELS[hueGroup] ?? "—"} / トーン: {toneStep}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="colorNameEn">色名（英語）</Label>
            <Input
              id="colorNameEn"
              {...form.register("colorNameEn")}
              placeholder="例：Navy / Sax Blue（任意・輸出下げ札用）"
              maxLength={100}
            />
            {form.formState.errors.colorNameEn && (
              <p className="text-xs text-destructive">
                {form.formState.errors.colorNameEn.message}
              </p>
            )}
          </div>
          {isUndefinedColor && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
              「00」はカラー未定（マルチ／プリント）の予約値です。色値（CMYK / HEX）は不要です。
            </div>
          )}
        </CardContent>
      </Card>

      {/* ───────────────── 色値 ───────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>色値</CardTitle>
          <CardDescription>
            CMYK は C.M.Y.K 形式（各 0〜100）、HEX は #RRGGBB。
            「00」のみ空欄を許可します。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cmyk">
                CMYK
                {!isUndefinedColor && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </Label>
              <Input
                id="cmyk"
                {...form.register("cmyk")}
                placeholder="例：100.85.0.40"
                maxLength={20}
                className="font-mono"
              />
              {form.formState.errors.cmyk && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.cmyk.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hex">
                HEX
                {!isUndefinedColor && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="hex"
                  {...form.register("hex")}
                  placeholder="例：#001799"
                  maxLength={7}
                  className="font-mono"
                />
                <ColorSwatch
                  colorNumber={watchedColorNumber}
                  hex={watchedHex}
                  size="md"
                />
              </div>
              {form.formState.errors.hex && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.hex.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="impression">印象キーワード</Label>
            <Input
              id="impression"
              {...form.register("impression")}
              placeholder="例：深い / 落ち着いた"
              maxLength={100}
            />
            {form.formState.errors.impression && (
              <p className="text-xs text-destructive">
                {form.formState.errors.impression.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ───────────────── ステータス ───────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>ステータス</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-w-sm">
            <Label htmlFor="status">ステータス</Label>
            <Select
              value={form.watch("status") ?? "ACTIVE"}
              onValueChange={(v) =>
                form.setValue("status", v as ColorStatusValue, {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLOR_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
