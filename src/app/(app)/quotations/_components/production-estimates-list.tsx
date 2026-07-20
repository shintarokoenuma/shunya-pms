"use client"

import { useRouter } from "next/navigation"
import type { CompanyProductionEstimateRow } from "@/lib/actions/production-estimates"
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

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        量産見積はまだありません。品番カルテの確定サンプルから作成できます。
      </p>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
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
              className="cursor-pointer"
              onClick={() => router.push(`/production-estimates/${r.id}`)}
            >
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
  )
}
