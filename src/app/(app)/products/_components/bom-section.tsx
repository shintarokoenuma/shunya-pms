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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
}

type Props = {
  productId: string
  bomId: string | null
  items: BomItemView[]
  materials: BomMaterialOption[]
  suppliers: BomSupplierOption[]
  markings: BomMarkingOption[]
}

function num(n: number | null): string {
  return n === null ? "—" : n.toLocaleString("ja-JP", { maximumFractionDigits: 4 })
}

/** ロス込み用尺 = usagePerUnit × (1 + lossRate/100) */
function withLoss(usage: number | null, lossRate: number): number | null {
  if (usage === null) return null
  return usage * (1 + lossRate / 100)
}

export function BomSection({ productId, bomId, items, materials, suppliers, markings }: Props) {
  const router = useRouter()
  const [creating, startCreate] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BomItemView | null>(null)
  const [deleting, setDeleting] = useState<BomItemView | null>(null)
  const [importOpen, setImportOpen] = useState(false)

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
                    <TableCell className="text-sm">{it.lossRate}%</TableCell>
                    <TableCell className="text-sm">
                      {it.procurementMode
                        ? PROCUREMENT_MODE_LABELS[it.procurementMode]
                        : "—"}
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
// QE-0d: 発注から取り込むモーダル（用尺軸の1行内 select とは別物の専用 UI）。
//   PO 単位グループ表示・PoItem チェックボックス・1操作1PO 繰り返し可。
// =============================================================================
function PoImportDialog({
  bomId,
  productId,
  onClose,
  onImported,
}: {
  bomId: string
  productId: string
  onClose: () => void
  onImported: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<PoImportGroup[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
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

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0)

  const handleImport = () => {
    if (selected.size === 0) {
      toast.error("取り込む明細を選択してください")
      return
    }
    startTransition(async () => {
      const r = await importPoItemsToBom({
        bomId,
        poItemIds: [...selected],
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`${r.data.count}件の明細を取り込みました`)
      onImported()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>発注から取り込む</DialogTitle>
          <DialogDescription>
            この品番に紐づく発注の明細を資材表へ起票します（単価・通貨・仕入先をコピー。用尺は空・後でマーキングから引き当て）。区分は発注の種別から既定設定後、必要に応じて修正してください。
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
                        <TableHead className="w-[40px]" />
                        <TableHead>品名</TableHead>
                        <TableHead className="w-[120px]">仕入先品番</TableHead>
                        <TableHead className="w-[120px]">色</TableHead>
                        <TableHead className="w-[90px]">サイズ</TableHead>
                        <TableHead className="w-[110px] text-right">単価</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.items.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell>
                            <Checkbox
                              checked={selected.has(it.id)}
                              onCheckedChange={() => toggle(it.id)}
                            />
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
                      ))}
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
          <Button onClick={handleImport} disabled={isPending || selected.size === 0}>
            {isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1 h-4 w-4" />
            )}
            選択した{selected.size > 0 ? `${selected.size}件を` : ""}取り込む
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
