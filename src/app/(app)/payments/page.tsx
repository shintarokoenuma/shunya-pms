import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { listPayments } from "@/lib/actions/payments"
import { listActiveClientsForInvoiceSelect } from "@/lib/actions/invoices"
import { closingDateOf } from "@/lib/calc/invoice-period"
import { PaymentRecordDialog } from "../clients/_components/payment-record-dialog"
import { PaymentsSearch } from "./_components/payments-search"
import { PaymentsTable } from "./_components/payments-table"
import { PaymentsPagination } from "./_components/payments-pagination"

type SearchParams = Promise<{
  clientId?: string
  start?: string
  end?: string
  period?: string
  page?: string
}>

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** D-42: 期間の既定は今月（1日〜末日）。start / end が1つでもあればその範囲、period=all なら全期間。 */
function resolvePeriod(sp: { start?: string; end?: string; period?: string }): {
  start: string
  end: string
  label: string
} {
  const start = sp.start && YMD.test(sp.start) ? sp.start : ""
  const end = sp.end && YMD.test(sp.end) ? sp.end : ""
  if (start || end) {
    return { start, end, label: `${start || "（指定なし）"} 〜 ${end || "（指定なし）"} の入金` }
  }
  if (sp.period === "all") {
    return { start: "", end: "", label: "すべての期間の入金" }
  }
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  const monthStart = `${y}-${String(m + 1).padStart(2, "0")}-01`
  const monthEnd = closingDateOf(y, m, 31)
  return { start: monthStart, end: monthEnd, label: `${monthStart} 〜 ${monthEnd} の入金（今月）` }
}

/** B-222 PR-2d（D-38）: 入金の独立ページ。クライアント横断・期間・下に合計。 */
export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const page = sp.page ? Number(sp.page) : 1
  const period = resolvePeriod(sp)

  const [result, clients] = await Promise.all([
    listPayments({
      clientId: sp.clientId || undefined,
      start: period.start || undefined,
      end: period.end || undefined,
      page,
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
  const { items, total, count, totalPages, page: currentPage } = result.data
  const clientOptions = clients.map((c) => ({ id: c.id, companyName: c.companyName }))

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">入金</h1>
          <p className="text-sm text-muted-foreground">
            クライアントからの入金の記録（PAY）。次の合計請求書の「御入金額」と「繰越金額」に自動で入ります。
          </p>
          <p className="mt-1 text-sm font-medium tabular-nums">{period.label}</p>
        </div>
        <PaymentRecordDialog clients={clientOptions} />
      </div>
      <PaymentsSearch clients={clientOptions} start={period.start} end={period.end} />
      <div className="min-w-0">
        <PaymentsTable items={items} total={total} />
      </div>
      <PaymentsPagination page={currentPage} totalPages={totalPages} total={count} />
    </div>
  )
}
