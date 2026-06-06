import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { getProduct } from "@/lib/actions/products"
import {
  getSampleProduction,
} from "@/lib/actions/sample-productions"
import { listAssignableUsers } from "@/lib/actions/clients"
import { SampleProductionForm } from "../_components/sample-production-form"
import { SAMPLE_ROUND_LABELS } from "../_components/labels"

type SearchParams = Promise<{ productId?: string; parentSampleId?: string }>

export default async function NewSampleProductionPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams

  // 親サンプル指定（修正サンプル作成）の場合は、親から productId を確定する
  let parentSampleId: string | undefined
  let parentLabel: string | undefined
  let productId = sp.productId

  if (sp.parentSampleId) {
    const parent = await getSampleProduction(sp.parentSampleId)
    if (!parent.ok) redirect("/samples")
    if (parent.data.deletedAt) redirect(`/samples/${parent.data.id}`)
    parentSampleId = parent.data.id
    productId = parent.data.productId
    parentLabel = `${SAMPLE_ROUND_LABELS[parent.data.sampleRound]} ${parent.data.sampleNumber}`
  }

  if (!productId) {
    // productId が無ければ作成できない（品番カルテ起点で作る運用）
    redirect("/products")
  }

  const [productResult, users] = await Promise.all([
    getProduct(productId),
    listAssignableUsers(),
  ])
  if (!productResult.ok) {
    redirect("/products")
  }
  const product = productResult.data

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/products/${product.id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            品番カルテに戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          {parentSampleId ? "修正サンプル作成" : "サンプル新規作成"}
        </h1>
      </div>
      <SampleProductionForm
        mode="create"
        product={{
          id: product.id,
          productCode: product.productCode,
          clientProductCode: product.clientProductCode,
          productName: product.productName,
        }}
        parentSampleId={parentSampleId}
        parentLabel={parentLabel}
        users={users}
      />
    </div>
  )
}
