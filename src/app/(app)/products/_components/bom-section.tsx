"use client"

import { useMemo, useState, useTransition } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react"
import { BomItemCategory, type FabricProcurementMode } from "@prisma/client"
import {
  bomItemInputSchema,
  type BomItemFormValues,
  type BomItemInput,
} from "@/lib/validators/bom"
import {
  createBom,
  addBomItem,
  updateBomItem,
  deleteBomItem,
  type BomMaterialOption,
  type BomSupplierOption,
} from "@/lib/actions/boms"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  DialogDescription,
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
  BOM_ITEM_CATEGORY_LABELS,
  BOM_ITEM_CATEGORY_OPTIONS,
  PROCUREMENT_MODE_LABELS,
  PROCUREMENT_MODE_OPTIONS,
  FABRIC_CATEGORIES,
  BOM_UNIT_OPTIONS,
} from "./bom-labels"

const NONE = "__none__"

export type BomItemView = {
  id: string
  itemCategory: BomItemCategory
  materialId: string | null
  materialLabel: string | null
  customMaterialName: string | null
  supplierId: string | null
  supplierLabel: string | null
  usagePerUnit: number | null
  unit: string
  lossRate: number
  procurementMode: FabricProcurementMode | null
  unitPrice: number | null
  colorCode: string | null
  colorName: string | null
  notes: string | null
}

type Props = {
  productId: string
  bomId: string | null
  items: BomItemView[]
  materials: BomMaterialOption[]
  suppliers: BomSupplierOption[]
}

function num(n: number | null): string {
  return n === null ? "—" : n.toLocaleString("ja-JP", { maximumFractionDigits: 4 })
}

/** ロス込み用尺 = usagePerUnit × (1 + lossRate/100) */
function withLoss(usage: number | null, lossRate: number): number | null {
  if (usage === null) return null
  return usage * (1 + lossRate / 100)
}

