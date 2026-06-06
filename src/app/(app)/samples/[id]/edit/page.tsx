import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { getSampleProduction } from "@/lib/actions/sample-productions"
import { listAssignableUsers } from "@/lib/actions/clients"
import { SampleProductionForm } from "../../_components/sample-production-form"
import type { SampleProductionFormValues } from "@/lib/validators/sample-production"

type Params = Promise<{ id: string }>

/** Date | null を <input type="date"> 用の YYYY-MM-DD 文字列に変換 */
function toDateInput(value: Date | null): string {
  if (!value) return ""
  return new Date(value).toISOString().slice(0, 10)
}

export default async function EditSampleProductionPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const [result, users] = await Promise.all([
    getSampleProduction(id),
    listAssignableUsers(),
  ])
  if (!result.ok) {
    notFound()
  }
  const item = result.data
  // アーカイブ済みは編集不可（詳細から復元してから）
  if (item.deletedAt) redirect(`/samples/${id}`)
  if (!item.product) notFound()

  const defaultValues: SampleProductionFormValues = {
    productId: item.productId,
    parentSampleId: item.parentSampleId,
    title: item.title ?? "",
    description: item.description ?? "",
    sampleQuantity: item.sampleQuantity,
    plannedStartDate: toDateInput(item.plannedStartDate),
    plannedCompletionDate: toDateInput(item.plannedCompletionDate),
    assignedToUserId: item.assignedToUserId,
    internalNotes: item.internalNotes ?? "",
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/samples/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">サンプル編集</h1>
        <p className="font-mono text-sm text-muted-foreground">
          {item.sampleNumber}
        </p>
      </div>
      <SampleProductionForm
        mode="edit"
        id={id}
        product={{
          id: item.product.id,
          productCode: item.product.productCode,
          clientProductCode: item.product.clientProductCode,
          productName: item.product.productName,
        }}
        users={users}
        defaultValues={defaultValues}
        currentSampleNumber={item.sampleNumber}
      />
    </div>
  )
}
