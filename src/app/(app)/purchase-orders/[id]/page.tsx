import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, Pencil } from "lucide-react"
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPurchaseOrder } from "@/lib/actions/purchase-orders"
import { PurchaseOrderDeleteButton } from "../_components/purchase-order-delete-button"
import { PurchaseOrderStatusControl } from "../_components/purchase-order-status-control"
import {
  PURCHASE_ORDER_STATUS_LABELS,
  PURCHASE_ORDER_STATUS_BADGE_VARIANT,
  BILLING_CLASSIFICATION_LABELS,
} from "../_components/labels"

type Params = Promise<{ id: string }>

function fmt(value: unknown): string {
  if (value === null || value === undefined) return "—"
  const n =
    typeof value === "number"
      ? value
      : typeof value === "object" && value && "toNumber" in value
        ? (value as { toNumber: () => number }).toNumber()
        : Number(value)
  if (!Number.isFinite(n)) return "—"
  return n.toLocaleString("ja-JP", { maximumFractionDigits: 4 })
}

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const result = await getPurchaseOrder(id)
  if (!result.ok) notFound()
  const po = result.data

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/purchase-orders">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold tracking-tight">
                {po.poNumber}
              </h1>
              <Badge variant={PURCHASE_ORDER_STATUS_BADGE_VARIANT[po.status]}>
                {PURCHASE_ORDER_STATUS_LABELS[po.status]}
              </Badge>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {po.title ?? "（無題）"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PurchaseOrderStatusControl id={po.id} status={po.status} />
            <Button asChild variant="outline" size="sm">
              <Link href={`/purchase-orders/${id}/edit`}>
                <Pencil className="mr-1 h-4 w-4" />
                編集
              </Link>
            </Button>
            <PurchaseOrderDeleteButton id={po.id} poNumber={po.poNumber} />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent>
          <Row
            label="発注先"
            value={
              po.supplier ? (
                <span>
                  <span className="font-mono text-xs text-muted-foreground mr-1">
                    {po.supplier.supplierCode}
                  </span>
                  {po.supplier.companyName}
                </span>
              ) : (
                "—"
              )
            }
          />
          <Row label="通貨" value={po.currency} />
          <Row
            label="発注日"
            value={new Date(po.orderDate).toLocaleDateString("ja-JP")}
          />
          <Row
            label="希望納期"
            value={
              po.expectedDeliveryDate
                ? new Date(po.expectedDeliveryDate).toLocaleDateString("ja-JP")
                : "—"
            }
          />
          <Row
            label="紐付け（ラウンド/タスク）"
            value={
              po.sampleProductionId ? (
                <Link
                  href={`/samples/${po.sampleProductionId}`}
                  className="text-primary hover:underline"
                >
                  サンプル製作セットを開く
                </Link>
              ) : (
                "—"
              )
            }
          />
          <Row
            label="摘要"
            value={
              po.description ? (
                <p className="whitespace-pre-wrap">{po.description}</p>
              ) : (
                "—"
              )
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">明細</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {po.items.map((it, i) => (
            <div key={it.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  明細 {i + 1}：
                  {it.customItemName ??
                    (it.materialId ? "（素材マスター）" : "（品目未設定）")}
                </span>
                {it.isPhysicalAsset && (
                  <Badge variant="outline" className="text-xs">現物資産</Badge>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-4">
                <Cell label="仕入先品番" value={it.supplierItemCode ?? "—"} />
                <Cell label="デザイン番号" value={it.designCode ?? "—"} />
                <Cell label="カラー" value={it.colorCode ?? "—"} />
                <Cell
                  label="サイズ"
                  value={
                    it.sizeValue != null
                      ? `${fmt(it.sizeValue)}${it.sizeUnit ?? ""}`
                      : "—"
                  }
                />
                <Cell label="数量" value={`${fmt(it.quantity)} ${it.unit}`} />
                <Cell
                  label="単価"
                  value={it.unitPrice == null ? "未定" : fmt(it.unitPrice)}
                />
                <Cell
                  label="小計"
                  value={it.subtotal == null ? "未定" : fmt(it.subtotal)}
                />
                <Cell
                  label="費目"
                  value={
                    it.costCategory
                      ? `${it.costCategory.categoryCode} ${it.costCategory.categoryName}`
                      : "—"
                  }
                />
                <Cell
                  label="売り立て区分"
                  value={
                    it.billingClassification
                      ? BILLING_CLASSIFICATION_LABELS[it.billingClassification]
                      : "—"
                  }
                />
                {it.specification && (
                  <div className="col-span-2 md:col-span-4">
                    <div className="text-xs text-muted-foreground">仕様・規格</div>
                    <div className="whitespace-pre-wrap">{it.specification}</div>
                  </div>
                )}
                {it.isPhysicalAsset && (
                  <Cell
                    label="保管"
                    value={`${
                      it.assetStorageStartDate
                        ? new Date(it.assetStorageStartDate).toLocaleDateString("ja-JP")
                        : "—"
                    } 〜 ${
                      it.assetStorageExpiryDate
                        ? new Date(it.assetStorageExpiryDate).toLocaleDateString("ja-JP")
                        : "—"
                    }`}
                  />
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 text-sm py-1">
      <div className="text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  )
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  )
}
