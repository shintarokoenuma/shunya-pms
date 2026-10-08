/**
 * B-212 PR-1（P1-D6・仕様確認書 v1.1 §3-6）: B-070 が出す月次 CSV（明細1行＝1行）の読み取りと検証（純関数・prisma 非依存）。
 * - 先頭の BOM を取り除き、papaparse（header: true・skipEmptyLines）で読む
 * - 見出しは 34 列ちょうど（順番は問わない）。足りない列があればエラーで止める。知らない列は無視して警告
 * - 金額・数量はカンマを取り除いて数の文字列のまま持つ（Decimal で保存・float にしない）。数にならない値はその行のエラー
 * - （相手先名・書類No・月度）が同じ行を1書類にまとめる。同じ書類でヘッダの列が行によって違えばエラー
 * - 検算: 書類ごとに「明細の金額税抜の合計＝書類税抜」。合わなければ警告（止めない）
 */
import Papa from "papaparse"
import { Prisma } from "@prisma/client"

export const CSV_COLUMNS = [
  "月度", "相手先区分", "相手先コード", "相手先名", "登録番号", "書類種別", "書類No", "発行日", "締め日", "支払期日",
  "書類税抜", "書類消費税", "書類税込", "通貨", "行番号", "計上区分", "対の書類No", "伝票日付", "伝票No", "投入先",
  "品番", "品名", "数量", "単位", "単価", "金額税抜", "税区分", "費目", "件数", "枚数", "重さkg", "原本ファイル", "原本ページ", "メモ",
] as const
export type CsvColumn = (typeof CSV_COLUMNS)[number]

export const CURRENCY_VALUES = ["JPY", "USD", "CNY", "VND", "EUR"] as const
export type CsvCurrency = (typeof CURRENCY_VALUES)[number]
export type PostingType = "COUNTED" | "REFERENCE"

/** CSV の何行目（1 = 見出し・データは 2 から）・何の列・なぜ */
export type CsvIssue = { row: number | null; column: CsvColumn | null; message: string }

export type ParsedLine = {
  csvRow: number
  lineNo: number
  slipDate: string | null
  slipNumber: string | null
  targetRaw: string | null
  itemCodeRaw: string | null
  itemName: string | null
  /** 数の文字列（"1234.5"）。Decimal で保存する */
  quantity: string | null
  unit: string | null
  unitPrice: string | null
  amount: string
  taxCategory: string | null
  /** 費目（CSV の文字のまま。マスターへの当ては呼ぶ側） */
  costCategoryRaw: string | null
  packageCount: number | null
  pieceCount: number | null
  weightKg: string | null
  sourcePage: number | null
  memo: string | null
}

export type ParsedDocument = {
  /** 相手先名・書類No・月度（同じ書類の行をまとめる鍵） */
  key: string
  firstCsvRow: number
  periodMonth: string
  counterpartCategoryRaw: string | null
  counterpartCodeRaw: string | null
  counterpartNameRaw: string
  registrationNumber: string | null
  documentType: string
  documentNumber: string
  issueDate: string | null
  closingDate: string | null
  dueDate: string | null
  subtotal: string | null
  taxAmount: string | null
  totalAmount: string
  currency: CsvCurrency
  postingType: PostingType
  pairedDocumentNumber: string | null
  sourceFileName: string | null
  lines: ParsedLine[]
  /** 検算（書類税抜があるときだけ）: 明細の金額税抜の合計と書類税抜 */
  checksum: { lineTotal: string; subtotal: string; ok: boolean } | null
}

export type ParseResult = { documents: ParsedDocument[]; errors: CsvIssue[]; warnings: CsvIssue[] }

export function documentKey(counterpartNameRaw: string, documentNumber: string, periodMonth: string): string {
  return `${counterpartNameRaw}\u0000${documentNumber}\u0000${periodMonth}`
}

const NUM_RE = /^-?\d+(\.\d+)?$/
const INT_RE = /^-?\d+$/

