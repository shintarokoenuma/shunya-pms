import Link from "next/link"
import { redirect } from "next/navigation"
import { FileInput } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { listSupplierInvoices } from "@/lib/actions/supplier-invoices"
import { SupplierInvoicesSearch } from "./_components/supplier-invoices-search"
import { SupplierInvoicesTable } from "./_components/supplier-invoices-table"
import { SupplierInvoicesPagination } from "./_components/supplier-invoices-pagination"

type SearchParams = Promise<{ month?: string; counterpart?: string; posting?: string; attention?: string; page?: string }>

/** B-212 PR-1（P1-D8）: 仕入請求書の一覧。手本は /payments */
export default async function SupplierInvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const sp = await searchParams
  const result = await listSupplierInvoices({
    periodMonth: sp.month || undefined,
    counterpart: sp.counterpart || undefined,
    posting: sp.posting === "COUNTED" || sp.posting === "REFERENCE" ? sp.posting : undefined,
    attention: sp.attention === "1",
    page: sp.page ? Number(sp.page) : 1,
  })
  if (!result.ok) {
    return <div className="p-6"><p className="text-sm text-destructive">{result.error}</p></div>
  }
  const d = result.data
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">仕入請求書</h1>
          <p className="text-sm text-muted-foreground">
            仕入先・工場・外注先から受け取った請求書（SIV）。B-070 の月次 CSV を取り込み、明細を品番に当てます。
            参照の書類（単票）は内訳の追跡用で、合計には入りません。
          </p>
        </div>
        <Button asChild>
          <Link href="/supplier-invoices/import"><FileInput className="mr-1 h-4 w-4" />CSV を取り込む</Link>
        </Button>
      </div>
      <SupplierInvoicesSearch periodMonths={d.periodMonths} counterparts={d.counterpartOptions} />
      <div className="min-w-0">
        <SupplierInvoicesTable items={d.items} totals={d.totals} />
      </div>
      <SupplierInvoicesPagination page={d.page} totalPages={d.totalPages} total={d.count} />
    </div>
  )
}
