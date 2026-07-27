"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  FileDown,
  PackagePlus,
} from "lucide-react"
import {
  createProductionEstimateFromSample,
  softDeleteProductionEstimate,
  type ProductionEstimateListRow,
} from "@/lib/actions/production-estimates"
import {
  usePdfPreview,
  PdfPreviewDialog,
} from "@/components/pdf/pdf-preview-dialog"
import { Button } from "@/components/ui/button"
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

function jpy(n: number | null): string {
  return n === null ? "—" : `¥${n.toLocaleString("ja-JP")}`
}

type Props = {
  productId: string
  rows: ProductionEstimateListRow[]
  hasBaseSample: boolean
}

export function ProductionEstimateSection({
  productId,
  rows,
  hasBaseSample,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const preview = usePdfPreview()

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 品番カルテ内は単一クライアント＝宛先混在なし。PE_NOT_READY のみガード。
  const notReady = useMemo(
    () =>
      rows
        .filter((r) => selected.has(r.id))
        .filter(
          (r) =>
            r.estimateQuantity <= 0 ||
            (r.finalUnitPriceManualJpy == null && r.autoUnitPriceJpy == null),
        )
        .map((r) => r.estimateNumber),
    [rows, selected],
  )
  const hasNotReady = notReady.length > 0

  const handleExport = () => {
    const ids = [...selected]
    if (ids.length === 0) return
    startTransition(async () => {
      const r = await preview.open(
        "/api/production-estimates/pdf",
        ids,
        "量産見積書.pdf",
      )
      if (!r.ok) toast.error(r.message)
    })
  }

  const handleCreate = () => {
    startTransition(async () => {
      const r = await createProductionEstimateFromSample(productId)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`量産見積 ${r.data.estimateNumber} を作成しました`)
      router.push(`/production-estimates/${r.data.id}/edit`)
    })
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    startTransition(async () => {
      const r = await softDeleteProductionEstimate(id)
      setDeletingId(null)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("量産見積を削除しました")
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <PdfPreviewDialog
        url={preview.url}
        filename={preview.filename}
        onClose={preview.close}
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {hasNotReady && (
          <span className="text-xs text-destructive">
            見積数量0または1枚単価未確定は出力不可（{notReady.join(", ")}）
          </span>
        )}
        {rows.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={selected.size === 0 || hasNotReady || pending}
          >
            <FileDown className="mr-1 h-4 w-4" />
            選択をPDF出力
            {selected.size > 0 && `（${selected.size}）`}
          </Button>
        )}
        {!hasBaseSample && (
          <span className="text-xs text-muted-foreground">
            確定サンプル（量産見積の基準）が未指定です。サンプル一覧で「基準にする」を選択してください。
          </span>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={handleCreate}
          disabled={!hasBaseSample || pending}
        >
          {pending && deletingId === null ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1 h-4 w-4" />
          )}
          サンプルから見積作成
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          量産見積はまだありません。
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead>見積番号</TableHead>
              <TableHead>発行日</TableHead>
              <TableHead className="text-right">見積数量</TableHead>
              <TableHead className="text-right">1枚原価(自動)</TableHead>
              <TableHead className="text-right">最終1枚単価</TableHead>
              <TableHead className="text-right">別枠合計</TableHead>
              <TableHead className="w-[130px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const finalUnit = r.finalUnitPriceManualJpy ?? r.autoUnitPriceJpy
              const isManual = r.finalUnitPriceManualJpy !== null
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggle(r.id)}
                      aria-label={`${r.estimateNumber} を選択`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.estimateNumber}
                    {r.title && (
                      <span className="ml-2 text-muted-foreground">
                        {r.title}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(r.issuedAt).toLocaleDateString("ja-JP")}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {r.estimateQuantity.toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {jpy(r.autoUnitCostJpy)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {jpy(finalUnit)}
                    {isManual && (
                      <Badge variant="secondary" className="ml-1 text-[10px]">
                        手打ち
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {jpy(r.separateTotalJpy)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        asChild
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                      >
                        <Link href={`/production-estimates/${r.id}/edit`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      {/* (B): 量産発注生成の入口。 */}
                      <Button
                        asChild
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="量産発注を生成"
                      >
                        <Link href={`/production-estimates/${r.id}/generate`}>
                          <PackagePlus className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(r.id)}
                        disabled={pending && deletingId === r.id}
                      >
                        {pending && deletingId === r.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        asChild
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                      >
                        <Link href={`/production-estimates/${r.id}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
