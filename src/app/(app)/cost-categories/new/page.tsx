import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { CostCategoryForm } from "../_components/cost-category-form"

export default async function NewCostCategoryPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/cost-categories">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          原価費目 新規作成 (Lv2)
        </h1>
        <p className="text-sm text-muted-foreground">
          Lv1 (大分類) は予約 4 行のみ。新規作成は Lv2 (小分類) として登録します。
        </p>
      </div>
      <CostCategoryForm mode="create" />
    </div>
  )
}
