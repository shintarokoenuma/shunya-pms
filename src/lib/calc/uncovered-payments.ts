import { addDaysYmd, toYmd } from "./invoice-period"

/**
 * B-223（D-39・D-50 v1.1）: 発行済みの請求書より後に、その請求書の期間内の日付で記録された入金は、
 * どの請求書にも現れない（発行済みは再計算しない・D-35。次の請求書の窓からも外れる）。
 * 請求書を作る画面で警告するために、その入金を拾う純関数。
 *
 * 判定（D-50 訂正後）: そのクライアントの入金 P のうち
 *   - P.paymentDate >= 今回の窓の始まり → 今回計上されるので対象外
 *   - P.paymentDate を窓に含む取消されていない請求書 I を探す（窓 = 前の請求書の periodEndDate + 1日 〜 自分の periodEndDate。
 *     最初の1枚の窓の始まりは、その請求書に保存された periodStartDate・D-41）
 *     ★ブリーフ §2-3 の「-infinity 相当」は採らない。-infinity だと最初の請求書より前の期間の入金が全部「その請求書の期間」に
 *       入ってしまい、v1.1 の D-50 訂正（請求書が無い期間の入金は対象外）と矛盾する。作成時に実際に集計した窓と同じ始まりを使う。
 *   - I が無い → 対象外（まだ請求していない期間の入金。初回の「前回御請求額」で人が扱う）
 *   - I があり I.createdAt < P.createdAt → 未計上（その請求書より後に記録された）
 *   - I があり I.createdAt >= P.createdAt → 計上済み
 * ★列は足さない（D-39）。createdAt の比較だけで判定する。
 */
export type UncoveredPaymentInput = {
  id: string
  paymentNumber: string
  /** yyyy-MM-dd */
  paymentDate: string
  amount: number
  /** ISO 8601 */
  createdAt: string
}

export type UncoveredInvoiceInput = {
  id: string
  invoiceNumber: string
  periodStartDate: Date
  periodEndDate: Date
  createdAt: Date
}

export type UncoveredPayment = {
  id: string
  paymentNumber: string
  paymentDate: string
  amount: number
  /** その入金日を窓に含む請求書（入金より先に作られていた） */
  invoiceNumber: string
}

type InvoiceWindow = { inv: UncoveredInvoiceInput; start: string; end: string }

/**
 * 取消されていない請求書から「御入金額を集計した窓」を組む（B-223 と B-225 で共用・窓の作り方はここ 1 か所）。
 * 窓は periodEndDate の昇順（同日なら createdAt の昇順）。最初の 1 枚の始まりは自分の periodStartDate（D-41）、
 * 2 枚目以降は前の請求書の periodEndDate + 1 日。
 */
function buildInvoiceWindows(invoicesNotCancelled: UncoveredInvoiceInput[]): InvoiceWindow[] {
  const invoices = [...invoicesNotCancelled].sort((a, b) => {
    const d = a.periodEndDate.getTime() - b.periodEndDate.getTime()
    return d !== 0 ? d : a.createdAt.getTime() - b.createdAt.getTime()
  })
  return invoices.map((inv, i) => ({
    inv,
    start: i === 0 ? toYmd(inv.periodStartDate) : addDaysYmd(toYmd(invoices[i - 1].periodEndDate), 1),
    end: toYmd(inv.periodEndDate),
  }))
}

export function findUncoveredPayments(
  payments: UncoveredPaymentInput[],
  invoicesNotCancelled: UncoveredInvoiceInput[],
  windowStart: string,
): UncoveredPayment[] {
  const windows = buildInvoiceWindows(invoicesNotCancelled)

  const out: UncoveredPayment[] = []
  for (const p of payments) {
    if (p.paymentDate >= windowStart) continue // 今回計上される
    const hit = windows.find((w) => p.paymentDate >= w.start && p.paymentDate <= w.end)
    if (!hit) continue // まだ請求していない期間の入金（対象外）
    if (hit.inv.createdAt.getTime() < new Date(p.createdAt).getTime()) {
      out.push({
        id: p.id,
        paymentNumber: p.paymentNumber,
        paymentDate: p.paymentDate,
        amount: p.amount,
        invoiceNumber: hit.inv.invoiceNumber,
      })
    }
  }
  return out
}

/**
 * B-225（D-3）: この入金を「御入金額」に含めている（取消されていない）請求書を返す。
 * 判定は B-223 の裏返し: 入金日を窓に含む請求書 I があり、I.createdAt >= P.createdAt（入金より後に作られた＝集計済み）。
 * 取消しても発行済みの請求書は再計算しない（D-35）ので、警告に使う。窓が重ならない前提で 0 か 1 件だが配列で返す。
 */
export function findInvoicesCoveringPayment(
  payment: { paymentDate: string; createdAt: string },
  invoicesNotCancelled: UncoveredInvoiceInput[],
): { id: string; invoiceNumber: string }[] {
  const windows = buildInvoiceWindows(invoicesNotCancelled)
  const paymentCreated = new Date(payment.createdAt).getTime()
  return windows
    .filter((w) => payment.paymentDate >= w.start && payment.paymentDate <= w.end)
    .filter((w) => w.inv.createdAt.getTime() >= paymentCreated)
    .map((w) => ({ id: w.inv.id, invoiceNumber: w.inv.invoiceNumber }))
}
