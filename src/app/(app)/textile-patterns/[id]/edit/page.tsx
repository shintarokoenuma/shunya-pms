import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  getTextilePattern,
  listActivePatternTypes,
} from "@/lib/actions/textile-patterns"
import { TextilePatternForm } from "../../_components/textile-pattern-form"
import type { TextilePatternFormValues } from "@/lib/validators/textile-pattern"
import type { TextilePatternStatusValue } from "@/lib/types/textile-pattern"

type Params = Promise<{ id: string }>

export default async function EditTextilePatternPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const [pattern, patternTypes] = await Promise.all([
    getTextilePattern(id),
    listActivePatternTypes(),
  ])
  if (!pattern) notFound()

  const initialValues: Partial<TextilePatternFormValues> = {
    patternNumber: pattern.patternNumber,
    patternName: pattern.patternName,
    typeId: pattern.typeId,
    sortOrder: pattern.sortOrder,
    status: pattern.status as TextilePatternStatusValue,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/textile-patterns/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細へ戻る
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">柄 編集</h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          {pattern.patternNumber} / {pattern.patternName}
        </p>
      </div>
      <TextilePatternForm
        mode="edit"
        initialId={id}
        initialValues={initialValues}
        patternTypes={patternTypes}
      />
    </div>
  )
}
