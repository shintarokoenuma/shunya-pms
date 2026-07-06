import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { listRoughEstimatesForCompany } from "@/lib/actions/rough-estimates"
import { QuotationsList } from "./_components/quotations-list"

export default async function QuotationsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const rows = await listRoughEstimatesForCompany()

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">見積もり</h1>
        <p className="text-sm text-muted-foreground">
          会社全体の概算量産見積（QE-1R）。複数選択して見積書PDFにまとめて出力できます。
        </p>
      </div>

      <QuotationsList rows={rows} />
    </div>
  )
}
