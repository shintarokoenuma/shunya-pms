import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSupplierInvoice, getSupplierInvoiceOptions } from "@/lib/actions/supplier-invoices"
import { SupplierInvoiceDetailEditor } from "../_components/supplier-invoice-detail-editor"
import { SupplierInvoiceCancelDialog } from "../_components/supplier-invoice-cancel-dialog"
import { COUNTERPART_TYPE_LABELS, POSTING_TYPE_LABELS, fmtAmount, fmtYmdSlash } from "../_components/labels"

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-x-3 py-1 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  )
}

/** B-212 PR-1（P1-D8）: 仕入請求書の詳細。ヘッダ・明細（当て方を直せる）・取消 */
export default async function SupplierInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const { id } = await params
  const [r, o] = await Promise.all([getSupplierInvoice(id), getSupplierInvoiceOptions()])
  if (!r.ok) {
    if (r.error === "書類が見つかりません") notFound()
    return <div className="p-6"><p className="text-sm text-destructive">{r.error}</p></div>
  }
  if (!o.ok) return <div className="p-6"><p className="text-sm text-destructive">{o.error}</p></div>
  const d = r.data
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/supplier-invoices"><ChevronLeft className="mr-1 h-4 w-4" />一覧に戻る</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{d.invoiceNumber}</h1>
            <Badge variant={d.postingType === "COUNTED" ? "secondary" : "outline"}>{POSTING_TYPE_LABELS[d.postingType]}</Badge>
            {d.currency !== "JPY" ? <Badge variant="outline">{d.currency}・円は未確定</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">{d.counterpartName}　{d.documentType}　{d.documentNumber}　月度 {d.periodMonth}</p>
        </div>
        <SupplierInvoiceCancelDialog id={d.id} invoiceNumber={d.invoiceNumber} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">書類</CardTitle></CardHeader>
        <CardContent>
          <dl>
            <Row label="相手先" value={<>{COUNTERPART_TYPE_LABELS[d.counterpartType as keyof typeof COUNTERPART_TYPE_LABELS] ?? d.counterpartType}　{d.counterpartName}{d.counterpartId ? null : <span className="ml-1 text-xs text-muted-foreground">（マスター未当て）</span>}</>} />
            <Row label="読み取った社名" value={<>{d.counterpartNameRaw}{d.counterpartCodeRaw ? `（コード ${d.counterpartCodeRaw}）` : ""}{d.counterpartCategoryRaw ? `　区分 ${d.counterpartCategoryRaw}` : ""}</>} />
            <Row label="登録番号" value={d.registrationNumber ?? "—"} />
            <Row label="書類" value={<>{d.documentType}　<span className="font-mono">{d.documentNumber}</span></>} />
            <Row label="月度" value={d.periodMonth} />
            <Row label="発行日 / 締め日 / 支払期日" value={`${fmtYmdSlash(d.issueDate)} / ${fmtYmdSlash(d.closingDate)} / ${fmtYmdSlash(d.dueDate)}`} />
            <Row label="税抜 / 消費税 / 税込" value={<span className="tabular-nums">{fmtAmount(d.subtotal, d.currency)} / {fmtAmount(d.taxAmount, d.currency)} / <span className="font-medium">{fmtAmount(d.totalAmount, d.currency)}</span>{d.currency !== "JPY" ? <span className="ml-1 text-xs text-muted-foreground">（円は未確定・支払の段で入れる）</span> : null}</span>} />
            {d.postingType === "REFERENCE" ? (
              <Row label="対の書類" value={d.pairedInvoice ? <Link href={`/supplier-invoices/${d.pairedInvoice.id}`} className="text-primary hover:underline">{d.pairedInvoice.invoiceNumber}（{d.pairedDocumentNumber}）</Link> : (d.pairedDocumentNumber ?? "—")} />
            ) : d.referencedBy.length > 0 ? (
              <Row label="参照の書類" value={<span className="flex flex-wrap gap-2">{d.referencedBy.map((x) => <Link key={x.id} href={`/supplier-invoices/${x.id}`} className="text-primary hover:underline">{x.invoiceNumber}（{x.documentNumber}）</Link>)}</span>} />
            ) : null}
            <Row label="原本" value={<>{d.sourceFileName ?? "—"}{d.importFileName ? <span className="ml-2 text-xs text-muted-foreground">取り込み元 {d.importFileName}</span> : null}</>} />
            <Row label="明細の当て方" value={<span className="tabular-nums">一致 {d.counts.matched}・要確認 {d.counts.pending}・未一致 {d.counts.unmatched}・品番なし {d.counts.noProduct}</span>} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">明細</CardTitle></CardHeader>
        <CardContent>
          <SupplierInvoiceDetailEditor detail={d} options={o.data} />
        </CardContent>
      </Card>
    </div>
  )
}
