import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getProductionEstimate } from "@/lib/actions/production-estimates"
import { getDefaultMarginRateForProduct } from "@/lib/actions/rough-estimates"
import { getNavRefs } from "@/lib/actions/nav-refs"
import { buildDocBreadcrumb } from "@/lib/nav/breadcrumb"
import { EntityBreadcrumb } from "../../../_components/entity-breadcrumb"
import { ProductionEstimateForm } from "../../_components/production-estimate-form"

type Params = Promise<{ id: string }>

export default async function ProductionEstimateEditPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const result = await getProductionEstimate(id)
  if (!result.ok) notFound()
  const pe = result.data

  const [nav, marginDefault] = await Promise.all([
    getNavRefs(pe.productId, pe.sourceSampleProductionId),
    getDefaultMarginRateForProduct(pe.productId),
  ])
  const brandDefaultMarginRate = marginDefault.ok
    ? marginDefault.data.marginRate
    : null

  const crumbs = buildDocBreadcrumb({
    product: nav.product,
    sample: nav.sample,
    currentLabel: `${pe.estimateNumber}（編集）`,
    listLabel: "量産見積",
    listHref: `/products/${pe.productId}`,
  })

  return (
    <div className="space-y-6 p-6">
      <EntityBreadcrumb segments={crumbs} />
      <ProductionEstimateForm
        estimate={pe}
        brandDefaultMarginRate={brandDefaultMarginRate}
      />
    </div>
  )
}
