import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import type { InvoiceStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { listInvoices, listActiveClientsForInvoiceSelect } from "@/lib/actions/invoices"
import { InvoicesSearch } from "./_components/invoices-search"
import { InvoicesTable } from "./_components/invoices-table"
import { InvoicesPagination } from "./_components/invoices-pagination"

type SearchParams = Promise<{
  status?: string
  clientId?: string
  page?: string
}>

/** addendum v0.9 §2-1: 請求 一覧 */
export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const page = sp.page ? Number(sp.page) : 1

  const [result, clients] = await Promise.all([
    listInvoices({
      q: "",
      status: sp.status as InvoiceStatus | undefined,
      clientId: sp.clientId || undefined,
      page,
      pageSize: 20,
    }),
    listActiveClientsForInvoiceSelect(),
  ])

  if (!result.ok) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    )
  }
  const { items, total, totalPages, page: currentPage } = result.data

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">請求</h1>
          <p className="text-sm text-muted-foreground">
            合計請求書（INV）。納品完了した納品書の明細を期間でまとめ、繰越と入金を載せて請求します。
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/invoices/new">
            <Plus className="mr-1 h-4 w-4" />
            新規作成
          </Link>
        </Button>
      </div>
      <InvoicesSearch clients={clients.map((c) => ({ id: c.id, companyName: c.companyName }))} />
      <InvoicesTable items={items} />
      <InvoicesPagination page={currentPage} totalPages={totalPages} total={total} />
    </div>
  )
}
