"use client"

import { useMemo } from "react"
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
import { Badge } from "@/components/ui/badge"
import type { SkuRow } from "@/lib/types/sku"
import {
  computeMaterialRequirements,
  type MaterialReqBomItem,
} from "@/lib/calc/material-requirement"

/**
 * B-067 D4(ア): 資材所要量セクション（read-only・計算ビュー）。
 * - 数量マトリクス（SKU別 productionQuantity）× BOM 用尺から資材所要量を表示するだけ。
 *   書き込み・発注生成は行わない（PoItem/WoItem draft は後段 B-057）。
 * - 集計はクライアント useMemo（純関数 computeMaterialRequirements）。追加クエリなし。
 */
export function MaterialRequirementSection({
  skus,
  items,
}: {
  skus: SkuRow[]
  items: MaterialReqBomItem[]
}) {
  const rows = useMemo(
    () => computeMaterialRequirements(skus, items),
    [skus, items],
  )

  const empty = items.length === 0 || skus.length === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>資材所要量（量産数 × 用尺）</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            {items.length === 0
              ? "資材表（BOM）が未登録です。先に BOM を登録してください。"
              : "SKU が未登録です。先に数量マトリクスで SKU を生成してください。"}
          </div>
        ) : (
          <div className="space-y-6 overflow-x-auto">
            {rows.map((row) => (
              <div key={row.bomItemId}>
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-medium">{row.itemLabel}</span>
                  <span className="text-xs text-muted-foreground">
                    {row.itemCategory} / {row.unit}
                  </span>
                  {row.status === "USAGE_MISSING" && (
                    <Badge variant="secondary">用尺未入力</Badge>
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>カラーウェイ</TableHead>
                      <TableHead>調達色</TableHead>
                      <TableHead className="text-right">量産数</TableHead>
                      <TableHead className="text-right">ロス込み用尺</TableHead>
                      <TableHead className="text-right">所要量</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {row.breakdown.map((b, i) => (
                      <TableRow key={b.colorwayId ?? `common-${i}`}>
                        <TableCell className="whitespace-nowrap">
                          {b.colorwayLabel ?? (
                            <span className="text-muted-foreground">共通</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-sm">
                          {b.supplierColorCode ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {b.quantity}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {b.totalUsage === null ? "—" : num(b.totalUsage)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {b.requirement === null
                            ? "—"
                            : `${num(b.requirement)} ${row.unit}`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              所要量 = Σ(量産発注数) × ロス込み用尺（usagePerUnit × (1 + ロス率/100)）。反・巻への丸めは未対応（B-039）。「—」は用尺未入力。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** 表示用の数値整形（小数は最大4桁・末尾0は落とす）。外部 export しない。 */
function num(n: number): string {
  return Number(n.toFixed(4)).toLocaleString("ja-JP", {
    maximumFractionDigits: 4,
  })
}
