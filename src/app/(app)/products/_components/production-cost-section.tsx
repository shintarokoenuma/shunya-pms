"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import type { SkuRow } from "@/lib/types/sku"
import {
  computeProductionCost,
  type MaterialCostInput,
  type LaborCostInput,
  type ProductionCostRow,
  type ProductionCostExcludeReason,
} from "@/lib/calc/production-cost"

/**
 * QE-1: 量産実績原価ビュー（発注後の実績原価・read-only 計算ビュー・#93 資材所要量の直下）。
 *
 * - 発注済み伝票（BOM・量産WO）の実績を集計する請求突合用ビュー。材料費（ROLL 取り切り /
 *   METER ＋カット代）＋ 工賃（PRODUCTION WoItem）を混在通貨換算して1枚原価まで表示する。
 *   集計は純関数 computeProductionCost（追加クエリなし・書き込みなし）。
 * - 量産見積もり時点の1枚単価は量産見積機能（設計中）で扱う。本ビューは発注後の実績。
 * - USD/JPY レートと METER 行のカット代は画面手入力（保存しない・v1）。
 * - 描画は QE-1 専用（sample 軸の CostBreakdown は伝票前提・JPY 固定のため共有しない）。
 * 仕様: docs/specs/qe-1-implementation-brief-2026-07-12.md §3
 */

const EXCLUDE_LABEL: Record<ProductionCostExcludeReason, string> = {
  AMOUNT_UNDECIDED: "金額未定",
  NON_TARGET_CURRENCY: "対象外通貨",
  INDIVIDUAL_BILLING: "別途請求（1枚原価外）",
}

/** JPY 整数表示。 */
function yen(n: number | null): string {
  if (n === null) return "未定"
  return `¥${Math.round(n).toLocaleString("ja-JP")}`
}

