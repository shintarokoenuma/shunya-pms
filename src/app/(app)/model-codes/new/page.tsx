import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { listActiveBrandsForModelCodeSelect } from "@/lib/actions/model-codes"
import { ModelCodeForm } from "../_components/model-code-form"

type SearchParams = Promise<{ brandId?: string }>

export default async function NewModelCodePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const brands = await listActiveBrandsForModelCodeSelect()

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
        <h1 className="text-2xl font-semibold tracking-tight">型番 新規作成</h1>
      </div>
      <ModelCodeForm
        mode="create"
        brands={brands}
        defaultValues={initialBrandId ? { brandId: initialBrandId } : undefined}
      />
    </div>
  )
}
