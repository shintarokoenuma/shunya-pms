import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { MaterialCategoryForm } from "../_components/material-category-form"

export default async function NewMaterialCategoryPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/material-categories">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧へ戻る
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">素材カテゴリ 新規作成</h1>
        <p className="text-sm text-muted-foreground">
          新しい素材カテゴリを登録します。階層レベルと親カテゴリは登録後も編集できます。
        </p>
      </div>
      <MaterialCategoryForm mode="create" />
    </div>
  )
}