/** 原通貨での金額表示（USD は $・小数2桁 / 他は「値 通貨」）。 */
function original(n: number | null, currency: string): string {
  if (n === null) return "未定"
  if (currency === "USD") {
    return `$${n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
  if (currency === "JPY") return yen(n)
  return `${n.toLocaleString("ja-JP")} ${currency}`
}

function RowLine({ r }: { r: ProductionCostRow }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 text-xs">
      {r.docType === "WO" && r.docId ? (
        <Link
          href={`/work-orders/${r.docId}`}
          className="font-mono text-primary hover:underline"
        >
          {r.docNumber}
        </Link>
      ) : null}
      <span className="font-medium">{r.label}</span>
      {r.note && (
        <span className="text-muted-foreground">（{r.note}）</span>
      )}
      {r.quantity !== null && (
        <span className="tabular-nums text-muted-foreground">
          {r.quantity.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}
          {r.unit ?? ""}
          {r.unitPrice !== null && (
            <> × {original(r.unitPrice, r.currency)}</>
          )}
        </span>
      )}
      <span className={`tabular-nums ${r.excluded ? "text-muted-foreground line-through" : ""}`}>
        {r.currency !== "JPY" && r.amountOriginal !== null ? (
          <>
            {original(r.amountOriginal, r.currency)}
            {r.amountJpy !== null && <> → {yen(r.amountJpy)}</>}
          </>
        ) : (
          yen(r.amountJpy)
        )}
      </span>
      {r.excluded && r.excludeReason && (
        <Badge variant="outline" className="text-[10px]">
          {EXCLUDE_LABEL[r.excludeReason]}
        </Badge>
      )}
    </li>
  )
}

export function ProductionCostSection({
  skus,
  materials,
  labor,
}: {
  skus: SkuRow[]
  materials: MaterialCostInput[]
  labor: LaborCostInput[]
}) {
  const [rateInput, setRateInput] = useState("")
  const [showUsd, setShowUsd] = useState(false)
  const [cutFeeByItem, setCutFeeByItem] = useState<Record<string, string>>({})

  const rate = useMemo(() => {
    const n = Number(rateInput)
    return rateInput.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null
  }, [rateInput])

  // METER 行のカット代（手入力）を材料入力にマージ。
  const materialsWithCutFee = useMemo<MaterialCostInput[]>(
    () =>
      materials.map((m) => {
        if (m.procurementMode !== "METER") return m
        const raw = cutFeeByItem[m.bomItemId]
        const n = raw != null && raw.trim() !== "" ? Number(raw) : 0
        return { ...m, cutFee: Number.isFinite(n) ? n : 0 }
      }),
    [materials, cutFeeByItem],
  )

  const result = useMemo(
    () => computeProductionCost(skus, materialsWithCutFee, labor, rate),
    [skus, materialsWithCutFee, labor, rate],
  )

  const meterItems = materials.filter((m) => m.procurementMode === "METER")
  const empty = materials.length === 0 && labor.length === 0

  const usdOf = (jpy: number): string =>
    rate ? ` （$${(jpy / rate).toLocaleString("en-US", { maximumFractionDigits: 2 })}）` : ""

  return (
    <Card>
      <CardHeader>
        <CardTitle>量産実績原価（発注後・材料費＋工賃）</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            資材表（BOM）と量産発注（PRODUCTION WO）が未登録です。原価を計算する対象がありません。
          </div>
        ) : (
          <div className="space-y-4">
            {/* コントロール（レート・USD 表示・カット代は手入力／保存しない） */}
            <div className="flex flex-wrap items-end gap-4 rounded-md border bg-muted/30 p-3">
              <div className="space-y-1">
                <Label htmlFor="qe1-rate" className="text-xs">
                  USD/JPY レート（保存しない）
                </Label>
                <Input
                  id="qe1-rate"
                  inputMode="decimal"
                  placeholder="例: 150"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  className="h-8 w-32"
                />
              </div>
              <div className="flex items-center gap-2 pb-1">
                <Switch
                  id="qe1-usd"
                  checked={showUsd}
                  onCheckedChange={setShowUsd}
                  disabled={!rate}
                />
                <Label htmlFor="qe1-usd" className="text-xs">
                  USD 換算も表示
                </Label>
              </div>
            </div>

            {/* METER 行のカット代入力（addendum §2・行通貨・保存しない） */}
            {meterItems.length > 0 && (
              <div className="space-y-2 rounded-md border p-3">
                <div className="text-xs font-medium text-muted-foreground">
                  カット代（メーター売り行・行通貨・保存しない）
                </div>
                {meterItems.map((m) => (
                  <div
                    key={m.bomItemId}
                    className="flex flex-wrap items-center gap-2 text-xs"
                  >
                    <span className="min-w-40 font-medium">{m.itemLabel}</span>
                    <span className="text-muted-foreground">{m.currency}</span>
                    <Input
                      inputMode="decimal"
                      placeholder="0"
                      value={cutFeeByItem[m.bomItemId] ?? ""}
                      onChange={(e) =>
                        setCutFeeByItem((prev) => ({
                          ...prev,
                          [m.bomItemId]: e.target.value,
                        }))
                      }
                      className="h-8 w-32"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* 内訳セクション（材料 → 工賃各費目 → 別枠） */}
            <div className="space-y-4 border-t pt-4">
              {result.sections.map((sec) => (
                <div key={sec.key}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-sm font-medium">
                      {sec.label}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {sec.labelEn}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums">
                      {sec.group === "separate" ? "参考 " : "小計 "}
                      {yen(sec.subtotalJpy)}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {sec.rows.map((r) => (
                      <RowLine key={r.key} r={r} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* 合計・1枚原価 */}
            <div className="space-y-1 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">材料費 合計</span>
                <span className="tabular-nums">
                  {yen(result.materialTotalJpy)}
                  {showUsd && usdOf(result.materialTotalJpy)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">工賃 合計</span>
                <span className="tabular-nums">
                  {yen(result.laborTotalJpy)}
                  {showUsd && usdOf(result.laborTotalJpy)}
                </span>
              </div>
              {result.separateTotalJpy > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>別途請求項目（1枚原価に含めない・参考）</span>
                  <span className="tabular-nums">
                    {yen(result.separateTotalJpy)}
                  </span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t pt-2">
                <span className="font-medium">
                  1枚原価（実績・参考）
                  <span className="ml-1 text-xs text-muted-foreground">
                    （量産数 {result.totalQuantity.toLocaleString("ja-JP")} 枚）
                  </span>
                </span>
                {result.unitCostJpy === null ? (
                  <span className="text-sm text-muted-foreground">
                    量産数量が未入力のため計算できません
                  </span>
                ) : (
                  <span className="text-lg font-semibold tabular-nums">
                    {yen(result.unitCostJpy)}
                    {showUsd && usdOf(result.unitCostJpy)}
                  </span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              ※ 計算ビュー（保存しません）。CNY/VND/EUR 行と金額未定行は集計対象外として表示します。
              初期費用（別途請求項目）は1枚原価に含めません。
              <br />
              本セクションは発注済み伝票（BOM・量産WO）の実績集計です（請求突合用）。量産見積もり時点の1枚単価は量産見積機能（設計中）で扱います。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
