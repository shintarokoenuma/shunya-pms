import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  listActiveBrandsForProductSelect,
  listActiveProductCategoriesForProductSelect,
} from "@/lib/actions/products"
import { ProductForm } from "../_components/product-form"

export default async function NewProductPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const [brands, categories] = await Promise.all([
    listActiveBrandsForProductSelect(),
    listActiveProductCategoriesForProductSelect(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/products">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧へ戻る
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">品番カルテ 新規作成</h1>
        <p className="text-sm text-muted-foreground">
          ブランド・シーズン・カテゴリを選ぶと社内品番がプレビュー表示されます。保存時に確定します。
        </p>
      </div>
      <ProductForm mode="create" brands={brands} categories={categories} />
    </div>
  )
}
