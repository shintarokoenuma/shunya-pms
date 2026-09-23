"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import type { TaxClassification } from "@prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createInvoice,
  getInvoiceCandidates,
  type InvoiceCandidatesResult,
  type InvoiceClientOption,
} from "@/lib/actions/invoices"
import { computeInvoiceAmounts } from "@/lib/calc/invoice-amounts"
import {
  defaultInvoicePeriod,
  defaultPaymentDueDate,
} from "@/lib/calc/invoice-period"
import { InvoiceAmountsBlock } from "./invoice-amounts-block"
import { INVOICE_ITEM_TAX_OPTIONS, fmtYen, fmtYmd } from "./labels"

/** 再発行（取消した請求書から）や URL 指定の初期値。候補はサーバ側で読んで渡す。 */
export type InvoiceFormInitial = {
  clientId: string
  periodStart: string
  periodEnd: string
  paymentDueDate: string
  replacesInvoiceId: string | null
  replacesInvoiceNumber: string | null
  candidates: InvoiceCandidatesResult | null
}

type RowTax = TaxClassification

/**
 * addendum v0.9 §2-2: 新規作成。
 * - クライアント → 期間（締め日から自動・直せる）→ 候補の明細（既定は全部チェック）→ 保存（ドラフト）。
 * - 候補は選び直すたびにサーバから読む（useEffect ではなく操作のハンドラで読む）。
 * - 金額の8行は選んだ行からその場で計算する（純関数・サーバの計算と同じ関数）。
 */
