import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { listRoughEstimatesForCompany } from "@/lib/actions/rough-estimates"
import { listProductionEstimatesForCompany } from "@/lib/actions/production-estimates"
import { QuotationsList } from "./_components/quotations-list"
import { ProductionEstimatesList } from "./_components/production-estimates-list"

export default async function QuotationsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const [roughRows, productionRows] = await Promise.all([
    listRoughEstimatesForCompany(),
    listProductionEstimatesForCompany(),
  ])

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">見積もり</h1>
        <p className="text-sm text-muted-foreground">
          概算量産見積（QE-1R）と量産見積。概算は複数選択して見積書PDFにまとめて出力できます。
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">概算見積（QE-1R）</h2>
        <QuotationsList rows={roughRows} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">量産見積</h2>
        <ProductionEstimatesList rows={productionRows} />
      </section>
    </div>
  )
}
