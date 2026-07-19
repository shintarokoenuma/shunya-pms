import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  getWorkOrder,
  listActiveFactoriesForWoSelect,
  listActiveContractorsForWoSelect,
  listActiveCostCategoriesForWoSelect,
} from "@/lib/actions/work-orders"
import { WorkOrderForm } from "../../_components/work-order-form"
import type { WorkOrderFormValues } from "@/lib/validators/work-order"

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

export default async function EditWorkOrderPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const [result, factories, contractors, costCategories] = await Promise.all([
    getWorkOrder(id),
    listActiveFactoriesForWoSelect(),
    listActiveContractorsForWoSelect(),
    listActiveCostCategoriesForWoSelect(),
  ])
  if (!result.ok) notFound()
  const wo = result.data

  // B-079 / production-axis §2-1: DRAFT のみ編集可。非 DRAFT は詳細へリダイレクト。
  if (wo.status !== "DRAFT") {
    redirect(`/work-orders/${id}`)
  }

  const defaultValues: WorkOrderFormValues = {
    factoryId: wo.factoryId,
    contractorId: wo.contractorId,
    workType: wo.workType,
    workCategory: wo.workCategory,
    title: wo.title ?? "",
    description: wo.description ?? "",
    currency: wo.currency,
    expectedDeliveryDate: toDateInput(wo.expectedDeliveryDate),
    // 既存の紐付けを保持（refine: productId || sampleProductionId を満たす）
    productId: wo.productId,
    progressTaskId: wo.progressTaskId,
    sampleProductionId: wo.samplProductionId,
    processingTypeId: wo.processingTypeId,
    items: wo.items.map((it) => ({
      workDescription: it.workDescription,
      colorCode: it.colorCode ?? "",
      size: it.size ?? "",
      quantity: toNum(it.quantity),
      unit: it.unit,
      // 単価未定（null）は空欄に
      unitPrice: it.unitPrice == null ? "" : toNum(it.unitPrice),
      // 行通貨（T-0 / B-071）: 既存の行通貨をフォームに読み込む
      currency: it.currency,
      costCategoryId: it.costCategoryId,
      billingClassification: it.billingClassification,
      notes: it.notes ?? "",
    })),
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/work-orders/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">作業発注 編集</h1>
        <p className="font-mono text-sm text-muted-foreground">{wo.woNumber}</p>
      </div>
      <WorkOrderForm
        mode="edit"
        id={id}
        factories={factories}
        contractors={contractors}
        costCategories={costCategories}
        defaultValues={defaultValues}
        currentWoNumber={wo.woNumber}
      />
    </div>
  )
}
