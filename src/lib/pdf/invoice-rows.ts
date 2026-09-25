/**
 * B-109 PR-4（P4-D7・P4-D8）: 請求書 PDF の明細の並べ方（純関数・prisma 非依存）。
 * - 納品の行（納品日）と入金の行（入金日）を日付順に1本の表にする。同じ日は入金を先に。日付が無い納品の行は末尾。
 * - 入金の行は、期間の窓の入金のうち「請求書より前に記録された」ものの合計が paymentReceivedAmount と一致するときだけ
 *   1件ずつ出す。一致しないとき（発行後に入金を取消した等・B-225）は1行「〔御入金〕期間内の入金合計」にまとめる。
 *   ★6枠と明細が食い違わないことを優先する（D-35: 発行済みは再計算しない）。
 * - 紙面の固定文言に ※ ～ は使わない（フォントに無い）。DB の値の ～（U+FF5E）は 〜（U+301C）に置き換える。
 */

export type InvoiceLineInput = {
  /** yyyy-MM-dd（納品書が無い行は null） */
  deliveryDate: string | null
  deliveryNumber: string | null
  itemCode: string | null
  itemName: string
  colorName: string | null
  size: string | null
  quantity: number
  unitPrice: number
  subtotal: number
}

export type InvoicePaymentInput = {
  paymentNumber: string
  /** yyyy-MM-dd */
  paymentDate: string
  /** 表示用の方法（「振込」など） */
  methodLabel: string
  amount: number
  /** ISO 8601 */
  createdAt: string
}

export type InvoicePdfRow =
  | {
      kind: "item"
      date: string | null
      docNumber: string | null
      /** P4-D21: 紙面は上段に品番・下段に品名（description は「品番　品名」の互換表記） */
      itemCode: string | null
      itemName: string
      description: string
      colorSize: string
      quantity: number
      unitPrice: number
      amount: number
    }
  | {
      kind: "payment"
      date: string | null
      docNumber: string | null
      description: string
      amount: number
    }

const PAYMENT_PREFIX = "〔御入金〕"

/**
 * B-109 PR-4（P4-D19）: 折り返しに「-」を入れない hyphenationCallback（請求書・納品書の Text だけに渡す）。
 * fonts.ts の全帳票共通の登録（1文字ずつ割る＝折り返し位置にハイフンが付く・B-208）は変えない。
 * 1文字ごとに空の部分を挟むと、textkit は空の部分を「幅 0 の glue」として扱い、そこで折り返すのでハイフンが付かない
 * （試し刷りで確認: 同じ文字列で "-" の glyph の出現が 5 → 3＝文字列中の実際の "-" だけになった）。
 */
export const NO_HYPHEN_BREAK = (word: string): string[] => Array.from(word).flatMap((c) => [c, ""])

/** B-109 PR-4（P4-D21）: 語を割らない＝その Text の中では折り返さない（品番に使う）。 */
export const NO_BREAK = (word: string): string[] => [word]

/** DB 由来の文字列を PDF 用に整える（フォントに無い ～ を 〜 に）。 */
export function pdfText(s: string | null | undefined): string {
  if (!s) return ""
  return s.replace(/～/g, "〜")
}

/** 納品の行の「品番　品名」「色・サイズ」表記。 */
function describeItem(l: InvoiceLineInput): { description: string; colorSize: string } {
  const description = [pdfText(l.itemCode), pdfText(l.itemName)].filter(Boolean).join("　")
  const colorSize = [pdfText(l.colorName), pdfText(l.size)].filter(Boolean).join("・")
  return { description, colorSize }
}

/**
 * P4-D8: 入金の行を決める。
 * @param payments 期間の窓の入金（取消されていないもの）
 * @param invoiceCreatedAt 請求書の作成日時（ISO）
 * @param paymentReceivedAmount 請求書に保存された御入金額
 */
export function buildPaymentRows(
  payments: InvoicePaymentInput[],
  invoiceCreatedAt: string,
  paymentReceivedAmount: number,
): InvoicePdfRow[] {
  const cutoff = new Date(invoiceCreatedAt).getTime()
  const before = payments.filter((p) => new Date(p.createdAt).getTime() <= cutoff)
  const sum = before.reduce((a, p) => a + p.amount, 0)
  if (sum === paymentReceivedAmount) {
    return before.map((p) => ({
      kind: "payment",
      date: p.paymentDate,
      docNumber: p.paymentNumber,
      description: `${PAYMENT_PREFIX}${p.methodLabel}`,
      amount: p.amount,
    }))
  }
  if (paymentReceivedAmount === 0) return []
  return [
    {
      kind: "payment",
      date: null,
      docNumber: null,
      description: `${PAYMENT_PREFIX}期間内の入金合計`,
      amount: paymentReceivedAmount,
    },
  ]
}

/** P4-D7: 納品の行と入金の行を日付順に並べる（同じ日は入金が先・日付なしは末尾・同順は元の並び）。 */
export function buildInvoiceRows(
  lines: InvoiceLineInput[],
  paymentRows: InvoicePdfRow[],
): InvoicePdfRow[] {
  const itemRows: InvoicePdfRow[] = lines.map((l) => {
    const d = describeItem(l)
    return {
      kind: "item",
      date: l.deliveryDate,
      docNumber: l.deliveryNumber,
      itemCode: pdfText(l.itemCode) || null,
      itemName: pdfText(l.itemName),
      description: d.description,
      colorSize: d.colorSize,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.subtotal,
    }
  })
  const all = [...itemRows, ...paymentRows].map((row, i) => ({ row, i }))
  all.sort((a, b) => {
    const da = a.row.date
    const db = b.row.date
    if (da === null && db === null) return a.i - b.i
    if (da === null) return 1
    if (db === null) return -1
    if (da !== db) return da < db ? -1 : 1
    if (a.row.kind !== b.row.kind) return a.row.kind === "payment" ? -1 : 1
    return a.i - b.i
  })
  return all.map((x) => x.row)
}

/** yyyy-MM-dd → yyyy/mm/dd（無ければ ""） */
export function ymdSlash(s: string | null | undefined): string {
  if (!s) return ""
  return s.replace(/-/g, "/")
}

/** yyyy-MM-dd → mm/dd */
export function mdSlash(s: string | null | undefined): string {
  if (!s) return ""
  const [, m, d] = s.split("-")
  return `${m}/${d}`
}

/** 金額。マイナスは ASCII の "-"（P4-D9）。 */
export function yenText(n: number): string {
  const abs = Math.abs(n).toLocaleString("ja-JP")
  return n < 0 ? `-¥${abs}` : `¥${abs}`
}

/** 数量・単価など「¥」なし。 */
export function numText(n: number): string {
  const abs = Math.abs(n).toLocaleString("ja-JP")
  return n < 0 ? `-${abs}` : abs
}