export function BomSection({ productId, bomId, items, materials, suppliers }: Props) {
  const router = useRouter()
  const [creating, startCreate] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BomItemView | null>(null)
  const [deleting, setDeleting] = useState<BomItemView | null>(null)

  const handleCreateBom = () => {
    startCreate(async () => {
      const r = await createBom(productId)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("資材表を作成しました")
      router.refresh()
    })
  }

  if (!bomId) {
    return (
      <div className="space-y-3 rounded-md border border-dashed py-8 text-center">
        <p className="text-sm text-muted-foreground">資材表（BOM）が未作成です。</p>
        <Button size="sm" onClick={handleCreateBom} disabled={creating}>
          {creating ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1 h-4 w-4" />
          )}
          資材表を作成
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          明細を追加
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
          明細がありません。「明細を追加」から登録してください。
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">区分</TableHead>
                <TableHead>品目</TableHead>
                <TableHead className="w-[120px]">用尺</TableHead>
                <TableHead className="w-[80px]">ロス率</TableHead>
                <TableHead className="w-[110px]">調達</TableHead>
                <TableHead className="w-[110px] text-right">単価</TableHead>
                <TableHead className="w-[130px] text-right">1着概算</TableHead>
                <TableHead className="w-[90px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => {
                const lossUsage = withLoss(it.usagePerUnit, it.lossRate)
                const estimate =
                  lossUsage !== null && it.unitPrice !== null
                    ? lossUsage * it.unitPrice
                    : null
                return (
                  <TableRow key={it.id}>
                    <TableCell className="text-sm">
                      {BOM_ITEM_CATEGORY_LABELS[it.itemCategory]}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">
                        {it.materialLabel ?? it.customMaterialName ?? "—"}
                      </div>
                      {(it.colorCode || it.colorName) && (
                        <div className="text-xs text-muted-foreground">
                          {it.colorCode ? `C/#${it.colorCode}` : ""} {it.colorName ?? ""}
                        </div>
                      )}
                      {it.supplierLabel && (
                        <div className="text-xs text-muted-foreground">
                          {it.supplierLabel}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {it.usagePerUnit === null ? "—" : `${num(it.usagePerUnit)} ${it.unit}`}
                      {lossUsage !== null && (
                        <div className="text-xs text-muted-foreground">
                          ロス込 {num(lossUsage)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{it.lossRate}%</TableCell>
                    <TableCell className="text-sm">
                      {it.procurementMode
                        ? PROCUREMENT_MODE_LABELS[it.procurementMode]
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {it.unitPrice === null ? "未定" : `¥${num(it.unitPrice)}`}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {estimate === null ? "—" : `¥${estimate.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}`}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditing(it)
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setDeleting(it)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        ※ ロス込み用尺・1着概算は参考表示（保存しません）。金額未定の単価は概算から除外されます。
      </p>

      {dialogOpen && (
        <BomItemDialog
          bomId={bomId}
          editing={editing}
          materials={materials}
          suppliers={suppliers}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false)
            router.refresh()
          }}
        />
      )}

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              明細を削除
            </DialogTitle>
            <DialogDescription>
              {deleting?.materialLabel ?? deleting?.customMaterialName ?? "この明細"}{" "}
              を削除します（物理削除・元に戻せません）。
            </DialogDescription>
          </DialogHeader>
          {deleting && (
            <DeleteFooter
              item={deleting}
              onClose={() => setDeleting(null)}
              onDeleted={() => {
                setDeleting(null)
                router.refresh()
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DeleteFooter({
  item,
  onClose,
  onDeleted,
}: {
  item: BomItemView
  onClose: () => void
  onDeleted: () => void
}) {
  const [isPending, startTransition] = useTransition()
  return (
    <DialogFooter>
      <Button variant="outline" onClick={onClose} disabled={isPending}>
        キャンセル
      </Button>
      <Button
        variant="destructive"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await deleteBomItem(item.id)
            if (!r.ok) {
              toast.error(r.error)
              return
            }
            toast.success("明細を削除しました")
            onDeleted()
          })
        }
      >
        {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
        削除する
      </Button>
    </DialogFooter>
  )
}

function emptyValues(): BomItemFormValues {
  return {
    itemCategory: BomItemCategory.MAIN_FABRIC,
    materialId: null,
    customMaterialName: "",
    supplierId: null,
    usagePerUnit: "",
    unit: "m",
    lossRate: "",
    procurementMode: null,
    unitPrice: "",
    colorCode: "",
    colorName: "",
    notes: "",
  }
}

function BomItemDialog({
  bomId,
  editing,
  materials,
  suppliers,
  onClose,
  onSaved,
}: {
  bomId: string
  editing: BomItemView | null
  materials: BomMaterialOption[]
  suppliers: BomSupplierOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()

  const defaultValues: BomItemFormValues = editing
    ? {
        itemCategory: editing.itemCategory,
        materialId: editing.materialId,
        customMaterialName: editing.customMaterialName ?? "",
        supplierId: editing.supplierId,
        usagePerUnit: editing.usagePerUnit === null ? "" : String(editing.usagePerUnit),
        unit: editing.unit,
        lossRate: String(editing.lossRate),
        procurementMode: editing.procurementMode,
        unitPrice: editing.unitPrice === null ? "" : String(editing.unitPrice),
        colorCode: editing.colorCode ?? "",
        colorName: editing.colorName ?? "",
        notes: editing.notes ?? "",
      }
    : emptyValues()

  const form = useForm<BomItemFormValues>({
    resolver: zodResolver(bomItemInputSchema),
    defaultValues,
  })

  const watchCategory = form.watch("itemCategory")
  const watchMaterialId = form.watch("materialId")
  const watchUsage = form.watch("usagePerUnit")
  const watchLoss = form.watch("lossRate")
  const watchPrice = form.watch("unitPrice")
  const isFabric = FABRIC_CATEGORIES.has(watchCategory as BomItemCategory)

  // 参考表示
  const preview = useMemo(() => {
    const u = watchUsage === "" || watchUsage == null ? null : Number(watchUsage)
    const l = watchLoss === "" || watchLoss == null ? 0 : Number(watchLoss)
    const p = watchPrice === "" || watchPrice == null ? null : Number(watchPrice)
    if (u === null || !Number.isFinite(u)) return null
    const lossUsage = u * (1 + l / 100)
    const est = p !== null && Number.isFinite(p) ? lossUsage * p : null
    return { lossUsage, est }
  }, [watchUsage, watchLoss, watchPrice])

  const onSubmit: SubmitHandler<BomItemFormValues> = (values) => {
    startTransition(async () => {
      const payload = values as BomItemInput
      const r = editing
        ? await updateBomItem(editing.id, payload)
        : await addBomItem(bomId, payload)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(editing ? "明細を更新しました" : "明細を追加しました")
      onSaved()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "明細を編集" : "明細を追加"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="itemCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>区分 *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BOM_ITEM_CATEGORY_OPTIONS.map((o) => (
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
                name="materialId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>素材（マスター）</FormLabel>
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={(v) => {
                        if (v === NONE) {
                          field.onChange(null)
                          return
                        }
                        field.onChange(v)
                        const m = materials.find((mm) => mm.id === v)
                        if (m) {
                          form.setValue("unit", m.unit)
                          form.setValue("supplierId", m.primarySupplierId)
                          if (m.standardLossRate != null)
                            form.setValue("lossRate", m.standardLossRate)
                          if (m.unitPrice != null) form.setValue("unitPrice", m.unitPrice)
                          form.setValue("customMaterialName", "")
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="（自由入力）" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>（自由入力）</SelectItem>
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            <span className="font-mono text-xs text-muted-foreground mr-2">
                              {m.materialCode}
                            </span>
                            {m.materialName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      選択すると単位・ロス率・単価・仕入先を初期表示します
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="customMaterialName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>品目名（自由入力）</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={watchMaterialId ? "素材選択中" : "例：本体生地"}
                      disabled={!!watchMaterialId}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>仕入先</FormLabel>
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="（未選択）" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>（未選択）</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            {s.supplierCode}
                          </span>
                          {s.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <FormField
                control={form.control}
                name="usagePerUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用尺（1着）</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="例：2.4195"
                        value={field.value === null || field.value === undefined ? "" : String(field.value)}
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
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>単位 *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BOM_UNIT_OPTIONS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
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
                name="lossRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ロス率(%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="0"
                        value={field.value === null || field.value === undefined ? "" : String(field.value)}
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
              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>単価（未定可）</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="未定なら空欄"
                        value={field.value === null || field.value === undefined ? "" : String(field.value)}
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

            {isFabric && (
              <FormField
                control={form.control}
                name="procurementMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>調達モード（生地）</FormLabel>
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={(v) =>
                        field.onChange(v === NONE ? null : (v as FabricProcurementMode))
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="md:w-[260px]">
                          <SelectValue placeholder="（未選択）" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>（未選択）</SelectItem>
                        {PROCUREMENT_MODE_OPTIONS.map((o) => (
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
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="colorCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>カラー番号</FormLabel>
                    <FormControl>
                      <Input placeholder="例：09" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="colorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>カラー名</FormLabel>
                    <FormControl>
                      <Input placeholder="例：ネイビー" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>メモ</FormLabel>
                  <FormControl>
                    <Textarea rows={2} maxLength={10000} placeholder="任意" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {preview && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <span className="text-muted-foreground">参考: </span>
                ロス込み用尺 {preview.lossUsage.toLocaleString("ja-JP", { maximumFractionDigits: 4 })}
                {preview.est !== null && (
                  <>
                    {" / "}1着概算 ¥
                    {preview.est.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}
                  </>
                )}
              </div>
            )}

            <DialogFooter>
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
