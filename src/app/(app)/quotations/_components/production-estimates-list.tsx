"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { FileDown } from "lucide-react"
import { toast } from "sonner"
import type { CompanyProductionEstimateRow } from "@/lib/actions/production-estimates"
import {
  usePdfPreview,
  PdfPreviewDialog,
} from "@/components/pdf/pdf-preview-dialog"
import { Button } from "@/components/ui/button"
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

export function ProductionEstimatesList({
  rows,
}: {
  rows: CompanyProductionEstimateRow[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const preview = usePdfPreview()

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const allSelected = rows.length > 0 && selected.size === rows.length
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
  }

  // 宛先混在ガード（clientId が複数種）。
  const mixed = useMemo(() => {
    const ids = new Set<string>()
    for (const r of rows) if (selected.has(r.id)) ids.add(r.clientId)
    return ids.size > 1
  }, [rows, selected])

  // PE_NOT_READY: 数量0 or 最終1枚単価なし（finalUnitPriceJpy = 手打ち ?? 自動）。
  const notReady = useMemo(
    () =>
      rows
        .filter((r) => selected.has(r.id))
        .filter((r) => r.estimateQuantity <= 0 || r.finalUnitPriceJpy == null)
        .map((r) => r.estimateNumber),
    [rows, selected],
  )
  const hasNotReady = notReady.length > 0

  function handleExport() {
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

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        量産見積はまだありません。品番カルテの確定サンプルから作成できます。
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <PdfPreviewDialog
        url={preview.url}
        filename={preview.filename}
        onClose={preview.close}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={handleExport}
          disabled={selected.size === 0 || mixed || hasNotReady || pending}
        >
          <FileDown className="mr-1 h-4 w-4" />
          選択をPDF出力
          {selected.size > 0 && `（${selected.size}）`}
        </Button>
        {mixed && (
          <p className="text-sm text-destructive">
            宛先が異なる見積が含まれています
          </p>
        )}
        {!mixed && hasNotReady && (
          <p className="text-sm text-destructive">
            見積数量0または1枚単価未確定の見積が含まれています（
            {notReady.join(", ")}）
          </p>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[44px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="全選択"
                />
              </TableHead>
              <TableHead>品番</TableHead>
              <TableHead>品名</TableHead>
              <TableHead>タイトル</TableHead>
              <TableHead>PE番号</TableHead>
              <TableHead>発行日</TableHead>
              <TableHead className="text-right">見積数量</TableHead>
              <TableHead className="text-right">最終1枚単価</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.id}
                data-state={selected.has(r.id) ? "selected" : undefined}
                className="cursor-pointer"
                onClick={() => router.push(`/production-estimates/${r.id}`)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.has(r.id)}
                    onCheckedChange={() => toggle(r.id)}
                    aria-label={`${r.estimateNumber} を選択`}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {r.productCode}
                </TableCell>
                <TableCell className="text-sm">{r.productName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.title ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {r.estimateNumber}
                </TableCell>
                <TableCell className="text-xs">
                  {new Date(r.issuedAt).toLocaleDateString("ja-JP")}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {r.estimateQuantity.toLocaleString("ja-JP")}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {jpy(r.finalUnitPriceJpy)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
