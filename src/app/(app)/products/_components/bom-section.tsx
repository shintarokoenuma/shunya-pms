"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, Pencil, Trash2, AlertTriangle, Download } from "lucide-react"
import {
  BomItemCategory,
  type FabricProcurementMode,
  type UsageSource,
  type CostSource,
} from "@prisma/client"
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
  listPoItemsForBomImport,
  importPoItemsToBom,
  type BomMaterialOption,
  type BomSupplierOption,
  type BomMarkingOption,
  type PoImportGroup,
} from "@/lib/actions/boms"
import { type ColorwayRow } from "@/lib/actions/product-colorways"
import { upsertBomItemColorway } from "@/lib/actions/bom-item-colorways"
import { normalizeSupplierColorCode } from "@/lib/validators/bom-item-colorway"
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
  SIZE_UNIT_OPTIONS,
  USAGE_SOURCE_LABELS,
  COST_SOURCE_LABELS,
  PO_TYPE_LABELS,
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
  supplierItemCode: string | null
  designCode: string | null
  sizeValue: number | null
  sizeUnit: string | null
  usageSource: UsageSource
  markingRecordId: string | null
  costSource: CostSource
  purchaseOrderId: string | null
  colorCode: string | null
  colorName: string | null
  notes: string | null
  // B-062 β 次PR: 資材×カラーウェイの調達カラー（C/#）
  colorways: {
    productColorwayId: string
    supplierColorCode: string
    supplierColorName: string | null
  }[]
}

type Props = {
  productId: string
  bomId: string | null
  items: BomItemView[]
  materials: BomMaterialOption[]
  suppliers: BomSupplierOption[]
  markings: BomMarkingOption[]
  /** B-062 β 次PR: ACTIVE カラーウェイ列（0件なら列を出さない＝二段構えのフォールバック） */
  colorwayColumns: ColorwayRow[]
}

function num(n: number | null): string {
  return n === null ? "—" : n.toLocaleString("ja-JP", { maximumFractionDigits: 4 })
}

/** ロス込み用尺 = usagePerUnit × (1 + lossRate/100) */
function withLoss(usage: number | null, lossRate: number): number | null {
  if (usage === null) return null
  return usage * (1 + lossRate / 100)
}

