import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { getTextilePatternType } from "@/lib/actions/textile-pattern-types"
import { TextilePatternTypeForm } from "../../_components/textile-pattern-type-form"
import type {
  TextilePatternTypeFormValues,
  TextilePatternTypeStatusValue,
} from "@/lib/validators/textile-pattern-type"

type Params = Promise<{ id: string }>

export default async function EditTextilePatternTypePage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const patternType = await getTextilePatternType(id)
  if (!patternType) notFound()

  const initialValues: Partial<TextilePatternTypeFormValues> = {
    typeCode: patternType.typeCode,
    typeName: patternType.typeName,
    description: patternType.description ?? "",
    sortOrder: patternType.sortOrder,
    status: patternType.status as TextilePatternTypeStatusValue,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/textile-pattern-types/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細へ戻る
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">柄種別 編集</h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          {patternType.typeCode} / {patternType.typeName}
        </p>
      </div>
      <TextilePatternTypeForm
        mode="edit"
        initialId={id}
        initialValues={initialValues}
      />
    </div>
  )
}
