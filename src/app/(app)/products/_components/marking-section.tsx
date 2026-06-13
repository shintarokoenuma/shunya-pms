"use client"

import { useRef, useState, useTransition } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  FileUp,
  FileText,
} from "lucide-react"
import {
  markingRecordInputSchema,
  type MarkingRecordFormValues,
  type MarkingRecordInput,
} from "@/lib/validators/marking"
import {
  createMarkingRecord,
  updateMarkingRecord,
  deleteMarkingRecord,
  attachMarkingPdf,
  getMarkingPdfUrl,
} from "@/lib/actions/markings"
import type { BomMaterialOption } from "@/lib/actions/boms"
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

const NONE = "__none__"

export type MarkingView = {
  id: string
  markerName: string | null
  materialId: string | null
  materialLabel: string | null
  usagePerUnit: number
  fabricWidth: number
  rollLength: number | null
  yieldRate: number | null
  partsCount: number | null
  patternPitch: number | null
  hasPdf: boolean
  notes: string | null
}

type Props = {
  productId: string
  items: MarkingView[]
  materials: BomMaterialOption[]
}

function num(n: number | null): string {
  return n === null ? "—" : n.toLocaleString("ja-JP", { maximumFractionDigits: 4 })
}

export function MarkingSection({ productId, items, materials }: Props) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MarkingView | null>(null)
  const [deleting, setDeleting] = useState<MarkingView | null>(null)

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
          マーキングを追加
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
          マーキング実測が未登録です。
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>マーカー名</TableHead>
                <TableHead className="w-[110px] text-right">着用尺</TableHead>
                <TableHead className="w-[90px] text-right">生地幅</TableHead>
                <TableHead className="w-[90px] text-right">巻きm</TableHead>
                <TableHead className="w-[70px] text-right">収率</TableHead>
                <TableHead className="w-[80px]">原本</TableHead>
                <TableHead className="w-[160px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="text-sm">
                    <div className="font-medium">{it.markerName ?? "（無名）"}</div>
                    {it.materialLabel && (
                      <div className="text-xs text-muted-foreground">{it.materialLabel}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {num(it.usagePerUnit)}m
                  </TableCell>
                  <TableCell className="text-right text-sm">{num(it.fabricWidth)}cm</TableCell>
                  <TableCell className="text-right text-sm">
                    {it.rollLength === null ? "—" : `${num(it.rollLength)}m`}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {it.yieldRate === null ? "—" : `${it.yieldRate}%`}
                  </TableCell>
                  <TableCell>
                    {it.hasPdf ? (
                      <Badge variant="outline" className="text-[10px]">PDF</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <PdfControls id={it.id} hasPdf={it.hasPdf} />
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {dialogOpen && (
        <MarkingDialog
          productId={productId}
          editing={editing}
          materials={materials}
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
              マーキング実測を削除
            </DialogTitle>
            <DialogDescription>
              {deleting?.markerName ?? "このマーキング"} を削除します（論理削除）。
              資材明細から参照中の場合は削除できません。
            </DialogDescription>
          </DialogHeader>
          {deleting && (
            <MarkingDeleteFooter
              id={deleting.id}
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

function PdfControls({ id, hasPdf }: { id: string; hasPdf: boolean }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  const handleFile = (file: File | null) => {
    if (!file) return
    const fd = new FormData()
    fd.set("file", file)
    startTransition(async () => {
      const r = await attachMarkingPdf(id, fd)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("原本PDFを添付しました")
      router.refresh()
    })
  }

  const handleOpen = () => {
    startTransition(async () => {
      const r = await getMarkingPdfUrl(id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      window.open(r.data.url, "_blank", "noopener")
    })
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] ?? null)
          e.target.value = ""
        }}
      />
      {hasPdf && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="PDFを開く"
          onClick={handleOpen}
          disabled={isPending}
        >
          <FileText className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title={hasPdf ? "PDFを差し替え" : "PDFを添付"}
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
      </Button>
    </>
  )
}

function MarkingDeleteFooter({
  id,
  onClose,
  onDeleted,
}: {
  id: string
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
            const r = await deleteMarkingRecord(id)
            if (!r.ok) {
              toast.error(r.error)
              return
            }
            toast.success("マーキング実測を削除しました")
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

function emptyValues(): MarkingRecordFormValues {
  return {
    markerName: "",
    materialId: null,
    usagePerUnit: "",
    fabricWidth: "",
    rollLength: "",
    yieldRate: "",
    partsCount: "",
    patternPitch: "",
    notes: "",
  }
}

function MarkingDialog({
  productId,
  editing,
  materials,
  onClose,
  onSaved,
}: {
  productId: string
  editing: MarkingView | null
  materials: BomMaterialOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()

  const defaultValues: MarkingRecordFormValues = editing
    ? {
        markerName: editing.markerName ?? "",
        materialId: editing.materialId,
        usagePerUnit: String(editing.usagePerUnit),
        fabricWidth: String(editing.fabricWidth),
        rollLength: editing.rollLength === null ? "" : String(editing.rollLength),
        yieldRate: editing.yieldRate === null ? "" : String(editing.yieldRate),
        partsCount: editing.partsCount === null ? "" : String(editing.partsCount),
        patternPitch: editing.patternPitch === null ? "" : String(editing.patternPitch),
        notes: editing.notes ?? "",
      }
    : emptyValues()

  const form = useForm<MarkingRecordFormValues>({
    resolver: zodResolver(markingRecordInputSchema),
    defaultValues,
  })

  const onSubmit: SubmitHandler<MarkingRecordFormValues> = (values) => {
    startTransition(async () => {
      const payload = values as MarkingRecordInput
      const r = editing
        ? await updateMarkingRecord(editing.id, payload)
        : await createMarkingRecord(productId, payload)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(editing ? "マーキングを更新しました" : "マーキングを追加しました")
      onSaved()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "マーキング実測を編集" : "マーキング実測を追加"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="markerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>マーカー名</FormLabel>
                  <FormControl>
                    <Input placeholder="例：SY16-16SY-082(esgrey)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="materialId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>対象素材（任意）</FormLabel>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="usagePerUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>着用尺(m) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" placeholder="例：2.4195" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fabricWidth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>生地幅(cm) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" placeholder="例：100.0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rollLength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>巻きメーター数(m)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="例：50.0"
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

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="yieldRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>収率(%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="例：72.9"
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
                name="partsCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>パーツ数</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        placeholder="例：26"
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
                name="patternPitch"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>柄ピッチ</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="例：0.0"
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
            <FormDescription>
              ※ 原本PDFの添付は保存後、一覧の添付ボタンから行います。
            </FormDescription>

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