export function BomSection({ productId, bomId, items, materials, suppliers, markings, colorwayColumns }: Props) {
  const router = useRouter()
  const [creating, startCreate] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BomItemView | null>(null)
  const [deleting, setDeleting] = useState<BomItemView | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const hasColorways = colorwayColumns.length > 0

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
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setImportOpen(true)}
        >
          <Download className="mr-1 h-4 w-4" />
          発注から取り込む
        </Button>
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
                <TableHead className="w-[110px]" rowSpan={hasColorways ? 2 : undefined}>区分</TableHead>
                <TableHead rowSpan={hasColorways ? 2 : undefined}>品目</TableHead>
                {hasColorways && (
                  <TableHead
                    colSpan={colorwayColumns.length}
                    className="border-l text-center text-[11px]"
                  >
                    先方カラー No.（C/#）
                  </TableHead>
                )}
                <TableHead className="w-[120px]" rowSpan={hasColorways ? 2 : undefined}>用尺</TableHead>
                <TableHead className="w-[110px] text-right" rowSpan={hasColorways ? 2 : undefined}>単価</TableHead>
                <TableHead className="w-[130px] text-right" rowSpan={hasColorways ? 2 : undefined}>1着概算</TableHead>
                <TableHead className="w-[80px]" rowSpan={hasColorways ? 2 : undefined}>ロス率</TableHead>
                <TableHead className="w-[110px]" rowSpan={hasColorways ? 2 : undefined}>調達</TableHead>
                <TableHead className="w-[90px]" rowSpan={hasColorways ? 2 : undefined} />
              </TableRow>
              {hasColorways && (
                <TableRow>
                  {colorwayColumns.map((cw, i) => (
                    <TableHead
                      key={cw.id}
                      className={`w-[90px] text-center${i === 0 ? " border-l" : ""}`}
                    >
                      <span className="font-mono">{cw.colorwayCode}</span>
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        {cw.colorwayName}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              )}
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
                      {it.supplierItemCode && (
                        <div className="font-mono text-xs text-muted-foreground">
                          品番 {it.supplierItemCode}
                        </div>
                      )}
                      {it.sizeValue !== null && it.sizeUnit && (
                        <div className="text-xs text-muted-foreground">
                          サイズ {num(it.sizeValue)}
                          {it.sizeUnit}
                        </div>
                      )}
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
                    {colorwayColumns.map((cw) => (
                      <TableCell key={cw.id} className="text-center">
                        <ColorwayCell
                          bomItemId={it.id}
                          productColorwayId={cw.id}
                          initial={
                            it.colorways.find(
                              (c) => c.productColorwayId === cw.id,
                            )?.supplierColorCode ?? ""
                          }
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-sm">
                      {it.usagePerUnit === null ? "—" : `${num(it.usagePerUnit)} ${it.unit}`}
                      {it.usageSource === "MARKING_SHEET" && (
                        <Badge variant="outline" className="ml-1 text-[10px]">
                          実測
                        </Badge>
                      )}
                      {lossUsage !== null && (
                        <div className="text-xs text-muted-foreground">
                          ロス込 {num(lossUsage)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {it.unitPrice === null ? "未定" : `¥${num(it.unitPrice)}`}
                      {it.costSource === "PURCHASE_ORDER" && (
                        <div>
                          <Badge variant="outline" className="text-[10px]">
                            {COST_SOURCE_LABELS.PURCHASE_ORDER}
                          </Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {estimate === null ? "—" : `¥${estimate.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}`}
                    </TableCell>
                    <TableCell className="text-sm">{it.lossRate}%</TableCell>
                    <TableCell className="text-sm">
                      {it.procurementMode
                        ? PROCUREMENT_MODE_LABELS[it.procurementMode]
                        : "—"}
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
          markings={markings}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false)
            router.refresh()
          }}
        />
      )}

      {importOpen && (
        <PoImportDialog
          bomId={bomId}
          productId={productId}
          items={items}
          colorwayColumns={colorwayColumns.filter((c) => c.status === "ACTIVE")}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setImportOpen(false)
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
    supplierItemCode: "",
    designCode: "",
    sizeValue: "",
    sizeUnit: null,
    usageSource: "MANUAL",
    markingRecordId: null,
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
  markings,
  onClose,
  onSaved,
}: {
  bomId: string
  editing: BomItemView | null
  materials: BomMaterialOption[]
  suppliers: BomSupplierOption[]
  markings: BomMarkingOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const hasMarkings = markings.length > 0

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
        supplierItemCode: editing.supplierItemCode ?? "",
        designCode: editing.designCode ?? "",
        sizeValue: editing.sizeValue === null ? "" : String(editing.sizeValue),
        sizeUnit: (editing.sizeUnit as "cm" | "mm" | "m" | "inch" | null) ?? null,
        usageSource: editing.usageSource === "CAD" ? "MANUAL" : editing.usageSource,
        markingRecordId: editing.markingRecordId,
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
  const watchUsageSource = form.watch("usageSource")
  const isFabric = FABRIC_CATEGORIES.has(watchCategory as BomItemCategory)
  const isMarking = watchUsageSource === "MARKING_SHEET"

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

            {/* QE-0c 実務4カラム（仕入先品番 / デザイン番号 / サイズ） */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <FormField
                control={form.control}
                name="supplierItemCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>仕入先品番</FormLabel>
                    <FormControl>
                      <Input placeholder="例：1060341" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="designCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>デザイン番号</FormLabel>
                    <FormControl>
                      <Input placeholder="例：D-A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sizeValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>サイズ（数値）</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="例：56"
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
                name="sizeUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>サイズ単位</FormLabel>
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={(v) =>
                        field.onChange(v === NONE ? null : (v as "cm" | "mm" | "m" | "inch"))
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="単位" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>（未選択）</SelectItem>
                        {SIZE_UNIT_OPTIONS.map((u) => (
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
            </div>

            {/* 用尺の出所（MANUAL / マーキング転記） */}
            <div className="rounded-md border p-3 space-y-3">
              <FormField
                control={form.control}
                name="usageSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用尺の出所</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v)
                        if (v === "MANUAL") {
                          form.setValue("markingRecordId", null)
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="md:w-[280px]">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MANUAL">{USAGE_SOURCE_LABELS.MANUAL}</SelectItem>
                        <SelectItem value="MARKING_SHEET" disabled={!hasMarkings}>
                          {USAGE_SOURCE_LABELS.MARKING_SHEET}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {!hasMarkings && (
                      <FormDescription>
                        マーキング実測が未登録です（下部「マーキング実測」で登録すると転記できます）
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              {isMarking && (
                <FormField
                  control={form.control}
                  name="markingRecordId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>マーキング実測 *</FormLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(v) => {
                          field.onChange(v)
                          const m = markings.find((mm) => mm.id === v)
                          if (m) {
                            // 転記時点の着用尺をコピー（以後は自動追従しない）
                            form.setValue("usagePerUnit", m.usagePerUnit)
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="マーキング図を選択" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {markings.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.markerName ?? "（無名）"}
                              <span className="ml-2 text-muted-foreground">
                                着用尺{m.usagePerUnit}m / 幅{m.fabricWidth}cm
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        選択時点の1着用尺をコピーします。マーキング側を後で編集しても自動追従しません（再選択で更新）。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <FormField
                control={form.control}
                name="usagePerUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用尺（1着）{isMarking && "（実測転記）"}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="例：2.4195"
                        readOnly={isMarking}
                        className={isMarking ? "bg-muted" : undefined}
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

// =============================================================================
// B-065: 発注から取り込むモーダル。候補行ごとに取り込み先を指定する。
//   モード①「品目として」= 新規 BomItem 行（importPoItemsToBom・現挙動）。
//   モード②「各カラーへ」= 既存 BomItem のカラーウェイ調達色（upsertBomItemColorway で C/# を張る）。
//   仕様: docs/specs/b-065-po-import-colorway-spec-confirmation-v1_0-2026-06-23.md（E1〜E6/F1）
// =============================================================================
type ImportTarget =
  | { mode: "ITEM" }
  | { mode: "COLORWAY"; bomItemId: string; productColorwayId: string }

function PoImportDialog({
  bomId,
  productId,
  items,
  colorwayColumns,
  onClose,
  onImported,
}: {
  bomId: string
  productId: string
  items: BomItemView[]
  colorwayColumns: ColorwayRow[]
  onClose: () => void
  onImported: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<PoImportGroup[]>([])
  // key: PoItem.id。Map に存在しない＝取り込まない（未選択）。
  const [targets, setTargets] = useState<Map<string, ImportTarget>>(new Map())
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let active = true
    listPoItemsForBomImport(productId)
      .then((g) => {
        if (active) setGroups(g)
      })
      .catch(() => {
        if (active) toast.error("発注候補の取得に失敗しました")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [productId])

  const setRowMode = (poItemId: string, mode: "NONE" | "ITEM" | "COLORWAY") =>
    setTargets((prev) => {
      const next = new Map(prev)
      if (mode === "NONE") next.delete(poItemId)
      else if (mode === "ITEM") next.set(poItemId, { mode: "ITEM" })
      else next.set(poItemId, { mode: "COLORWAY", bomItemId: "", productColorwayId: "" })
      return next
    })

  const setRowColorwayField = (
    poItemId: string,
    field: "bomItemId" | "productColorwayId",
    value: string,
  ) =>
    setTargets((prev) => {
      const cur = prev.get(poItemId)
      if (!cur || cur.mode !== "COLORWAY") return prev
      const next = new Map(prev)
      next.set(poItemId, { ...cur, [field]: value })
      return next
    })

  const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0)

  // COLORWAY 行で bomItemId/productColorwayId 未充足のものがあれば実行不可（E1）。
  const cwIncomplete = [...targets.values()].some(
    (t) => t.mode === "COLORWAY" && (!t.bomItemId || !t.productColorwayId),
  )

  const handleImport = () => {
    if (targets.size === 0) {
      toast.error("取り込む明細を選択してください")
      return
    }
    const poItemById = new Map(
      groups.flatMap((g) => g.items).map((i) => [i.id, i]),
    )
    const entries = [...targets.entries()]
    const itemIds = entries
      .filter(([, t]) => t.mode === "ITEM")
      .map(([id]) => id)
    const cwTargets = entries.filter(
      (e): e is [string, Extract<ImportTarget, { mode: "COLORWAY" }>] =>
        e[1].mode === "COLORWAY",
    )

    startTransition(async () => {
      let okCount = 0
      let ngCount = 0
      let firstErr: string | null = null
      let itemCount = 0

      // ① 品目として（新規 BomItem）＝既存 action に一括
      if (itemIds.length > 0) {
        const r = await importPoItemsToBom({ bomId, poItemIds: itemIds })
        if (r.ok) {
          itemCount = r.data.count
          okCount += r.data.count
        } else {
          ngCount += itemIds.length
          firstErr = firstErr ?? r.error
        }
      }

      // ② 各カラーへ（C/#）＝1件ずつ upsert。1件失敗しても残りは続行。
      let cwCount = 0
      for (const [poItemId, t] of cwTargets) {
        const poItem = poItemById.get(poItemId)
        const code = normalizeSupplierColorCode(poItem?.supplierItemCode ?? "")
        const r = await upsertBomItemColorway({
          bomItemId: t.bomItemId,
          productColorwayId: t.productColorwayId,
          supplierColorCode: code,
          supplierColorName: "",
        })
        if (r.ok) {
          cwCount++
          okCount++
        } else {
          ngCount++
          firstErr = firstErr ?? r.error
        }
      }

      if (ngCount === 0) {
        toast.success(`品目${itemCount}件 / カラー割当${cwCount}件 を反映しました`)
      } else {
        toast.error(
          `一部失敗: 成功${okCount}件・失敗${ngCount}件（${firstErr ?? ""}）`,
        )
      }
      onImported()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>発注から取り込む</DialogTitle>
          <DialogDescription>
            各明細の取り込み先を指定します。「品目として」＝新規の資材行を起票（単価・通貨・仕入先をコピー）。「各カラーへ」＝既存資材のカラーウェイ調達色（C/#）として仕入先品番を張る（新規行は作りません）。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            候補を読み込み中…
          </div>
        ) : groups.length === 0 || totalItems === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            この品番に紐づく発注明細がありません。
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.poId} className="rounded-md border">
                <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-sm">
                  <div className="font-medium">
                    {g.poNumber}
                    <span className="ml-2 text-muted-foreground">
                      {PO_TYPE_LABELS[g.poType] ?? g.poType}
                      {g.supplierLabel ? ` / ${g.supplierLabel}` : ""}
                    </span>
                  </div>
                </div>
                {g.items.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-muted-foreground">
                    明細なし
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[280px]">取り込み先</TableHead>
                        <TableHead>品名</TableHead>
                        <TableHead className="w-[110px]">仕入先品番</TableHead>
                        <TableHead className="w-[110px]">色</TableHead>
                        <TableHead className="w-[80px]">サイズ</TableHead>
                        <TableHead className="w-[100px] text-right">単価</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.items.map((it) => {
                        const target = targets.get(it.id)
                        const mode = target?.mode ?? "NONE"
                        const noCode = !it.supplierItemCode
                        return (
                          <TableRow key={it.id}>
                            <TableCell className="align-top">
                              <div className="space-y-1.5">
                                <Select
                                  value={mode}
                                  onValueChange={(v) =>
                                    setRowMode(it.id, v as "NONE" | "ITEM" | "COLORWAY")
                                  }
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="NONE">取り込まない</SelectItem>
                                    <SelectItem value="ITEM">品目として（新規行）</SelectItem>
                                    <SelectItem value="COLORWAY" disabled={noCode}>
                                      各カラーへ（C/#）
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                {noCode && (
                                  <p className="text-[10px] leading-tight text-muted-foreground">
                                    仕入先品番が空のため各カラーへ割り当て不可。取り込み後に BOM 表の C/# セルで入力。
                                  </p>
                                )}
                                {target?.mode === "COLORWAY" && (
                                  <div className="space-y-1.5">
                                    <Select
                                      value={target.bomItemId}
                                      onValueChange={(v) =>
                                        setRowColorwayField(it.id, "bomItemId", v)
                                      }
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue placeholder="既存資材を選択" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {items.map((bi) => (
                                          <SelectItem key={bi.id} value={bi.id}>
                                            {bi.materialLabel ??
                                              bi.customMaterialName ??
                                              bi.itemCategory}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Select
                                      value={target.productColorwayId}
                                      onValueChange={(v) =>
                                        setRowColorwayField(it.id, "productColorwayId", v)
                                      }
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue placeholder="カラーウェイを選択" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {colorwayColumns.map((cw) => (
                                          <SelectItem key={cw.id} value={cw.id}>
                                            {cw.colorwayCode} {cw.colorwayName}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="font-medium">
                                {it.customItemName ?? "—"}
                              </div>
                              {it.alreadyInBom && (
                                <Badge variant="outline" className="mt-0.5 text-[10px]">
                                  BOM に既存
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {it.supplierItemCode ?? "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {it.colorCode ? `C/#${it.colorCode} ` : ""}
                              {it.color ?? ""}
                              {!it.colorCode && !it.color ? "—" : ""}
                            </TableCell>
                            <TableCell className="text-xs">
                              {it.sizeValue !== null
                                ? `${it.sizeValue}${it.sizeUnit ?? ""}`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {it.unitPrice === null
                                ? "未定"
                                : `${it.currency} ${Number(it.unitPrice).toLocaleString("ja-JP", { maximumFractionDigits: 4 })}`}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            キャンセル
          </Button>
          <Button
            onClick={handleImport}
            disabled={isPending || targets.size === 0 || cwIncomplete}
          >
            {isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1 h-4 w-4" />
            )}
            選択した{targets.size > 0 ? `${targets.size}件を` : ""}取り込む
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// B-062 β 次PR: 資材×カラーウェイの調達カラー(C/#) インライン編集セル。
//   onBlur / Enter で upsert（空文字なら delete）→ router.refresh()。
// =============================================================================
function ColorwayCell({
  bomItemId,
  productColorwayId,
  initial,
}: {
  bomItemId: string
  productColorwayId: string
  initial: string
}) {
  const router = useRouter()
  const [value, setValue] = useState(initial)
  const [saving, startTransition] = useTransition()

  const save = () => {
    // C/# 接頭辞を剥がして番号だけ保存（validator と二重でも冪等）
    const normalized = normalizeSupplierColorCode(value)
    if (normalized === normalizeSupplierColorCode(initial)) return // 変化なしは何もしない
    startTransition(async () => {
      const r = await upsertBomItemColorway({
        bomItemId,
        productColorwayId,
        supplierColorCode: normalized,
        supplierColorName: "",
      })
      if (!r.ok) {
        toast.error(r.error)
        setValue(initial) // 失敗時は元に戻す
        return
      }
      router.refresh()
    })
  }

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur()
      }}
      disabled={saving}
      placeholder="—"
      className="h-7 w-[72px] text-center font-mono text-xs"
    />
  )
}
