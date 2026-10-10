"use client"

import { useState, useTransition } from "react"
import { ChevronDown, ChevronRight, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { MaterialType } from "@prisma/client"
import {
  listHsReferenceMaterials,
  type HsReferenceMaterial,
} from "@/lib/actions/materials"
import {
  HS_SOURCE_LABELS,
  formatComposition,
  type CompositionData,
} from "@/lib/hs/export-spec"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MATERIAL_TYPE_LABELS } from "./labels"

/**
 * B-211 PR-1（P1-D4・案C）: 「似た材料から写す」
 * - 折りたたみ。開いたときに listHsReferenceMaterials を呼び、近い順の一覧を出す
 * - 行の「写す」は親（export-spec-section）に材料を渡すだけ（保存はフォームの「保存」）
 */
type Props = {
  materialType: MaterialType
  compositionData: CompositionData
  excludeId?: string | null
  onCopy: (ref: HsReferenceMaterial) => void
}

export function ReferenceMaterials({ materialType, compositionData, excludeId, onCopy }: Props) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<HsReferenceMaterial[] | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = () => {
    startTransition(async () => {
      const r = await listHsReferenceMaterials({ materialType, compositionData, excludeId })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setRows(r.data)
    })
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) load()
  }

  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        似た材料から写す
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          HS コードが入っている材料を近い順に 10 件
        </span>
      </button>
      {open && (
        <div className="border-t px-3 py-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              同じ素材タイプ・同じ主素材・混率の近い順。写した後に目付などが違えば下に出ます
            </p>
            <Button type="button" size="sm" variant="ghost" onClick={load} disabled={isPending}>
              {isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              再検索
            </Button>
          </div>
          {rows === null ? (
            <p className="py-2 text-sm text-muted-foreground">読み込み中…</p>
          ) : rows.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              HS コードが入っている材料がまだありません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>材料</TableHead>
                    <TableHead>混率</TableHead>
                    <TableHead>規格</TableHead>
                    <TableHead className="text-right">目付</TableHead>
                    <TableHead>HS コード</TableHead>
                    <TableHead>判定</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-mono text-xs">{r.materialCode}</div>
                        <div className="text-sm">{r.materialName}</div>
                        <div className="text-xs text-muted-foreground">
                          {MATERIAL_TYPE_LABELS[r.materialType]}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.compositionData.length > 0
                          ? formatComposition(r.compositionData)
                          : (r.composition ?? "—")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.specSummary.length > 0 ? r.specSummary.join(" / ") : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {r.fabricWeight !== null ? `${r.fabricWeight} g/㎡` : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{r.hsCode}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.hsSource ? HS_SOURCE_LABELS[r.hsSource] : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" size="sm" variant="outline" onClick={() => onCopy(r)}>
                          <Copy className="mr-1 h-3 w-3" />
                          写す
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
