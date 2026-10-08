/**
 * B-212 PR-1 FIX-1: 金額・数量の表示用の整形（純関数・文字列のまま・Number / float にしない）。
 * - 金額: 外貨は小数 2 桁固定（USD 1,493.80）、JPY は小数なし（¥165,000）。確認画面・一覧・詳細で同じものを使う
 * - 数量: 末尾の 0 を落として 3 桁区切り（100.5000 → 100.5・100.0000 → 100）
 * 丸めは四捨五入（半分は切り上げ）。BigInt で行い float の誤差を避ける
 */

/** "-1,234.50" のような数の文字列を 符号・整数部・小数部 に分ける。数でなければ null */
function splitDecimal(raw: string): { neg: boolean; int: string; frac: string } | null {
  const t = raw.replace(/[,\s　]/g, "")
  const m = t.match(/^([+-]?)(\d*)(?:\.(\d*))?$/)
  if (!m || (m[2] === "" && (m[3] ?? "") === "")) return null
  return { neg: m[1] === "-", int: m[2] || "0", frac: m[3] ?? "" }
}

/** 小数 digits 桁に丸めた（半分は切り上げ）整数部と小数部を返す */
function roundTo(int: string, frac: string, digits: number): { int: string; frac: string } {
  const scale = BigInt(10) ** BigInt(digits)
  const keep = frac.slice(0, digits).padEnd(digits, "0")
  const rest = frac.slice(digits)
  let scaled = BigInt(int) * scale + (digits > 0 ? BigInt(keep) : BigInt(0))
  if (rest !== "" && rest[0] >= "5") scaled += BigInt(1)
  const s = scaled.toString().padStart(digits + 1, "0")
  return { int: s.slice(0, s.length - digits), frac: digits > 0 ? s.slice(s.length - digits) : "" }
}

function group3(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

/**
 * 数の文字列を digits 桁の小数で整形する（digits が null なら末尾の 0 を落として最大 4 桁）。
 * 数でなければそのまま返す。空・null は "—"
 */
export function formatDecimalString(value: string | null | undefined, digits: number | null): string {
  if (value == null || value === "") return "—"
  const p = splitDecimal(value)
  if (!p) return value
  if (digits === null) {
    const r = roundTo(p.int, p.frac, 4)
    const frac = r.frac.replace(/0+$/, "")
    const body = group3(r.int) + (frac ? `.${frac}` : "")
    return p.neg && body !== "0" ? `−${body}` : body
  }
  const r = roundTo(p.int, p.frac, digits)
  const body = group3(r.int) + (digits > 0 ? `.${r.frac}` : "")
  const isZero = /^[0.]*$/.test(body.replace(/,/g, ""))
  return p.neg && !isZero ? `−${body}` : body
}

/** 数の文字列か（"1,493.80"・"-12"・".5" は true・"35400?" は false） */
export function isDecimalString(value: string): boolean {
  return splitDecimal(value) !== null
}

/** 金額: JPY は ¥＋小数なし、外貨は通貨コード＋小数 2 桁。「¥」の前に負号。数でなければそのまま返す */
export function formatMoney(value: string | null | undefined, currency: string): string {
  if (value == null || value === "") return "—"
  if (!isDecimalString(value)) return value
  if (currency === "JPY") {
    const s = formatDecimalString(value, 0)
    return s.startsWith("−") ? `−¥${s.slice(1)}` : `¥${s}`
  }
  return `${currency} ${formatDecimalString(value, 2)}`
}

/** 数量: 末尾の 0 を落として 3 桁区切り（最大 4 桁） */
export function formatQuantity(value: string | null | undefined): string {
  return formatDecimalString(value, null)
}
