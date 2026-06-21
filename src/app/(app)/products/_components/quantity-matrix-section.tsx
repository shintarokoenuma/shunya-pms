"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { updateSkuQuantity } from "@/lib/actions/skus"
import type { SkuRow } from "@/lib/types/sku"
import { SkuGenerateDialog } from "./sku-generate-dialog"

export function QuantityMatrixSection({
  skus,
  productId,
  defaultSizeOptions,
}: {
  skus: SkuRow[]
  productId: string
  defaultSizeOptions: string[]
}) {
  const [dialogOpen, setDialogOpen] = useState(false)

  // サイズ列: ユニーク集合を sizeOrder 昇順（同値は size 文字列）で
  const sizeCols = Array.from(
    new Map(skus.map((s) => [s.size, { size: s.size, sizeOrder: s.sizeOrder }])).values(),
  ).sort((a, b) => a.sizeOrder - b.sizeOrder || a.size.localeCompare(b.size))

  // カラーウェイ行: colorwayId 単位（colorwayName/Code を表示ラベルに）。出現順は skus が既に
  //   colorway.sortOrder 昇順（listSkusForProduct の orderBy）。柄カラーウェイも行として出る。
  const colorGroups = Array.from(
    new Map(
      skus.map((s) => [
        s.colorwayId,
        { colorwayId: s.colorwayId, colorwayCode: s.colorwayCode, colorwayName: s.colorwayName },
      ]),
    ).values(),
  )

  // セル参照用: colorwayId|size -> SkuRow
  const cellMap = new Map(skus.map((s) => [`${s.colorwayId}|${s.size}`, s]))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>数量マトリクス（カラー×サイズ）</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          SKU を生成
        </Button>
      </CardHeader>
      <CardContent>
        {skus.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            この品番にはまだ SKU が登録されていません。「SKU を生成」から作成してください。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>カラー</TableHead>
                  {sizeCols.map((c) => (
                    <TableHead key={c.size} className="text-right">{c.size}</TableHead>
                  ))}
                  <TableHead className="text-right">計</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {colorGroups.map((g) => {
                  const rowCells = sizeCols.map((c) => cellMap.get(`${g.colorwayId}|${c.size}`) ?? null)
                  const orderedTotal = rowCells.reduce((sum, r) => sum + (r?.orderedQuantity ?? 0), 0)
                  const productionTotal = rowCells.reduce((sum, r) => sum + (r?.productionQuantity ?? 0), 0)
                  return (
                    <TableRow key={g.colorwayId}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {g.colorwayName}
                        <span className="ml-1 text-xs text-muted-foreground">({g.colorwayCode})</span>
                      </TableCell>
                      {rowCells.map((r, i) => (
                        <TableCell key={sizeCols[i].size} className="text-right tabular-nums">
                          {r ? (
                            <div className="leading-tight">
                              <div>{r.orderedQuantity}</div>
                              <EditableProductionQty
                                key={`${r.id}:${r.productionQuantity}`}
                                sku={r}
                              />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums">
                        <div className="leading-tight">
                          <div>{orderedTotal}</div>
                          <div className="text-xs text-muted-foreground">{productionTotal}</div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">
              上段=受注数（orderedQuantity・読み取り専用）／下段=量産発注数（productionQuantity・クリックで編集）。— は当該カラー×サイズの SKU 未登録。
            </p>
          </div>
        )}
      </CardContent>

      {dialogOpen && (
        <SkuGenerateDialog
          productId={productId}
          defaultSizeOptions={defaultSizeOptions}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onGenerated={() => setDialogOpen(false)}
        />
      )}
    </Card>
  )
}

/**
 * 量産発注数の下段インライン編集セル。
 * - key に `${id}:${productionQuantity}` を含めることで、router.refresh 後のサーバ値で remount し
 *   初期値を同期する（useEffect での setState 同期＝set-state-in-effect 罠を回避）。
 * - 確定は blur / Enter。受注数(上段)は触らない。
 */
function EditableProductionQty({ sku }: { sku: SkuRow }) {
  const router = useRouter()
  const [value, setValue] = useState(String(sku.productionQuantity))
  const [pending, startTransition] = useTransition()

  function commit() {
    const trimmed = value.trim()
    const n = Number(trimmed)
    if (trimmed === "" || !Number.isInteger(n) || n < 0) {
      toast.error("量産発注数は 0 以上の整数で入力してください")
      setValue(String(sku.productionQuantity))
      return
    }
    if (n === sku.productionQuantity) return
    startTransition(async () => {
      const r = await updateSkuQuantity(sku.id, { productionQuantity: n })
      if (!r.ok) {
        toast.error(r.error)
        setValue(String(sku.productionQuantity))
        return
      }
      router.refresh()
    })
  }

  return (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      value={value}
      disabled={pending}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      className="w-12 rounded border border-transparent bg-transparent px-1 text-right text-xs text-muted-foreground tabular-nums hover:border-input focus:border-input focus:bg-background focus:text-foreground focus:outline-none disabled:opacity-50"
    />
  )
}