function cell(row: Record<string, string>, col: CsvColumn): string {
  return (row[col] ?? "").trim()
}
function opt(v: string): string | null {
  return v === "" ? null : v
}
/** カンマ・空白を取り除いた数の文字列（"1,234.50" → "1234.50"）。数にならなければ null */
export function parseNumber(v: string): string | null {
  const t = v.replace(/[,\s　]/g, "").replace(/^¥/, "").replace(/^\+/, "")
  if (t === "") return null
  if (!NUM_RE.test(t)) return null
  return new Prisma.Decimal(t).toString()
}
function parseInteger(v: string): number | null {
  const t = v.replace(/[,\s　]/g, "")
  if (!INT_RE.test(t)) return null
  return Number(t)
}
/** YYYY-MM-DD か YYYY/MM/DD → YYYY-MM-DD。それ以外は null */
export function parseDate(v: string): string | null {
  const m = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return `${m[1]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}
export function parseMonth(v: string): string | null {
  const m = v.match(/^(\d{4})[-/](\d{1,2})$/)
  if (!m) return null
  const mo = Number(m[2])
  if (mo < 1 || mo > 12) return null
  return `${m[1]}-${String(mo).padStart(2, "0")}`
}

/** 書類のヘッダとして行ごとに同じであるべき列（P1-D6） */
const HEADER_COLUMNS: CsvColumn[] = ["相手先コード", "書類種別", "発行日", "締め日", "支払期日", "書類税抜", "書類消費税", "書類税込", "通貨", "計上区分", "対の書類No", "原本ファイル"]

export function parseSupplierInvoiceCsv(text: string): ParseResult {
  const errors: CsvIssue[] = []
  const warnings: CsvIssue[] = []
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const parsed = Papa.parse<Record<string, string>>(body, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() })
  const headers = (parsed.meta.fields ?? []).filter((h) => h !== "")
  const missing = CSV_COLUMNS.filter((c) => !headers.includes(c))
  if (missing.length > 0) {
    errors.push({ row: 1, column: null, message: `見出しに足りない列があります: ${missing.join("、")}` })
    return { documents: [], errors, warnings }
  }
  for (const h of headers) {
    if (!(CSV_COLUMNS as readonly string[]).includes(h)) warnings.push({ row: 1, column: null, message: `知らない列「${h}」は無視します` })
  }
  for (const e of parsed.errors) {
    if (e.code === "TooFewFields" || e.code === "TooManyFields") {
      errors.push({ row: (e.row ?? 0) + 2, column: null, message: `列の数が見出しと合いません（${e.message}）` })
    }
  }

  const docs = new Map<string, ParsedDocument>()
  parsed.data.forEach((row, i) => {
    const csvRow = i + 2
    const bad = (column: CsvColumn, message: string) => errors.push({ row: csvRow, column, message })
    let rowOk = true
    const req = (column: CsvColumn): string => {
      const v = cell(row, column)
      if (v === "") {
        bad(column, `${column}は必須です`)
        rowOk = false
      }
      return v
    }
    const periodMonthRaw = req("月度")
    const periodMonth = parseMonth(periodMonthRaw)
    if (periodMonthRaw && !periodMonth) { bad("月度", `月度は YYYY-MM で書いてください（${periodMonthRaw}）`); rowOk = false }
    const counterpartNameRaw = req("相手先名")
    const documentType = req("書類種別")
    const documentNumber = req("書類No")
    const totalRaw = req("書類税込")
    const totalAmount = totalRaw ? parseNumber(totalRaw) : null
    if (totalRaw && totalAmount == null) { bad("書類税込", `数になりません（${totalRaw}）`); rowOk = false }
    const currencyRaw = req("通貨").toUpperCase()
    const currency = (CURRENCY_VALUES as readonly string[]).includes(currencyRaw) ? (currencyRaw as CsvCurrency) : null
    if (currencyRaw && !currency) { bad("通貨", `通貨は ${CURRENCY_VALUES.join(" / ")} のどれかです（${currencyRaw}）`); rowOk = false }
    const lineNoRaw = req("行番号")
    const lineNo = lineNoRaw ? parseInteger(lineNoRaw) : null
    if (lineNoRaw && lineNo == null) { bad("行番号", `整数になりません（${lineNoRaw}）`); rowOk = false }
    const postingRaw = req("計上区分")
    const postingType: PostingType | null = postingRaw === "計上" ? "COUNTED" : postingRaw === "参照" ? "REFERENCE" : null
    if (postingRaw && !postingType) { bad("計上区分", `計上区分は「計上」か「参照」です（${postingRaw}）`); rowOk = false }
    const amountRaw = req("金額税抜")
    const amount = amountRaw ? parseNumber(amountRaw) : null
    if (amountRaw && amount == null) { bad("金額税抜", `数になりません（${amountRaw}）`); rowOk = false }

    const numOpt = (column: CsvColumn): string | null => {
      const v = cell(row, column)
      if (v === "") return null
      const n = parseNumber(v)
      if (n == null) { bad(column, `数になりません（${v}）`); rowOk = false }
      return n
    }
    const intOpt = (column: CsvColumn): number | null => {
      const v = cell(row, column)
      if (v === "") return null
      const n = parseInteger(v)
      if (n == null) { bad(column, `整数になりません（${v}）`); rowOk = false }
      return n
    }
    const dateOpt = (column: CsvColumn): string | null => {
      const v = cell(row, column)
      if (v === "") return null
      const d = parseDate(v)
      if (!d) { bad(column, `日付は YYYY-MM-DD か YYYY/MM/DD で書いてください（${v}）`); rowOk = false }
      return d
    }
    const subtotal = numOpt("書類税抜")
    const taxAmount = numOpt("書類消費税")
    const issueDate = dateOpt("発行日")
    const closingDate = dateOpt("締め日")
    const dueDate = dateOpt("支払期日")
    const slipDate = dateOpt("伝票日付")
    const quantity = numOpt("数量")
    const unitPrice = numOpt("単価")
    const weightKg = numOpt("重さkg")
    const packageCount = intOpt("件数")
    const pieceCount = intOpt("枚数")
    const sourcePage = intOpt("原本ページ")
    if (!rowOk || !periodMonth || !totalAmount || !currency || lineNo == null || !postingType || !amount) return

    const line: ParsedLine = {
      csvRow, lineNo, slipDate, slipNumber: opt(cell(row, "伝票No")), targetRaw: opt(cell(row, "投入先")),
      itemCodeRaw: opt(cell(row, "品番")), itemName: opt(cell(row, "品名")), quantity, unit: opt(cell(row, "単位")), unitPrice, amount,
      taxCategory: opt(cell(row, "税区分")), costCategoryRaw: opt(cell(row, "費目")), packageCount, pieceCount, weightKg, sourcePage, memo: opt(cell(row, "メモ")),
    }
    const key = documentKey(counterpartNameRaw, documentNumber, periodMonth)
    const existing = docs.get(key)
    if (!existing) {
      docs.set(key, {
        key, firstCsvRow: csvRow, periodMonth,
        counterpartCategoryRaw: opt(cell(row, "相手先区分")), counterpartCodeRaw: opt(cell(row, "相手先コード")), counterpartNameRaw,
        registrationNumber: opt(cell(row, "登録番号")), documentType, documentNumber, issueDate, closingDate, dueDate,
        subtotal, taxAmount, totalAmount, currency, postingType, pairedDocumentNumber: opt(cell(row, "対の書類No")),
        sourceFileName: opt(cell(row, "原本ファイル")), lines: [line], checksum: null,
      })
      return
    }
    // 同じ書類の中でヘッダの列が違えばエラー（その行は入れない）
    const headerValues: Record<string, string | null> = {
      "相手先コード": existing.counterpartCodeRaw, "書類種別": existing.documentType, "発行日": existing.issueDate, "締め日": existing.closingDate,
      "支払期日": existing.dueDate, "書類税抜": existing.subtotal, "書類消費税": existing.taxAmount, "書類税込": existing.totalAmount,
      "通貨": existing.currency, "計上区分": existing.postingType, "対の書類No": existing.pairedDocumentNumber, "原本ファイル": existing.sourceFileName,
    }
    const rowValues: Record<string, string | null> = {
      "相手先コード": opt(cell(row, "相手先コード")), "書類種別": documentType, "発行日": issueDate, "締め日": closingDate, "支払期日": dueDate,
      "書類税抜": subtotal, "書類消費税": taxAmount, "書類税込": totalAmount, "通貨": currency, "計上区分": postingType,
      "対の書類No": opt(cell(row, "対の書類No")), "原本ファイル": opt(cell(row, "原本ファイル")),
    }
    let consistent = true
    for (const col of HEADER_COLUMNS) {
      if ((headerValues[col] ?? null) !== (rowValues[col] ?? null)) {
        bad(col, `同じ書類（${documentNumber}）の ${existing.firstCsvRow} 行目と値が違います（${headerValues[col] ?? "空"} ≠ ${rowValues[col] ?? "空"}）`)
        consistent = false
      }
    }
    if (consistent) existing.lines.push(line)
  })

  const documents = [...docs.values()]
  for (const d of documents) {
    d.lines.sort((a, b) => a.lineNo - b.lineNo)
    if (d.subtotal != null) {
      const lineTotal = d.lines.reduce((acc, l) => acc.plus(l.amount), new Prisma.Decimal(0))
      const ok = lineTotal.equals(new Prisma.Decimal(d.subtotal))
      d.checksum = { lineTotal: lineTotal.toString(), subtotal: d.subtotal, ok }
      if (!ok) warnings.push({ row: d.firstCsvRow, column: "書類税抜", message: `書類 ${d.documentNumber}: 明細の金額税抜の合計 ${lineTotal.toString()} が書類税抜 ${d.subtotal} と合いません` })
    }
  }
  return { documents, errors, warnings }
}

/** 計上の書類だけを通貨ごとに合計（D-4）。参照の書類は入れない */
export function sumCountedByCurrency(docs: { postingType: PostingType; currency: string; totalAmount: string }[]): Record<string, string> {
  const out: Record<string, Prisma.Decimal> = {}
  for (const d of docs) {
    if (d.postingType !== "COUNTED") continue
    out[d.currency] = (out[d.currency] ?? new Prisma.Decimal(0)).plus(d.totalAmount)
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.toString()]))
}
