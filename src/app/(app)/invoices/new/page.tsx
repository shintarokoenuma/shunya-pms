import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  getInvoice,
  getInvoiceCandidates,
  listActiveClientsForInvoiceSelect,
} from "@/lib/actions/invoices"
import { defaultPaymentDueDate } from "@/lib/calc/invoice-period"
import { InvoiceForm, type InvoiceFormInitial } from "../_components/invoice-form"

type SearchParams = Promise<{ replaces?: string }>

/**
 * addendum v0.9 §2-2: 新規作成。
 * `?replaces=<id>` は再発行: 取消した請求書のクライアント・期間で開き、候補（取消で戻った明細）を先に読む。
 */
export default async function NewInvoicePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sp = await searchParams
  const clients = await listActiveClientsForInvoiceSelect()

  let initial: InvoiceFormInitial | null = null
  if (sp.replaces) {
    const orig = await getInvoice(sp.replaces)
    if (orig.ok && orig.data.status === "CANCELLED") {
      const client = clients.find((c) => c.id === orig.data.clientId)
      const candidates = await getInvoiceCandidates({
        clientId: orig.data.clientId,
        periodStart: orig.data.periodStart,
        periodEnd: orig.data.periodEnd,
      })
      initial = {
        clientId: orig.data.clientId,
        periodStart: orig.data.periodStart,
        periodEnd: orig.data.periodEnd,
        paymentDueDate: defaultPaymentDueDate(
          orig.data.periodEnd,
          client?.paymentMonthOffset ?? null,
          client?.paymentDay ?? null,
        ),
        replacesInvoiceId: orig.data.id,
        replacesInvoiceNumber: orig.data.invoiceNumber,
        candidates: candidates.ok ? candidates.data : null,
      }
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/invoices">
            <ChevronLeft className="mr-1 h-4 w-4" />
            請求一覧へ
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">請求書 新規作成</h1>
        <p className="text-sm text-muted-foreground">
          クライアントと期間を選び、候補の明細を確認して保存します。番号は保存時に確定します。
        </p>
      </div>
      <InvoiceForm clients={clients} initial={initial} />
    </div>
  )
}
