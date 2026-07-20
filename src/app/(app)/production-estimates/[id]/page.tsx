import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, Pencil } from "lucide-react"
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getProductionEstimate,
  type ProductionEstimateItemDTO,
} from "@/lib/actions/production-estimates"
import { getNavRefs } from "@/lib/actions/nav-refs"
import { buildDocBreadcrumb } from "@/lib/nav/breadcrumb"
import { EntityBreadcrumb } from "../../_components/entity-breadcrumb"
import {
  PRODUCTION_ESTIMATE_CATEGORY_LABELS,
  PRODUCTION_ESTIMATE_SOURCE_LABELS,
} from "@/lib/constants/production-estimate-types"

type Params = Promise<{ id: string }>

function jpy(n: number | null): string {
  return n === null ? "—" : `¥${n.toLocaleString("ja-JP")}`
}

function num(n: number | null, unit = ""): string {
  if (n === null) return "—"
  return `${n.toLocaleString("ja-JP", { maximumFractionDigits: 4 })}${unit}`
}

export default async function ProductionEstimateDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const result = await getProductionEstimate(id)
  if (!result.ok) notFound()
  const pe = result.data

  const nav = await getNavRefs(pe.productId, pe.sourceSampleProductionId)
  const crumbs = buildDocBreadcrumb({
    product: nav.product,
    sample: nav.sample,
    currentLabel: pe.estimateNumber,
    listLabel: "量産見積",
    listHref: `/products/${pe.productId}`,
  })

  const separateTotalJpy = pe.items.reduce(
    (acc, it) =>
      it.isSeparateBilling && it.presentedPriceManualJpy != null
        ? acc + it.presentedPriceManualJpy
        : acc,
    0,
  )
  const finalUnit = pe.finalUnitPriceManualJpy ?? pe.autoUnitPriceJpy
  const isManual = pe.finalUnitPriceManualJpy !== null
  const grandTotal =
    finalUnit === null
      ? null
      : finalUnit * pe.estimateQuantity + separateTotalJpy

  const costItems = pe.items.filter((it) => !it.isSeparateBilling)
  const separateItems = pe.items.filter((it) => it.isSeparateBilling)

  return (
    <div className="space-y-6 p-6">
      <EntityBreadcrumb segments={crumbs} />
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/products/${pe.productId}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            品番カルテに戻る
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight">
              {pe.estimateNumber}
            </h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {pe.title ?? "（無題）"}
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/production-estimates/${pe.id}/edit`}>
              <Pencil className="mr-1 h-4 w-4" />
              編集
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <Row label="発行日" value={new Date(pe.issuedAt).toLocaleDateString("ja-JP")} />
          <Row
            label="見積数量（分母）"
            value={pe.estimateQuantity.toLocaleString("ja-JP")}
          />
          <Row
            label="利益率"
            value={pe.marginRate === null ? "—" : `${pe.marginRate}%`}
          />
          <Row
            label="USD/JPY レート"
            value={pe.exchangeRateUsdJpy === null ? "—" : num(pe.exchangeRateUsdJpy)}
          />
          <Row label="1枚原価（自動）" value={jpy(pe.autoUnitCostJpy)} />
          <Row label="1枚単価（自動）" value={jpy(pe.autoUnitPriceJpy)} />
          <Row
            label="最終1枚単価"
            value={
              <span>
                {jpy(finalUnit)}
                {isManual && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    手打ち
                  </Badge>
                )}
              </span>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">明細（1枚原価の対象）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {costItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">対象明細はありません。</p>
          ) : (
            costItems.map((it) => (
              <ItemRow
                key={it.id}
                it={it}
                estimateQuantity={pe.estimateQuantity}
              />
            ))
          )}
        </CardContent>
      </Card>

      {separateItems.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="text-base text-amber-700">
              別途請求項目（1枚原価外）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {separateItems.map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-2 text-sm"
              >
                <span>{it.itemName}</span>
                <span className="font-mono">
                  {it.presentedPriceManualJpy === null ? (
                    <span className="text-muted-foreground">非計上</span>
                  ) : (
                    jpy(it.presentedPriceManualJpy)
                  )}
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 text-sm">
              <span className="text-muted-foreground">別枠合計</span>
              <span className="font-mono text-amber-700">{jpy(separateTotalJpy)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">総合計（参考）</CardTitle>
        </CardHeader>
        <CardContent>
          <Row
            label={`最終単価 × ${pe.estimateQuantity.toLocaleString("ja-JP")} ＋ 別枠`}
            value={<span className="text-base font-medium">{jpy(grandTotal)}</span>}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function ItemRow({
  it,
  estimateQuantity,
}: {
  it: ProductionEstimateItemDTO
  estimateQuantity: number
}) {
  const isMaterial = it.itemCategory === "MATERIAL"
  const requirement =
    it.usagePerUnit === null
      ? null
      : it.usagePerUnit * estimateQuantity * (1 + it.lossRate / 100)
  const perUnitJpy =
    it.subtotalJpy !== null && estimateQuantity > 0
      ? it.subtotalJpy / estimateQuantity
      : null
  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {PRODUCTION_ESTIMATE_CATEGORY_LABELS[it.itemCategory]}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {PRODUCTION_ESTIMATE_SOURCE_LABELS[it.source]}
          </Badge>
          <span className="font-medium">{it.itemName}</span>
        </div>
        <span className="font-mono text-xs font-medium">
          {jpy(perUnitJpy)}/枚
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-4">
        <Cell label="単価" value={`${num(it.unitPrice)} ${it.currency}`} />
        {isMaterial ? (
          <Cell
            label="所要量（自動）"
            value={
              requirement === null
                ? "—"
                : `${num(requirement)} ${it.unit ?? ""}`
            }
          />
        ) : (
          <Cell label="数量" value={`${num(it.quantity)} ${it.unit ?? ""}`} />
        )}
        <Cell
          label="使用量/枚"
          value={it.usagePerUnit === null ? "—" : num(it.usagePerUnit)}
        />
        <Cell label="1枚あたり(JPY)" value={jpy(perUnitJpy)} />
        <Cell label="行小計" value={`${num(it.subtotal)} ${it.currency}`} />
        <Cell label="行小計(JPY)" value={jpy(it.subtotalJpy)} />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[220px_1fr] gap-3 py-1 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  )
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-xs">{value}</div>
    </div>
  )
}
