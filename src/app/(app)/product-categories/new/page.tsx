import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { ProductCategoryForm } from "../_components/product-category-form"

export default async function NewProductCategoryPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/product-categories">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧へ戻る
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">商品カテゴリ 新規作成</h1>
        <p className="text-sm text-muted-foreground">
          新しい商品カテゴリを登録します。階層レベルと親カテゴリは登録後も編集できます。
        </p>
      </div>
      <ProductCategoryForm mode="create" />
    </div>
  )
}
