"use client"

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
import type { SkuRow } from "@/lib/actions/skus"

export function QuantityMatrixSection({ skus }: { skus: SkuRow[] }) {
  // サイズ列: ユニーク集合を sizeOrder 昇順（同値は size 文字列）で
  const sizeCols = Array.from(
    new Map(skus.map((s) => [s.size, { size: s.size, sizeOrder: s.sizeOrder }])).values(),
  ).sort((a, b) => a.sizeOrder - b.sizeOrder || a.size.localeCompare(b.size))

  // 色グループ: colorCode 単位（colorName を表示ラベルに）。出現順は skus が既に colorCode 昇順。
  const colorGroups = Array.from(
    new Map(skus.map((s) => [s.colorCode, { colorCode: s.colorCode, colorName: s.colorName }])).values(),
  )

  // セル参照用: colorCode|size -> SkuRow
  const cellMap = new Map(skus.map((s) => [`${s.colorCode}|${s.size}`, s]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>数量マトリクス（カラー×サイズ）</CardTitle>
      </CardHeader>
      <CardContent>
        {skus.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            この品番にはまだ SKU が登録されていません。
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
                  const rowCells = sizeCols.map((c) => cellMap.get(`${g.colorCode}|${c.size}`) ?? null)
                  const orderedTotal = rowCells.reduce((sum, r) => sum + (r?.orderedQuantity ?? 0), 0)
                  const productionTotal = rowCells.reduce((sum, r) => sum + (r?.productionQuantity ?? 0), 0)
                  return (
                    <TableRow key={g.colorCode}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {g.colorName}
                        <span className="ml-1 text-xs text-muted-foreground">({g.colorCode})</span>
                      </TableCell>
                      {rowCells.map((r, i) => (
                        <TableCell key={sizeCols[i].size} className="text-right tabular-nums">
                          {r ? (
                            <div className="leading-tight">
                              <div>{r.orderedQuantity}</div>
                              <div className="text-xs text-muted-foreground">{r.productionQuantity}</div>
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
              上段=受注数（orderedQuantity）／下段=量産発注数（productionQuantity）。— は当該カラー×サイズの SKU 未登録。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
