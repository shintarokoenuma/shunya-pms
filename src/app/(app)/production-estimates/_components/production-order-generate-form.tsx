"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SearchableSelect } from "../../_components/searchable-select"
import { generateProductionOrders } from "@/lib/actions/production-order-generation"
import type { ProductionOrderGenerationContext } from "@/lib/actions/production-estimates"

/** 相手先セレクトの値エンコード（LABOR は factory/contractor を1本にまとめる）。 */
function encodeTarget(type: string, id: string) {
  return `${type}:${id}`
}
function decodeTarget(
  v: string,
): { targetType: "supplier" | "factory" | "contractor"; targetId: string } | null {
  const idx = v.indexOf(":")
  if (idx < 0) return null
  const type = v.slice(0, idx)
  const id = v.slice(idx + 1)
  if (type !== "supplier" && type !== "factory" && type !== "contractor")
    return null
  if (!id) return null
  return { targetType: type, targetId: id }
}

export function ProductionOrderGenerateForm({
  ctx,
}: {
  ctx: ProductionOrderGenerationContext
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // SKU 数量（既定=productionQuantity・整数・0 可）。
  const [skuQty, setSkuQty] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const cw of ctx.colorways)
      for (const cell of cw.sizes)
        init[cell.skuId] = String(cell.productionQuantity)
    return init
  })

  // 相手先（peItemId → エンコード値）。既定は導出値。
  const [targets, setTargets] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const line of ctx.lines) {
      if (line.target.kind === "MATERIAL" && line.target.supplierId) {
        init[line.peItemId] = encodeTarget("supplier", line.target.supplierId)
      } else if (
        line.target.kind === "LABOR" &&
        line.target.targetType &&
        line.target.targetId
      ) {
        init[line.peItemId] = encodeTarget(
          line.target.targetType,
          line.target.targetId,
        )
      }
    }
    return init
  })

  const supplierOptions = useMemo(
    () =>
      ctx.options.suppliers.map((s) => ({
        value: encodeTarget("supplier", s.id),
        label: `${s.companyName}`,
        keywords: `${s.supplierCode} ${s.companyName}`,
      })),
    [ctx.options.suppliers],
  )
  const woTargetOptions = useMemo(
    () => [
      ...ctx.options.factories.map((f) => ({
        value: encodeTarget("factory", f.id),
        label: `${f.factoryName}（工場）`,
        keywords: `${f.factoryCode} ${f.factoryName}`,
      })),
      ...ctx.options.contractors.map((c) => ({
        value: encodeTarget("contractor", c.id),
        label: `${c.contractorName}（外注先）`,
        keywords: `${c.contractorCode} ${c.contractorName}`,
      })),
    ],
    [ctx.options.factories, ctx.options.contractors],
  )

  // 総量・色別合計（reactive）。
  const totalQty = useMemo(() => {
    let t = 0
    for (const cw of ctx.colorways)
      for (const cell of cw.sizes) t += Number(skuQty[cell.skuId] || 0)
    return t
  }, [skuQty, ctx.colorways])

  const qtyMismatch = totalQty !== ctx.pe.estimateQuantity

  // プレビュー: 仕入先別 PO 本数・相手先別 WO 本数。
  const preview = useMemo(() => {
    const suppliers = new Set<string>()
    const woTargets = new Set<string>()
    for (const line of ctx.lines) {
      const v = targets[line.peItemId]
      const dec = v ? decodeTarget(v) : null
      if (!dec) continue
      if (line.itemCategory === "MATERIAL" && dec.targetType === "supplier")
        suppliers.add(dec.targetId)
      if (line.itemCategory === "LABOR" && dec.targetType !== "supplier")
        woTargets.add(`${dec.targetType}:${dec.targetId}`)
    }
    return { poCount: suppliers.size, woCount: woTargets.size }
  }, [targets, ctx.lines])

  const missingCount = ctx.lines.filter((l) => !targets[l.peItemId]).length
  const canGenerate = missingCount === 0 && totalQty > 0 && !isPending

  function onGenerate() {
    startTransition(async () => {
      const skuQuantities = Object.entries(skuQty).map(([skuId, q]) => ({
        skuId,
        quantity: Number(q || 0),
      }))
      const targetList = ctx.lines
        .map((l) => {
          const dec = targets[l.peItemId] ? decodeTarget(targets[l.peItemId]) : null
          if (!dec) return null
          return {
            peItemId: l.peItemId,
            targetType: dec.targetType,
            targetId: dec.targetId,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)

      const r = await generateProductionOrders({
        peId: ctx.pe.id,
        skuQuantities,
        targets: targetList,
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      const { createdPos, createdWos, partialError, productId } = r.data
      const summary = `PO ${createdPos.length}本${
        createdPos.length ? `（${createdPos.map((p) => p.poNumber).join(", ")}）` : ""
      } / WO ${createdWos.length}本${
        createdWos.length ? `（${createdWos.map((w) => w.woNumber).join(", ")}）` : ""
      }`
      if (partialError) {
        toast.warning(`一部生成して停止しました: ${partialError}｜${summary}`)
      } else {
        toast.success(`量産発注を生成しました：${summary}`)
      }
      // Part8: 発注セクションに着地させる。
      router.push(`/products/${productId}#orders`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* SKU 数量マトリクス */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SKU 数量（カラーウェイ × サイズ）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ctx.colorways.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              この品番に SKU（カラーウェイ）が登録されていません。
            </p>
          ) : (
            ctx.colorways.map((cw) => (
              <div key={cw.colorwayId} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-violet-300 text-violet-700"
                  >
                    {cw.colorwayName}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {cw.colorwayCode}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {cw.sizes.map((cell) => (
                    <label key={cell.skuId} className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
                        {cell.size}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        className="w-24"
                        data-testid={`skuqty-${cell.skuId}`}
                        value={skuQty[cell.skuId] ?? ""}
                        onChange={(e) =>
                          setSkuQty((prev) => ({
                            ...prev,
                            [cell.skuId]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))
          )}

          <div className="flex items-center gap-3 border-t pt-3 text-sm">
            <span className="text-muted-foreground">Σ入力数量</span>
            <span className="font-mono font-medium" data-testid="total-qty">
              {totalQty.toLocaleString("ja-JP")}
            </span>
            <span className="text-muted-foreground">
              / 見積数量 {ctx.pe.estimateQuantity.toLocaleString("ja-JP")}
            </span>
          </div>
          {qtyMismatch && (
            <div
              data-testid="qty-warning"
              className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Σ入力数量が見積数量と一致しません（受注確定数量のずれは正常・生成は続行できます）。
            </div>
          )}
        </CardContent>
      </Card>

      {/* 明細行と相手先 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">生成対象の明細と相手先</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ctx.lines.length === 0 && (
            <p className="text-sm text-muted-foreground">
              生成対象の明細（自社手配・非別枠）がありません。
            </p>
          )}
          {ctx.lines.map((line) => {
            const isMaterial = line.itemCategory === "MATERIAL"
            const options = isMaterial ? supplierOptions : woTargetOptions
            const derived =
              line.target.kind === "MATERIAL"
                ? line.target.supplierSource
                : line.target.targetSource
            return (
              <div
                key={line.peItemId}
                className="flex flex-wrap items-center gap-3 rounded-md border p-3"
              >
                <Badge
                  variant="secondary"
                  className={
                    isMaterial
                      ? "border-sky-300 bg-sky-100 text-sky-700"
                      : undefined
                  }
                >
                  {isMaterial ? "材料費" : "工賃"}
                </Badge>
                <span className="min-w-40 flex-1 text-sm font-medium">
                  {line.itemName}
                </span>
                <div className="w-72" data-testid={`target-${line.peItemId}`}>
                  <SearchableSelect
                    options={options}
                    value={targets[line.peItemId] ?? null}
                    onChange={(v) =>
                      setTargets((prev) => ({ ...prev, [line.peItemId]: v }))
                    }
                    placeholder={isMaterial ? "仕入先を選択" : "工場/外注先を選択"}
                    ariaLabel={`相手先-${line.itemName}`}
                  />
                </div>
                {derived ? (
                  <span className="text-[11px] text-muted-foreground">
                    導出:{" "}
                    {derived === "saved"
                      ? "前回の指定"
                      : derived === "sourcePo"
                        ? "元PO"
                        : derived === "sourceWo"
                          ? "元WO"
                          : "素材マスター"}
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-700">要指定</span>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* プレビュー & 生成 */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="text-sm">
            生成プレビュー:{" "}
            <span className="font-medium">
              仕入先別 PO {preview.poCount} 本 / 相手先別 WO {preview.woCount} 本
            </span>
            {missingCount > 0 && (
              <span className="ml-2 text-amber-700">
                （相手先 未指定 {missingCount} 件・全て指定すると生成できます）
              </span>
            )}
          </div>
          <Button
            onClick={onGenerate}
            disabled={!canGenerate}
            data-testid="generate-btn"
          >
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            量産発注を生成
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
