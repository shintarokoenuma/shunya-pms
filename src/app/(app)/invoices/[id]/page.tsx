import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getInvoice } from "@/lib/actions/invoices"
import { formatPeriod } from "@/lib/calc/invoice-period"
import { InvoiceStatusActions } from "../_components/invoice-status-actions"
import { InvoiceAmountsBlock } from "../_components/invoice-amounts-block"
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_BADGE_VARIANT,
  TAX_CLASSIFICATION_LABELS,
  PAYMENT_METHOD_LABELS,
  fmtYen,
  fmtYmd,
} from "../_components/labels"

type Params = Promise<{ id: string }>

/** addendum v0.9 §2-3: 詳細（★PDF ボタンは PR-4） */
export default async function InvoiceDetailPage({ params }: { params: Params }) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const result = await getInvoice(id)
  if (!result.ok) notFound()
  const inv = result.data
  const showReduced8 = inv.taxableAmount8 != null && inv.taxableAmount8 !== 0

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/invoices">
            <ChevronLeft className="mr-1 h-4 w-4" />
            請求一覧へ
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold tracking-tight">{inv.invoiceNumber}</h1>
              <Badge variant={INVOICE_STATUS_BADGE_VARIANT[inv.status]}>
                {INVOICE_STATUS_LABELS[inv.status]}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-6 text-sm text-muted-foreground">
              <span>{inv.clientName ?? "（クライアント未設定）"}</span>
              <span className="tabular-nums">{formatPeriod(inv.periodStart, inv.periodEnd)}</span>
              <span className="tabular-nums">支払期日 {fmtYmd(inv.paymentDueDate)}</span>
            </div>
            {inv.replacesInvoiceNumber && (
              <div className="mt-1 text-xs text-muted-foreground">
                再発行元:{" "}
                <Link href={`/invoices/${inv.replacesInvoiceId}`} className="font-mono underline">
                  {inv.replacesInvoiceNumber}
                </Link>
              </div>
            )}
          </div>
          <InvoiceStatusActions
            id={inv.id}
            invoiceNumber={inv.invoiceNumber}
            status={inv.status}
            replacedByInvoiceId={inv.replacedByInvoiceId}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">明細</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">納品日</TableHead>
                  <TableHead>品番 / 品名</TableHead>
                  <TableHead className="w-[140px]">色・サイズ</TableHead>
                  <TableHead className="w-[80px]">税区分</TableHead>
                  <TableHead className="w-[70px] text-right">数量</TableHead>
                  <TableHead className="w-[100px] text-right">単価</TableHead>
                  <TableHead className="w-[110px] text-right">金額</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inv.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      当月の明細はありません（繰越だけの請求書）
                    </TableCell>
                  </TableRow>
                ) : (
                  inv.items.map((it) => {
                    const isRed = it.quantity < 0
                    return (
                      <TableRow key={it.id} className={isRed ? "bg-red-50/70" : undefined}>
                        <TableCell className="text-sm tabular-nums">
                          {fmtYmd(it.deliveryDate)}
                          {it.deliveryNumber && (
                            <div className="font-mono text-[10px] text-muted-foreground">{it.deliveryNumber}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="font-mono text-xs text-muted-foreground">{it.itemCode ?? "—"}</span>{" "}
                          {it.itemName}
                        </TableCell>
                        <TableCell className="text-sm">
                          {[it.colorName, it.size].filter(Boolean).join(" / ") || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {it.taxClassification === "STANDARD_10" ? (
                            TAX_CLASSIFICATION_LABELS[it.taxClassification]
                          ) : (
                            <Badge variant="secondary">{TAX_CLASSIFICATION_LABELS[it.taxClassification]}</Badge>
                          )}
                        </TableCell>
                        <TableCell className={`text-right text-sm tabular-nums ${isRed ? "text-red-700" : ""}`}>
                          {it.quantity.toLocaleString("ja-JP")}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{fmtYen(it.unitPrice)}</TableCell>
                        <TableCell className={`text-right text-sm tabular-nums ${it.subtotal < 0 ? "text-red-700" : ""}`}>
                          {fmtYen(it.subtotal)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">御入金（この期間）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">入金日</TableHead>
                    <TableHead className="w-[120px]">方法</TableHead>
                    <TableHead>摘要</TableHead>
                    <TableHead className="w-[120px] text-right">金額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inv.payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                        この期間の入金はありません
                      </TableCell>
                    </TableRow>
                  ) : (
                    inv.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm tabular-nums">{fmtYmd(p.paymentDate)}</TableCell>
                        <TableCell className="text-sm">{PAYMENT_METHOD_LABELS[p.paymentMethod]}</TableCell>
                        <TableCell className="text-sm">{p.description ?? "—"}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{fmtYen(p.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              前回の締め日の翌日〜今回の締め日に記録された入金が入ります。請求書の御入金額は作成時の合計を保持します
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">金額</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InvoiceAmountsBlock
              amounts={{
                previousBalanceAmount: inv.previousBalanceAmount,
                paymentReceivedAmount: inv.paymentReceivedAmount,
                carriedForwardAmount: inv.carriedForwardAmount,
                taxableAmount10: inv.taxableAmount10,
                taxableAmount8: inv.taxableAmount8 ?? 0,
                nonTaxableAmount: inv.nonTaxableAmount,
                subtotal: inv.subtotal,
                totalTaxAmount: inv.totalTaxAmount,
                totalAmount: inv.totalAmount,
              }}
              showReduced8={showReduced8}
            />
            <p className="text-xs text-muted-foreground">
              送付済みにしたら書き換えません。誤りは取消 → 新しい番号で再発行し、再発行側に元の請求書への参照を持ちます（修正インボイス）。取消すと載っていた明細は候補に戻ります
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
