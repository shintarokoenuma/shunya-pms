import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { WorkOrderType, WorkOrderCategory, ProgressTaskType } from "@prisma/client"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  listActiveFactoriesForWoSelect,
  listActiveContractorsForWoSelect,
  listActiveCostCategoriesForWoSelect,
  getWorkOrderCreateContext,
} from "@/lib/actions/work-orders"
import { getSampleProduction } from "@/lib/actions/sample-productions"
import { WorkOrderForm, type WoContext } from "../_components/work-order-form"
import { PROGRESS_TASK_TYPE_LABELS } from "../../samples/_components/progress-task-labels"

type SearchParams = Promise<{
  progressTaskId?: string
  sampleProductionId?: string
}>

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const [factories, contractors, costCategories] = await Promise.all([
    listActiveFactoriesForWoSelect(),
    listActiveContractorsForWoSelect(),
    listActiveCostCategoriesForWoSelect(),
  ])

  // 既定値: 起点タスクが無い直アクセスのフォールバック
  let context: WoContext = {
    orderToKind: "either",
    suggestedWorkType: WorkOrderType.OTHER,
    suggestedWorkCategory: WorkOrderCategory.SAMPLE,
  }

  if (sp.progressTaskId) {
    const [ctxRes, spRes] = await Promise.all([
      getWorkOrderCreateContext(sp.progressTaskId),
      sp.sampleProductionId
        ? getSampleProduction(sp.sampleProductionId)
        : Promise.resolve(null),
    ])
    if (ctxRes.ok) {
      const c = ctxRes.data
      const roundLabel = spRes && spRes.ok ? spRes.data.sampleNumber : null
      const taskLabel =
        c.taskType === ProgressTaskType.PROCESSING
          ? `加工：${c.processingTypeName ?? "（不明）"}`
          : c.taskType
            ? PROGRESS_TASK_TYPE_LABELS[c.taskType]
            : null
      const label =
        [roundLabel, taskLabel].filter(Boolean).join(" / ") || undefined
      context = {
        progressTaskId: sp.progressTaskId,
        sampleProductionId: c.sampleProductionId ?? sp.sampleProductionId,
        processingTypeId: c.processingTypeId,
        label,
        orderToKind: c.orderToKind,
        suggestedWorkType: c.suggestedWorkType,
        suggestedWorkCategory: c.suggestedWorkCategory,
        isProcessing: c.taskType === ProgressTaskType.PROCESSING,
      }
    }
  }

  const backHref = sp.sampleProductionId
    ? `/samples/${sp.sampleProductionId}`
    : "/work-orders"

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={backHref}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">作業発注 新規作成</h1>
      </div>
      <WorkOrderForm
        mode="create"
        factories={factories}
        contractors={contractors}
        costCategories={costCategories}
        context={context}
      />
    </div>
  )
}
