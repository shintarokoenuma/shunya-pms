import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { getMaterialCategory } from "@/lib/actions/material-categories"
import { MaterialCategoryForm } from "../../_components/material-category-form"
import type { MaterialCategoryFormValues } from "@/lib/validators/material-category"

type Params = Promise<{ id: string }>

export default async function EditMaterialCategoryPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const category = await getMaterialCategory(id)
  if (!category) notFound()

  const initialValues: Partial<MaterialCategoryFormValues> = {
    categoryCode: category.categoryCode,
    categoryName: category.categoryName,
    categoryNameEn: category.categoryNameEn ?? "",
    parentCategoryId: category.parentCategoryId,
    level: category.level as 1 | 2 | 3,
    status: category.status,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/material-categories/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            詳細へ戻る
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">素材カテゴリ 編集</h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          {category.categoryCode} / {category.categoryName}
        </p>
      </div>
      <MaterialCategoryForm
        mode="edit"
        initialId={id}
        initialValues={initialValues}
      />
    </div>
  )
}
