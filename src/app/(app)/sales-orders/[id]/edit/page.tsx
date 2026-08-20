import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { getSalesOrder } from "@/lib/actions/sales-orders"
import {
  listActiveClientsForDeliverySelect,
  listActiveProductsForDeliverySelect,
} from "@/lib/actions/delivery-notes"
import {
  SalesOrderForm,
  type InitialGroup,
} from "../../_components/sales-order-form"

export default async function EditSalesOrderPage({
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

  const skuIds = so.items.map((it) => it.skuId)
  const skus = skuIds.length
    ? await prisma.sku.findMany({
        where: { id: { in: skuIds } },
        select: { id: true, productId: true },
      })
    : []
  const skuProduct = new Map(skus.map((s) => [s.id, s.productId]))

  // 品番でグルーピング（unitPrice は品番内で共通・D-2）。
  const groupMap = new Map<string, InitialGroup>()
  for (const it of so.items) {
    const pid = skuProduct.get(it.skuId)
    if (!pid) continue
    const g =
      groupMap.get(pid) ??
      ({ productId: pid, unitPrice: it.unitPrice, skus: [] } as InitialGroup)
    g.skus.push({
      skuId: it.skuId,
      orderedQuantity: it.orderedQuantity,
      moqStatus: it.moqStatus,
      yieldMode: it.yieldMode,
      yieldRate: it.yieldRate,
      yieldQuantity: it.yieldQuantity,
    })
    groupMap.set(pid, g)
  }

  const [clients, products] = await Promise.all([
    listActiveClientsForDeliverySelect(),
    listActiveProductsForDeliverySelect(),
  ])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/sales-orders/${so.id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            受注詳細
          </Link>
        </Button>
      </div>
      <h1 className="font-mono text-2xl font-semibold tracking-tight">
        {so.soNumber} を編集
      </h1>
      <SalesOrderForm
        mode="edit"
        salesOrderId={so.id}
        clients={clients}
        products={products.map((p) => ({
          id: p.id,
          productCode: p.productCode,
          productName: p.productName,
        }))}
        initialHeader={{
          clientId: so.clientId,
          orderDate: so.orderDate,
          buyerOrderNumber: so.buyerOrderNumber,
          sourceType: so.sourceType,
          currency: so.currency,
          desiredDeliveryDate: so.desiredDeliveryDate,
          title: so.title,
          internalNotes: so.internalNotes,
        }}
        initialGroups={[...groupMap.values()]}
      />
    </div>
  )
}