export function InvoiceForm({
  clients,
  initial = null,
}: {
  clients: InvoiceClientOption[]
  initial?: InvoiceFormInitial | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isLoading, startLoading] = useTransition()

  const [clientId, setClientId] = useState(initial?.clientId ?? "")
  const [periodStart, setPeriodStart] = useState(initial?.periodStart ?? "")
  const [periodEnd, setPeriodEnd] = useState(initial?.periodEnd ?? "")
  const [paymentDueDate, setPaymentDueDate] = useState(initial?.paymentDueDate ?? "")
  const [previousBalanceInput, setPreviousBalanceInput] = useState("0")
  const [ctx, setCtx] = useState<InvoiceCandidatesResult | null>(initial?.candidates ?? null)
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((initial?.candidates?.candidates ?? []).map((c) => [c.deliveryNoteItemId, true])),
  )
  const [taxByRow, setTaxByRow] = useState<Record<string, RowTax>>({})

  const client = clients.find((c) => c.id === clientId) ?? null

  const load = (nextClientId: string, start: string, end: string) => {
    if (!nextClientId || !start || !end) return
    startLoading(async () => {
      const r = await getInvoiceCandidates({ clientId: nextClientId, periodStart: start, periodEnd: end })
      if (!r.ok) {
        toast.error(r.error)
        setCtx(null)
        return
      }
      setCtx(r.data)
      // 既定は全部チェック済み（v0.9 §2-2）。税区分は 10% に戻す
      setChecked(Object.fromEntries(r.data.candidates.map((c) => [c.deliveryNoteItemId, true])))
      setTaxByRow({})
    })
  }

  const handleClientChange = (id: string) => {
    setClientId(id)
    const c = clients.find((x) => x.id === id)
    const period = defaultInvoicePeriod(c?.closingDay ?? null)
    const due = defaultPaymentDueDate(period.end, c?.paymentMonthOffset ?? null, c?.paymentDay ?? null)
    setPeriodStart(period.start)
    setPeriodEnd(period.end)
    setPaymentDueDate(due)
    load(id, period.start, period.end)
  }

  const handlePeriodStart = (v: string) => {
    setPeriodStart(v)
    load(clientId, v, periodEnd)
  }
  const handlePeriodEnd = (v: string) => {
    setPeriodEnd(v)
    if (client) {
      setPaymentDueDate(defaultPaymentDueDate(v, client.paymentMonthOffset, client.paymentDay))
    }
    load(clientId, periodStart, v)
  }

  const candidates = ctx?.candidates ?? []
  const pickedRows = candidates.filter((c) => checked[c.deliveryNoteItemId])
  const taxOf = (id: string): RowTax => taxByRow[id] ?? "STANDARD_10"
  const previousBalance = ctx?.previousInvoice
    ? ctx.previousInvoice.totalAmount
    : Number(previousBalanceInput || 0)
  const amounts = ctx
    ? computeInvoiceAmounts(
        pickedRows.map((c) => ({ subtotal: c.subtotal, taxClassification: taxOf(c.deliveryNoteItemId) })),
        ctx.taxRoundingMode,
        Number.isFinite(previousBalance) ? previousBalance : 0,
        ctx.paymentReceivedAmount,
      )
    : null
  const showReduced8 = pickedRows.some((c) => taxOf(c.deliveryNoteItemId) === "REDUCED_8")

  const onSubmit = () => {
    if (!clientId) {
      toast.error("クライアントを選択してください")
      return
    }
    if (!ctx) {
      toast.error("候補を読み込んでから保存してください")
      return
    }
    startTransition(async () => {
      const r = await createInvoice({
        clientId,
        periodStart,
        periodEnd,
        paymentDueDate,
        previousBalanceAmount: ctx.previousInvoice ? null : previousBalanceInput,
        replacesInvoiceId: initial?.replacesInvoiceId ?? null,
        items: pickedRows.map((c) => ({
          deliveryNoteItemId: c.deliveryNoteItemId,
          taxClassification: taxOf(c.deliveryNoteItemId),
        })),
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`請求書 ${r.data.invoiceNumber} を作成しました（ドラフト）`)
      router.push(`/invoices/${r.data.id}`)
    })
  }

  const closingLabel =
    client?.closingDay == null || client.closingDay >= 31 ? "月末締め" : `${client.closingDay}日締め`

  return (
    <div className="space-y-6">
      {initial?.replacesInvoiceId && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {initial.replacesInvoiceNumber ?? "取消した請求書"} の再発行です。保存すると新しい番号で作り、元の請求書への参照を持ちます（修正インボイス）。
        </div>
      )}

      {/* 上段: クライアント / 期間 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>クライアント *</Label>
          <Select value={clientId} onValueChange={handleClientChange} disabled={!!initial?.replacesInvoiceId}>
            <SelectTrigger>
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.clientCode} {c.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>期間（締め日から自動・直せる）</Label>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={periodStart}
              onChange={(e) => handlePeriodStart(e.target.value)}
              className="w-[170px]"
              disabled={!clientId}
            />
            <span className="text-muted-foreground">〜</span>
            <Input
              type="date"
              value={periodEnd}
              onChange={(e) => handlePeriodEnd(e.target.value)}
              className="w-[170px]"
              disabled={!clientId}
            />
            {client && (
              <span className="text-xs text-muted-foreground">{closingLabel}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            月末締め（締め日 31）なら 9/1〜9/30、20日締めなら 8/21〜9/20 が既定
          </p>
        </div>
        <div className="space-y-2">
          <Label>支払期日</Label>
          <Input
            type="date"
            value={paymentDueDate}
            onChange={(e) => setPaymentDueDate(e.target.value)}
            className="w-[170px]"
            disabled={!clientId}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        {/* 候補の明細。★min-w-0: グリッドの子は既定で中身より縮まないため、
            これが無いと表の最小幅がページ全体を横に押し広げる（overflow-x-auto が効かない） */}
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              候補の明細（{candidates.length}件）
              {isLoading && <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-muted-foreground" />}
            </p>
            {candidates.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {pickedRows.length} 件を選択中
              </span>
            )}
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[36px]" />
                  <TableHead className="w-[130px]">納品書</TableHead>
                  <TableHead className="w-[100px]">納品日</TableHead>
                  <TableHead>品番 / 品名</TableHead>
                  <TableHead className="w-[140px]">色・サイズ</TableHead>
                  <TableHead className="w-[70px] text-right">数量</TableHead>
                  <TableHead className="w-[100px] text-right">単価</TableHead>
                  <TableHead className="w-[110px] text-right">金額</TableHead>
                  <TableHead className="w-[110px]">税区分</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!clientId ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      クライアントを選ぶと候補が出ます
                    </TableCell>
                  </TableRow>
                ) : candidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      この期間に請求できる明細がありません（納品完了以降の納品書が対象です）
                    </TableCell>
                  </TableRow>
                ) : (
                  candidates.map((c) => {
                    const id = c.deliveryNoteItemId
                    const isRed = c.quantity < 0
                    const tax = taxOf(id)
                    return (
                      <TableRow key={id} className={isRed ? "bg-red-50/70" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={!!checked[id]}
                            onCheckedChange={(v) =>
                              setChecked((prev) => ({ ...prev, [id]: v === true }))
                            }
                            aria-label="この明細を請求に含める"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{c.deliveryNumber}</TableCell>
                        <TableCell className="text-sm tabular-nums">{fmtYmd(c.deliveryDate)}</TableCell>
                        <TableCell className="text-sm">
                          <span className="font-mono text-xs text-muted-foreground">
                            {c.clientProductCode ?? c.productCode ?? "—"}
                          </span>{" "}
                          {c.productName}
                          {c.unitPrice == null && (
                            <Badge variant="outline" className="ml-2 text-red-700">
                              単価なし
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {[c.colorName ?? c.colorCode, c.size].filter(Boolean).join(" / ") || "—"}
                        </TableCell>
                        <TableCell className={`text-right text-sm tabular-nums ${isRed ? "text-red-700" : ""}`}>
                          {c.quantity.toLocaleString("ja-JP")}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {c.unitPrice == null ? "—" : fmtYen(c.unitPrice)}
                        </TableCell>
                        <TableCell className={`text-right text-sm tabular-nums ${c.subtotal < 0 ? "text-red-700" : ""}`}>
                          {fmtYen(c.subtotal)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Select
                              value={tax}
                              onValueChange={(v) =>
                                setTaxByRow((prev) => ({ ...prev, [id]: v as RowTax }))
                              }
                            >
                              <SelectTrigger className="h-7 w-[92px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {INVOICE_ITEM_TAX_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {tax === "NON_TAXABLE" && <Badge variant="secondary">非課税</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            取消されていない請求書に既に載っている明細は候補に出ません
          </p>
        </div>

        {/* 右カラム: 金額 */}
        <div className="space-y-4 rounded-md border p-4">
          <p className="text-sm font-medium">金額</p>
          <div className="space-y-2">
            <Label className="text-xs">前回御請求額（このクライアントの最初の請求書だけ入力）</Label>
            {ctx?.previousInvoice ? (
              <div className="text-sm">
                <span className="tabular-nums">{fmtYen(ctx.previousInvoice.totalAmount)}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  直前の請求書 {ctx.previousInvoice.invoiceNumber}（{fmtYmd(ctx.previousInvoice.invoiceDate)}）の今回御請求額
                </span>
              </div>
            ) : (
              <Input
                type="number"
                step="1"
                value={previousBalanceInput}
                onChange={(e) => setPreviousBalanceInput(e.target.value)}
                className="w-[180px]"
                disabled={!clientId}
              />
            )}
            <p className="text-xs text-muted-foreground">
              2枚目からは直前の請求書の「今回御請求額」が自動で入り、読み取り専用になります。KKAP+ から移るときは最初の1枚だけ人が入れます
            </p>
          </div>
          {amounts ? (
            <InvoiceAmountsBlock amounts={amounts} showReduced8={showReduced8} />
          ) : (
            <p className="text-sm text-muted-foreground">クライアントを選ぶと金額が出ます</p>
          )}
          {ctx &&
            (ctx.paymentWindow.start <= ctx.paymentWindow.end ? (
              <p className="text-xs text-muted-foreground">
                御入金額は {fmtYmd(ctx.paymentWindow.start)}〜{fmtYmd(ctx.paymentWindow.end)} に記録された入金の合計です
              </p>
            ) : (
              // 直前の請求書の締め日が今回の締め日以降だと窓が逆転する（同じ期間で2枚目を作ろうとした等）
              <p className="text-xs text-muted-foreground">
                直前の請求書（{ctx.previousInvoice?.invoiceNumber}）の締め日が今回の締め日以降のため、この期間に入る入金はありません
              </p>
            ))}
          <p className="text-xs text-muted-foreground">
            消費税は請求書1枚につき税率ごとに1回だけ計算します
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={onSubmit} disabled={isPending || isLoading || !clientId || !ctx}>
          {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          保存（ドラフト）
        </Button>
        <Button asChild variant="outline">
          <Link href="/invoices">戻る</Link>
        </Button>
      </div>
    </div>
  )
}
