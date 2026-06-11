import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, FileText } from "lucide-react"
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getWorkOrder } from "@/lib/actions/work-orders"
import { WorkOrderDeleteButton } from "../_components/work-order-delete-button"
import { WorkOrderStatusControl } from "../_components/work-order-status-control"
import { WORK_ORDER_TYPE_LABELS } from "@/lib/constants/work-order-types"
import {
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUS_BADGE_VARIANT,
  WORK_ORDER_CATEGORY_LABELS,
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

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const result = await getWorkOrder(id)
  if (!result.ok) notFound()
  const wo = result.data

  const orderTo = wo.factory
    ? `${wo.factory.factoryCode} ${wo.factory.factoryName}（工場）`
    : wo.contractor
      ? `${wo.contractor.contractorCode} ${wo.contractor.contractorName}（外注先）`
      : "—"

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/work-orders">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold tracking-tight">
                {wo.woNumber}
              </h1>
              <Badge variant={WORK_ORDER_STATUS_BADGE_VARIANT[wo.status]}>
                {WORK_ORDER_STATUS_LABELS[wo.status]}
              </Badge>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {wo.title ?? "（無題）"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <WorkOrderStatusControl id={wo.id} status={wo.status} />
            <Button asChild variant="outline" size="sm">
              <a href={`/api/work-orders/${wo.id}/pdf`} target="_blank" rel="noopener">
                <FileText className="mr-1 h-4 w-4" />
                発注書 PDF
              </a>
            </Button>
            <WorkOrderDeleteButton id={wo.id} woNumber={wo.woNumber} />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent>
          <Row label="発注先" value={orderTo} />
          <Row
            label="作業タイプ（大分類）"
            value={WORK_ORDER_TYPE_LABELS[wo.workType]}
          />
          <Row
            label="発注種類タグ"
            value={WORK_ORDER_CATEGORY_LABELS[wo.workCategory]}
          />
          <Row label="通貨" value={wo.currency} />
          <Row
            label="発注日"
            value={new Date(wo.orderDate).toLocaleDateString("ja-JP")}
          />
          <Row
            label="希望納期"
            value={
              wo.expectedDeliveryDate
                ? new Date(wo.expectedDeliveryDate).toLocaleDateString("ja-JP")
                : "—"
            }
          />
          <Row
            label="紐付け（ラウンド/タスク）"
            value={
              wo.samplProductionId ? (
                <Link
                  href={`/samples/${wo.samplProductionId}`}
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
              wo.description ? (
                <p className="whitespace-pre-wrap">{wo.description}</p>
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
          {wo.items.map((it, i) => (
            <div key={it.id} className="rounded-md border p-3 text-sm">
              <div className="font-medium">
                明細 {i + 1}：{it.workDescription}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-4">
                <Cell label="数量" value={`${fmt(it.quantity)} ${it.unit}`} />
                <Cell
                  label="単価"
                  value={it.unitPrice == null ? "未定" : fmt(it.unitPrice)}
                />
                <Cell
                  label="小計"
                  value={it.subtotal == null ? "未定" : fmt(it.subtotal)}
                />
                <Cell label="カラー" value={it.colorCode ?? "—"} />
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
                {it.notes && (
                  <div className="col-span-2 md:col-span-4">
                    <div className="text-xs text-muted-foreground">メモ</div>
                    <div className="whitespace-pre-wrap">{it.notes}</div>
                  </div>
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
