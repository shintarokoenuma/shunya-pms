"use client"

import { useState } from "react"
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
import type { SkuRow } from "@/lib/types/sku"
import { SkuGenerateDialog } from "./sku-generate-dialog"

export function QuantityMatrixSection({
  skus,
  productId,
  defaultSizeOptions,
  categoryId,
  bare = false,
}: {
  skus: SkuRow[]
  productId: string
  defaultSizeOptions: string[]
  categoryId: string | null
  /** B: 統合ボックス（カラー×数量）内に置く際は自前 Card を描画しない。 */
  bare?: boolean
}) {
  const [dialogOpen, setDialogOpen] = useState(false)

  // 生成ダイアログの初期チェック用: この品番に既にあるサイズ集合。
  const existingSizes = Array.from(new Set(skus.map((s) => s.size)))

  // サイズ列順: カテゴリ defaultSizeOptions の並び順を権威にする（(B) 即追従＝SKU.sizeOrder の
  //   生成時値には依存しない）。候補に無いサイズ（手入力 3L 等）は末尾に size 文字列昇順で。
  const sizeIndex = new Map(defaultSizeOptions.map((s, i) => [s, i]))
  const sizeCols = Array.from(new Set(skus.map((s) => s.size)))
    .map((size) => ({ size }))
    .sort((a, b) => {
      const ia = sizeIndex.has(a.size) ? (sizeIndex.get(a.size) as number) : Infinity
      const ib = sizeIndex.has(b.size) ? (sizeIndex.get(b.size) as number) : Infinity
      return ia - ib || a.size.localeCompare(b.size)
    })

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

  const generateButton = (
    <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
      <Plus className="mr-1 h-4 w-4" />
      SKU を生成
    </Button>
  )

  const dialog = dialogOpen && (
    <SkuGenerateDialog
      productId={productId}
      defaultSizeOptions={defaultSizeOptions}
      existingSizes={existingSizes}
      categoryId={categoryId}
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      onGenerated={() => setDialogOpen(false)}
    />
  )

  const body =
    skus.length === 0 ? (
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
                      <TableCell className="whitespace-nowrap">
                        <span className="font-mono font-medium">{g.colorwayCode}</span>
                        <span className="ml-2 text-muted-foreground">{g.colorwayName}</span>
                      </TableCell>
                      {rowCells.map((r, i) => (
                        <TableCell key={sizeCols[i].size} className="text-right tabular-nums">
                          {r ? (
                            <div className="leading-tight">
                              <div>{r.orderedQuantity}</div>
                              <div className="text-xs text-muted-foreground">
                                {r.productionQuantity}
                              </div>
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
              上段=受注数（orderedQuantity）／下段=量産発注数（productionQuantity）。いずれも受注（SO）由来のためこの画面では編集できません。— は当該カラー×サイズの SKU 未登録。
            </p>
          </div>
    )

  // 統合ボックス内（bare）では自前 Card を描かず、見出し＋操作＋本文のみ。
  if (bare) {
    return (
      <div className="space-y-2">
        <div className="flex flex-row items-center justify-between">
          <h4 className="text-sm font-medium">数量マトリクス（カラー×サイズ）</h4>
          {generateButton}
        </div>
        {body}
        {dialog}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>数量マトリクス（カラー×サイズ）</CardTitle>
        {generateButton}
      </CardHeader>
      <CardContent>{body}</CardContent>
      {dialog}
    </Card>
  )
}
