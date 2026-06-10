import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { getProcessingType } from "@/lib/actions/processing-types"
import { ProcessingTypeForm } from "../../_components/processing-type-form"
import type { ProcessingTypeFormValues } from "@/lib/validators/processing-type"

type Params = Promise<{ id: string }>

export default async function EditProcessingTypePage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const result = await getProcessingType(id)
  if (!result.ok) {
    notFound()
  }
  const item = result.data

  const defaultValues: ProcessingTypeFormValues = {
    name: item.name,
    workType: item.workType,
    nameEn: item.nameEn ?? "",
    description: item.description ?? "",
    sortOrder: item.sortOrder,
    status: item.status,
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/processing-types/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">加工種別 編集</h1>
        <p className="text-sm text-muted-foreground">
          {item.name}（{item.code}）
        </p>
      </div>
      <ProcessingTypeForm
        mode="edit"
        id={id}
        defaultValues={defaultValues}
        currentCode={item.code}
      />
    </div>
  )
}
