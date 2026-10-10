"use client"

import { AlertTriangle, Plus, Trash2 } from "lucide-react"
import { FIBERS, FIBER_LABELS, type Fiber } from "@/lib/hs/export-spec"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * B-211 PR-2（P2-D6）: 混率の行の部品。材料フォーム（export-spec-section）と発注の「HS を決める」ダイアログで共有。
 * - 行は { fiber, percent }。percent は入力途中の文字列を許す（数値化は呼び出し側）
 * - 合計が 100 でなければ黄色の注意（保存は止めない）
 */
export type CompositionRowInput = { fiber: Fiber; percent: string | number }

export type CompositionRowError = { percent?: { message?: string }; fiber?: { message?: string } } | undefined

type Props = {
  rows: CompositionRowInput[]
  onChange: (rows: CompositionRowInput[]) => void
  /** 数値化できた行の合計（呼び出し側で計算） */
  total: number
  /** 行ごとの検証エラー（react-hook-form の errors など。無ければ省略） */
  rowErrors?: { message?: string; [i: number]: CompositionRowError }
  /** 見出しを出すか（ダイアログでは質問文が見出しになるので false） */
  showLabel?: boolean
  emptyHint?: string
}

export function CompositionRows({ rows, onChange, total, rowErrors, showLabel = true, emptyHint }: Props) {
  const totalWarn = rows.length > 0 && Math.abs(total - 100) > 0.01
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {showLabel ? <Label className="text-sm">混率</Label> : <span />}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...rows, { fiber: "COTTON", percent: "" }])}
        >
          <Plus className="mr-1 h-3 w-3" />
          行を足す
        </Button>
      </div>
      {rows.length === 0 && emptyHint && <p className="text-xs text-muted-foreground">{emptyHint}</p>}
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Select
            value={row.fiber}
            onValueChange={(v) => onChange(rows.map((r, j) => (j === i ? { ...r, fiber: v as Fiber } : r)))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIBERS.map((f) => (
                <SelectItem key={f} value={f}>
                  {FIBER_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.1"
            className="w-[110px]"
            value={row.percent === null || row.percent === undefined ? "" : String(row.percent)}
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, percent: e.target.value } : r)))}
            aria-label={`${FIBER_LABELS[row.fiber]} の %`}
          />
          <span className="text-sm text-muted-foreground">%</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            aria-label="行を消す"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {(rowErrors?.[i]?.percent?.message || rowErrors?.[i]?.fiber?.message) && (
            <p className="w-full text-xs text-destructive">
              {rowErrors?.[i]?.percent?.message ?? rowErrors?.[i]?.fiber?.message}
            </p>
          )}
        </div>
      ))}
      {typeof rowErrors?.message === "string" && <p className="text-xs text-destructive">{rowErrors.message}</p>}
      {rows.length > 0 && (
        <p className={totalWarn ? "flex items-center gap-1 text-xs text-amber-700" : "text-xs text-muted-foreground"}>
          {totalWarn && <AlertTriangle className="h-3 w-3" />}
          合計 {Number.isInteger(total) ? total : total.toFixed(1)}%
          {totalWarn && "（100% になっていません。保存はできます）"}
        </p>
      )}
    </div>
  )
}

/** 入力途中の行を数値化（壊れた行は落とす）。両画面で同じ扱いにする */
export function toCompositionData(rows: CompositionRowInput[]): { fiber: Fiber; percent: number }[] {
  return rows
    .map((r) => {
      const n = typeof r.percent === "number" ? r.percent : r.percent.trim() === "" ? NaN : Number(r.percent)
      return { fiber: r.fiber, percent: n }
    })
    .filter((r) => Number.isFinite(r.percent))
}
