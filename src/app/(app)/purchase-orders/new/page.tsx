import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  listActiveSuppliersForPoSelect,
  listActiveCostCategoriesForPoSelect,
  listActiveMaterialsForPoSelect,
} from "@/lib/actions/purchase-orders"
import { getSampleProduction } from "@/lib/actions/sample-productions"
import { getTask } from "@/lib/actions/progress-tasks"
import { PurchaseOrderForm, type PoContext } from "../_components/purchase-order-form"
import { PROGRESS_TASK_TYPE_LABELS } from "../../samples/_components/progress-task-labels"

type SearchParams = Promise<{ progressTaskId?: string; sampleProductionId?: string }>

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const [suppliers, costCategories, materials] = await Promise.all([
    listActiveSuppliersForPoSelect(),
    listActiveCostCategoriesForPoSelect(),
    listActiveMaterialsForPoSelect(),
  ])

  // 起点ラベル（ラウンド + タスク名）
  let context: PoContext | undefined
  if (sp.sampleProductionId || sp.progressTaskId) {
    const [spRes, taskRes] = await Promise.all([
      sp.sampleProductionId ? getSampleProduction(sp.sampleProductionId) : Promise.resolve(null),
      sp.progressTaskId ? getTask(sp.progressTaskId) : Promise.resolve(null),
    ])
    const roundLabel = spRes && spRes.ok ? spRes.data.sampleNumber : null
    const taskLabel =
      taskRes && taskRes.ok ? PROGRESS_TASK_TYPE_LABELS[taskRes.data.taskType] : null
    const label = [roundLabel, taskLabel].filter(Boolean).join(" / ") || undefined
    context = {
      progressTaskId: sp.progressTaskId,
      sampleProductionId: sp.sampleProductionId,
      label,
    }
  }

  const backHref = sp.sampleProductionId
    ? `/samples/${sp.sampleProductionId}`
    : "/purchase-orders"

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={backHref}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">発注 新規作成</h1>
      </div>
      <PurchaseOrderForm
        mode="create"
        suppliers={suppliers}
        costCategories={costCategories}
        materials={materials}
        context={context}
      />
    </div>
  )
}
