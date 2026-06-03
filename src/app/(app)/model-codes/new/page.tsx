import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, AlertTriangle } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { listActiveBrandsForModelCodeSelect } from "@/lib/actions/model-codes"
import { listAllActiveProductCategoriesForSelect } from "@/lib/actions/product-categories"
import { ModelCodeForm } from "../_components/model-code-form"

type SearchParams = Promise<{ brandId?: string }>

export default async function NewModelCodePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const companyId = session.user.companyId
  if (!companyId) redirect("/login")

  // S-1: 一般ユーザーからは到達不可。MASTER_ADMIN のみが移行期の保険として手動発番を行える。
  // 通常運用では Product 作成 (/products/new) の「新規モデルコードを発番する」モードを使う。
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { tenantType: true },
  })
  if (company?.tenantType !== "MASTER_ADMIN") {
    notFound()
  }

  const sp = await searchParams
  const [brands, categories] = await Promise.all([
    listActiveBrandsForModelCodeSelect(),
    listAllActiveProductCategoriesForSelect(),
  ])

  const initialBrandId =
    sp.brandId && brands.some((b) => b.id === sp.brandId)
      ? sp.brandId
      : undefined

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/model-codes">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          型番 新規作成（管理者）
        </h1>
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              通常運用では、品番カルテ（
              <Link href="/products/new" className="underline font-medium">
                /products/new
              </Link>
              ）の「新規モデルコードを発番する」モードから自動採番してください。
              本ページは移行期の保険として MASTER_ADMIN のみがアクセスできます。
            </div>
          </div>
        </div>
      </div>
      <ModelCodeForm
        mode="create"
        brands={brands}
        categories={categories}
        defaultValues={initialBrandId ? { brandId: initialBrandId } : undefined}
      />
    </div>
  )
}
