import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { getProductionOrderGenerationContext } from "@/lib/actions/production-estimates"
import { ProductionOrderGenerateForm } from "../../_components/production-order-generate-form"

type Params = Promise<{ id: string }>

export default async function GenerateProductionOrdersPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const result = await getProductionOrderGenerationContext(id)
  if (!result.ok) notFound()
  const ctx = result.data

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/production-estimates/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            量産見積に戻る
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">量産発注を生成</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono">{ctx.pe.estimateNumber}</span> ・{" "}
          <span className="font-mono">{ctx.pe.productCode}</span>
          {" "}を種に、仕入先別 PO・相手先別 WO の下書き（DRAFT）を生成します。
        </p>
      </div>
      <ProductionOrderGenerateForm ctx={ctx} />
    </div>
  )
}
