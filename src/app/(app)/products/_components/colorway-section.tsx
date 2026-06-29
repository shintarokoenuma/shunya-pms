"use client"

import { useState, useTransition } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, Pencil, Archive, ArchiveRestore } from "lucide-react"
import {
  productColorwayInputSchema,
  type ProductColorwayFormValues,
  type ProductColorwayInput,
} from "@/lib/validators/product-colorway"
import {
  createColorway,
  updateColorway,
  archiveColorway,
  restoreColorway,
  type ColorwayRow,
} from "@/lib/actions/product-colorways"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  PRODUCT_COLORWAY_STATUS_LABELS,
  PRODUCT_COLORWAY_STATUS_BADGE_VARIANT,
} from "./colorway-labels"
import type { ProductColorwayStatusValue } from "@/lib/validators/product-colorway"
import { ColorPicker } from "@/components/color/color-picker"
import type { ColorPickerOption } from "@/lib/types/color"
import { PatternPicker } from "@/components/textile-pattern/pattern-picker"
import type { TextilePatternOption } from "@/lib/types/textile-pattern"

export function ColorwaySection({
  productId,
  colorways,
  colorOptions,
  patternOptions,
}: {
  productId: string
  colorways: ColorwayRow[]
  colorOptions: ColorPickerOption[]
  patternOptions: TextilePatternOption[]
}) {
  const router = useRouter()
  // B-063: colorId → マスター色（colorName / colorNameEn）解決用。ピッカー結果の再利用（N+1 を作らない）。
  const colorById = new Map(colorOptions.map((o) => [o.id, o]))
  // B-066-③b: 色展開 / 柄展開で別ダイアログ（案A）。editing は共用。
  const [colorDialogOpen, setColorDialogOpen] = useState(false)
  const [patternDialogOpen, setPatternDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ColorwayRow | null>(null)
  const [pendingId, startTransition] = useTransition()

  const handleArchive = (cw: ColorwayRow) => {
    startTransition(async () => {
      const r =
        cw.status === "ARCHIVED"
          ? await restoreColorway(cw.id)
          : await archiveColorway(cw.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(cw.status === "ARCHIVED" ? "復元しました" : "アーカイブしました")
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(null)
            setColorDialogOpen(true)
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          カラー展開を追加
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(null)
            setPatternDialogOpen(true)
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          柄展開を追加
        </Button>
      </div>

      {colorways.length === 0 ? (
        <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
          カラー展開が未登録です。「カラー展開を追加」「柄展開を追加」から登録してください。
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">記号</TableHead>
                <TableHead>カラー名</TableHead>
                <TableHead className="w-[80px]">色</TableHead>
                <TableHead className="w-[90px]">状態</TableHead>
                <TableHead className="w-[90px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {colorways.map((cw) => (
                <TableRow key={cw.id}>
                  <TableCell className="font-mono text-sm">{cw.colorwayCode}</TableCell>
                  <TableCell className="text-sm">
                    {cw.colorwayName}
                    {cw.patternId &&
                      (() => {
                        const p = patternOptions.find((o) => o.id === cw.patternId)
                        return (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            柄 {p ? p.patternNumber : ""}
                          </Badge>
                        )
                      })()}
                    {cw.colorId &&
                      (() => {
                        const c = colorById.get(cw.colorId)
                        if (!c) return null
                        // マスター解決名: 番号＋色名（あれば英語名を併記）
                        return (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {c.colorNumber} {c.colorName}
                            {c.colorNameEn ? ` / ${c.colorNameEn}` : ""}
                          </span>
                        )
                      })()}
                  </TableCell>
                  <TableCell>
                    {cw.colorHex ? (
                      <span className="flex items-center gap-1">
                        <span
                          className="inline-block h-4 w-4 rounded border"
                          style={{ backgroundColor: cw.colorHex }}
                        />
                        <span className="font-mono text-xs text-muted-foreground">
                          {cw.colorHex}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        PRODUCT_COLORWAY_STATUS_BADGE_VARIANT[
                          cw.status as ProductColorwayStatusValue
                        ] ?? "outline"
                      }
                    >
                      {PRODUCT_COLORWAY_STATUS_LABELS[
                        cw.status as ProductColorwayStatusValue
                      ] ?? cw.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditing(cw)
                          if (cw.patternId) setPatternDialogOpen(true)
                          else setColorDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={pendingId}
                        onClick={() => handleArchive(cw)}
                      >
                        {cw.status === "ARCHIVED" ? (
                          <ArchiveRestore className="h-4 w-4" />
                        ) : (
                          <Archive className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {colorDialogOpen && (
        <ColorColorwayDialog
          productId={productId}
          editing={editing}
          colorOptions={colorOptions}
          onClose={() => setColorDialogOpen(false)}
          onSaved={() => {
            setColorDialogOpen(false)
            router.refresh()
          }}
        />
      )}

      {patternDialogOpen && (
        <PatternColorwayDialog
          productId={productId}
          editing={editing}
          patternOptions={patternOptions}
          onClose={() => setPatternDialogOpen(false)}
          onSaved={() => {
            setPatternDialogOpen(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function emptyValues(): ProductColorwayFormValues {
  return {
    colorwayCode: "",
    colorwayName: "",
    colorHex: "",
    sortOrder: 0,
    status: "ACTIVE",
    colorId: null,
    patternId: null,
  }
}

// B-066-③b: 色/柄 両ダイアログ共通の form ロジック。editing の値は両ダイアログで温存
//   （柄ダイアログで開いても colorId/colorHex は form に保持・画面に出さないだけ。逆も同様）。
function useColorwayForm(
  productId: string,
  editing: ColorwayRow | null,
  kindLabel: string, // "カラー展開" | "柄展開"（toast 用）
  onSaved: () => void,
) {
  const [isPending, startTransition] = useTransition()

  const defaultValues: ProductColorwayFormValues = editing
    ? {
        colorwayCode: editing.colorwayCode,
        colorwayName: editing.colorwayName,
        colorHex: editing.colorHex ?? "",
        sortOrder: editing.sortOrder,
        status: editing.status as ProductColorwayStatusValue,
        colorId: editing.colorId ?? null,
        patternId: editing.patternId ?? null,
      }
    : emptyValues()

  const form = useForm<ProductColorwayFormValues>({
    resolver: zodResolver(productColorwayInputSchema),
    defaultValues,
  })

  const onSubmit: SubmitHandler<ProductColorwayFormValues> = (values) => {
    startTransition(async () => {
      const payload = values as ProductColorwayInput
      const r = editing
        ? await updateColorway(editing.id, payload)
        : await createColorway(productId, payload)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(editing ? `${kindLabel}を更新しました` : `${kindLabel}を追加しました`)
      onSaved()
    })
  }

  return { form, isPending, onSubmit }
}

// 共通フィールド（記号・表示順・カラー名・状態）。色/柄 両ダイアログが描画。
function ColorwayCommonFields({
  form,
}: {
  form: ReturnType<typeof useColorwayForm>["form"]
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="colorwayCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>記号 *</FormLabel>
              <FormControl>
                <Input placeholder="例：A / BLK" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sortOrder"
          render={({ field }) => (
            <FormItem>
              <FormLabel>表示順</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="1"
                  value={
                    field.value === null || field.value === undefined
                      ? ""
                      : String(field.value)
                  }
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="colorwayName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>カラー名 *</FormLabel>
            <FormControl>
              <Input placeholder="例：ブラック / マリンボーダー" {...field} />
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
            <FormLabel>状態</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="md:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="ACTIVE">
                  {PRODUCT_COLORWAY_STATUS_LABELS.ACTIVE}
                </SelectItem>
                <SelectItem value="ARCHIVED">
                  {PRODUCT_COLORWAY_STATUS_LABELS.ARCHIVED}
                </SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}

function ColorwayDialogShell({
  title,
  isPending,
  editing,
  onClose,
  onSubmit,
  form,
  children,
}: {
  title: string
  isPending: boolean
  editing: ColorwayRow | null
  onClose: () => void
  onSubmit: SubmitHandler<ProductColorwayFormValues>
  form: ReturnType<typeof useColorwayForm>["form"]
  children: React.ReactNode
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ColorwayCommonFields form={form} />
            {children}
            <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 mt-2 border-t bg-background px-6 py-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                キャンセル
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {editing ? "更新する" : "追加する"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// 色展開ダイアログ（色のみ・柄欄なし）
function ColorColorwayDialog({
  productId,
  editing,
  colorOptions,
  onClose,
  onSaved,
}: {
  productId: string
  editing: ColorwayRow | null
  colorOptions: ColorPickerOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const { form, isPending, onSubmit } = useColorwayForm(
    productId,
    editing,
    "カラー展開",
    onSaved,
  )
  return (
    <ColorwayDialogShell
      title={editing ? "カラー展開を編集" : "カラー展開を追加"}
      isPending={isPending}
      editing={editing}
      onClose={onClose}
      onSubmit={onSubmit}
      form={form}
    >
      {/* B-063: 色マスターから選択。選ぶと colorId と colorHex をセット。 */}
      <FormField
        control={form.control}
        name="colorId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>色マスター（任意）</FormLabel>
            <ColorPicker
              value={field.value ?? null}
              colors={colorOptions}
              onChange={(colorId, hex) => {
                field.onChange(colorId)
                form.setValue("colorHex", hex ?? "")
              }}
            />
            <FormDescription>
              表示色は色マスター選択で自動セットされます（00 カラー未定で空）。
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="colorHex"
        render={({ field }) => (
          <FormItem>
            <FormLabel>表示色（HEX）</FormLabel>
            <FormControl>
              <Input
                placeholder="（色マスター選択で自動）"
                readOnly
                className="bg-muted"
                {...field}
              />
            </FormControl>
            <FormDescription>
              表示色は色マスター選択で自動セットされます（手入力不可）。
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </ColorwayDialogShell>
  )
}

// 柄展開ダイアログ（柄のみ・色グリッド/HEX なし）
function PatternColorwayDialog({
  productId,
  editing,
  patternOptions,
  onClose,
  onSaved,
}: {
  productId: string
  editing: ColorwayRow | null
  patternOptions: TextilePatternOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const { form, isPending, onSubmit } = useColorwayForm(
    productId,
    editing,
    "柄展開",
    onSaved,
  )
  return (
    <ColorwayDialogShell
      title={editing ? "柄展開を編集" : "柄展開を追加"}
      isPending={isPending}
      editing={editing}
      onClose={onClose}
      onSubmit={onSubmit}
      form={form}
    >
      {/* B-066-③: 柄マスターから選択。柄なし=単色。 */}
      <FormField
        control={form.control}
        name="patternId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>柄マスター（任意）</FormLabel>
            <PatternPicker
              value={field.value ?? null}
              patterns={patternOptions}
              onChange={(patternId) => field.onChange(patternId)}
            />
            <FormDescription>
              柄を選ぶとカラーウェイが「柄」になります。無地は「柄なし（単色）」のまま。
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </ColorwayDialogShell>
  )
}
