"use client"

import { useMemo, useState, useTransition } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, FileDown } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { downloadQuotationPdf } from "@/lib/quotations/download-quotation-pdf"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CompanyRoughEstimateRow } from "@/lib/actions/rough-estimates"

type Props = {
  rows: CompanyRoughEstimateRow[]
}

type SortDir = "asc" | "desc" | null

export function QuotationsList({ rows }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [pending, startTransition] = useTransition()

  // null=元順(issuedAt desc)。asc/desc は宛先(clientName)の日本語ロケール順。
  const sortedRows = useMemo(() => {
    if (sortDir === null) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const cmp = a.clientName.localeCompare(b.clientName, "ja")
      return sortDir === "asc" ? cmp : -cmp
    })
    return copy
  }, [rows, sortDir])

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

  function cycleSort() {
    setSortDir((prev) => (prev === null ? "asc" : prev === "asc" ? "desc" : null))
  }

  // 選択中の宛先(clientId)が複数種混ざっていないか
  const selectedClientIds = useMemo(() => {
    const ids = new Set<string>()
    for (const r of rows) if (selected.has(r.id)) ids.add(r.clientId)
    return ids
  }, [rows, selected])
  const mixed = selectedClientIds.size > 1

  function handleExport() {
    const ids = [...selected]
    if (ids.length === 0) return
    startTransition(async () => {
      const r = await downloadQuotationPdf(ids)
      if (!r.ok) toast.error(r.message)
    })
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        見積もりがありません
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button
          onClick={handleExport}
          disabled={selected.size === 0 || mixed || pending}
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
              <TableHead>タイトル</TableHead>
              <TableHead className="w-[220px]">
                <button
                  type="button"
                  onClick={cycleSort}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  宛先
                  {sortDir === "asc" ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : sortDir === "desc" ? (
                    <ArrowDown className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </TableHead>
              <TableHead className="w-[100px] text-right">提示MOQ</TableHead>
              <TableHead className="w-[120px]">発行日</TableHead>
              <TableHead className="w-[160px]">RE番号</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((r) => (
              <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(r.id)}
                    onCheckedChange={() => toggle(r.id)}
                    aria-label={`${r.estimateNumber} を選択`}
                  />
                </TableCell>
                <TableCell>
                  <div className="font-medium">{r.productName}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {r.productCode}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {r.title ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-sm">{r.clientName}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {r.presentedMoq != null ? (
                    r.presentedMoq.toLocaleString("ja-JP")
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {new Date(r.issuedAt).toLocaleDateString("ja-JP")}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {r.estimateNumber}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
