import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, Pencil } from "lucide-react"
import { YieldMode } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getSalesOrder } from "@/lib/actions/sales-orders"
import { SalesOrderStatusControl } from "../_components/sales-order-status-control"
import { SalesOrderCancelButton } from "../_components/sales-order-cancel-button"
import {
  ORDER_SOURCE_TYPE_LABELS,
  SKU_MOQ_STATUS_LABELS,
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_STATUS_BADGE_VARIANT,
} from "../_components/labels"

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const { id } = await params

  const result = await getSalesOrder(id)
  if (!result.ok) notFound()
  const so = result.data

  // 明細（SoItem）を品番でグルーピングするための SKU 情報を引く。
  const skuIds = so.items.map((it) => it.skuId)
  const skus = skuIds.length
    ? await prisma.sku.findMany({
        where: { id: { in: skuIds } },
        select: {
          id: true,
          productId: true,
          colorName: true,
          size: true,
          sizeOrder: true,
        },
      })
    : []
  const skuInfo = new Map(skus.map((s) => [s.id, s]))
  const productIds = [...new Set(skus.map((s) => s.productId))]
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, productCode: true, productName: true },
      })
    : []
  const productInfo = new Map(products.map((p) => [p.id, p]))
  const client = await prisma.client.findFirst({
    where: { id: so.clientId },
    select: { companyName: true },
  })

  // productId → items
  const grouped = new Map<string, typeof so.items>()
  for (const it of so.items) {
    const pid = skuInfo.get(it.skuId)?.productId ?? "unknown"
    const arr = grouped.get(pid) ?? []
    arr.push(it)
    grouped.set(pid, arr)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/sales-orders">
            <ChevronLeft className="mr-1 h-4 w-4" />
            受注一覧
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <SalesOrderCancelButton id={so.id} soNumber={so.soNumber} />
          <Button asChild variant="outline" size="sm">
            <Link href={`/sales-orders/${so.id}/edit`}>
              <Pencil className="mr-1 h-4 w-4" />
              編集
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-semibold tracking-tight">
          {so.soNumber}
        </h1>
        <Badge variant={SALES_ORDER_STATUS_BADGE_VARIANT[so.status]}>
          {SALES_ORDER_STATUS_LABELS[so.status]}
        </Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">受注情報</CardTitle>
          <SalesOrderStatusControl id={so.id} status={so.status} />
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
          <Cell label="クライアント" value={client?.companyName ?? "—"} />
          <Cell label="先方発注番号" value={so.buyerOrderNumber ?? "—"} />
          <Cell label="受注ソース" value={ORDER_SOURCE_TYPE_LABELS[so.sourceType]} />
          <Cell label="通貨" value={so.currency} />
          <Cell label="受注日" value={so.orderDate} />
          <Cell label="希望納期" value={so.desiredDeliveryDate ?? "—"} />
          <Cell
            label="総数量"
            value={so.totalQuantity.toLocaleString("ja-JP")}
          />
          <Cell
            label="金額（税抜）"
            value={
              so.totalAmount === null
                ? "—"
                : `${so.currency} ${so.totalAmount.toLocaleString("ja-JP")}`
            }
          />
        </CardContent>
      </Card>

      {[...grouped.entries()].map(([pid, items]) => {
        const p = productInfo.get(pid)
        return (
          <Card key={pid}>
            <CardHeader>
              <CardTitle className="text-base">
                {p ? (
                  <span>
                    <span className="font-mono text-sm text-muted-foreground">
                      {p.productCode}
                    </span>{" "}
                    {p.productName}
                  </span>
                ) : (
                  "（不明な品番）"
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>カラー / サイズ</TableHead>
                    <TableHead className="w-[90px] text-right">受注数</TableHead>
                    <TableHead className="w-[110px] text-right">量産数量</TableHead>
                    <TableHead className="w-[110px] text-right">歩留まり</TableHead>
                    <TableHead className="w-[100px] text-right">単価</TableHead>
                    <TableHead className="w-[110px] text-right">小計</TableHead>
                    <TableHead className="w-[160px]">MOQ 判定</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items
                    .slice()
                    .sort(
                      (a, b) =>
                        (skuInfo.get(a.skuId)?.sizeOrder ?? 0) -
                        (skuInfo.get(b.skuId)?.sizeOrder ?? 0),
                    )
                    .map((it) => {
                      const info = skuInfo.get(it.skuId)
                      return (
                        <TableRow key={it.id}>
                          <TableCell className="text-sm">
                            {info ? `${info.colorName} / ${info.size}` : it.skuId}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {it.orderedQuantity.toLocaleString("ja-JP")}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {it.productionQuantity === null
                              ? "—"
                              : it.productionQuantity.toLocaleString("ja-JP")}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {yieldLabel(it)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {it.unitPrice === null
                              ? "—"
                              : it.unitPrice.toLocaleString("ja-JP")}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {it.subtotal === null
                              ? "—"
                              : it.subtotal.toLocaleString("ja-JP")}
                          </TableCell>
                          <TableCell className="text-sm">
                            {SKU_MOQ_STATUS_LABELS[it.moqStatus]}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}

/** 歩留まりの表示（率 or 加算枚数）。未設定は「—」。 */
function yieldLabel(it: {
  yieldMode: YieldMode | null
  yieldRate: number | null
  yieldQuantity: number | null
}): string {
  if (it.yieldMode === YieldMode.RATE) {
    return it.yieldRate === null ? "—" : `+${it.yieldRate}%`
  }
  if (it.yieldMode === YieldMode.QUANTITY) {
    return it.yieldQuantity === null ? "—" : `+${it.yieldQuantity}枚`
  }
  return "—"
}
