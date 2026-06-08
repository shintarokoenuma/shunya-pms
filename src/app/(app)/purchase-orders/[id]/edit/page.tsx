import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  getPurchaseOrder,
  listActiveSuppliersForPoSelect,
  listActiveCostCategoriesForPoSelect,
  listActiveMaterialsForPoSelect,
} from "@/lib/actions/purchase-orders"
import { PurchaseOrderForm } from "../../_components/purchase-order-form"
import type { PurchaseOrderFormValues } from "@/lib/validators/purchase-order"

type Params = Promise<{ id: string }>

function toDateInput(value: Date | null): string {
  if (!value) return ""
  return new Date(value).toISOString().slice(0, 10)
}
function toNum(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === "object" && "toNumber" in value)
    return (value as { toNumber: () => number }).toNumber()
  return Number(value)
}

export default async function EditPurchaseOrderPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const [result, suppliers, costCategories, materials] = await Promise.all([
    getPurchaseOrder(id),
    listActiveSuppliersForPoSelect(),
    listActiveCostCategoriesForPoSelect(),
    listActiveMaterialsForPoSelect(),
  ])
  if (!result.ok) notFound()
  const po = result.data

  const defaultValues: PurchaseOrderFormValues = {
    supplierId: po.supplierId,
    title: po.title ?? "",
    description: po.description ?? "",
    currency: po.currency,
    expectedDeliveryDate: toDateInput(po.expectedDeliveryDate),
    progressTaskId: po.progressTaskId,
    sampleProductionId: po.sampleProductionId,
    items: po.items.map((it) => ({
      materialId: it.materialId,
      customItemName: it.customItemName ?? "",
      description: it.description ?? "",
      supplierItemCode: it.supplierItemCode ?? "",
      designCode: it.designCode ?? "",
      sizeSpec: it.sizeSpec ?? "",
      colorCode: it.colorCode ?? "",
      specification: it.specification ?? "",
      notes: it.notes ?? "",
      quantity: toNum(it.quantity),
      unit: it.unit,
      // v1.1: 単価未定（null）は空欄に
      unitPrice: it.unitPrice == null ? "" : toNum(it.unitPrice),
      costCategoryId: it.costCategoryId,
      billingClassification: it.billingClassification,
      isPhysicalAsset: it.isPhysicalAsset,
      assetStorageStartDate: toDateInput(it.assetStorageStartDate),
      assetStorageExpiryDate: toDateInput(it.assetStorageExpiryDate),
    })),
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/purchase-orders/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">発注 編集</h1>
        <p className="font-mono text-sm text-muted-foreground">{po.poNumber}</p>
      </div>
      <PurchaseOrderForm
        mode="edit"
        id={id}
        suppliers={suppliers}
        costCategories={costCategories}
        materials={materials}
        defaultValues={defaultValues}
        currentPoNumber={po.poNumber}
      />
    </div>
  )
}
