/**
 * B-212 PR-1（P1-D4・P1-D5）: 仕入先・工場の請求書の「投入先 → 品番」「相手先名 → 仕入先／工場／外注先」の当て方（純関数・prisma 非依存）。
 * 仕様確認書 v1.1 D-1（先方品番 → 社内品番 → パターンナンバーの順・複数なら候補）・D-5（覚えた対応は要確認）。
 * - normalizeKey: NFKC → 大文字 → 空白・「-」「‐」「−」「_」「.」を取り除く（色番の normalizeSupplierColorCode と同じ流儀）
 * - 覚えた対応（MatchRule）を完全一致より先に見るのは、人が直した結果を優先するため。確認が要る印（RULE_PENDING）は残す
 */

export type ProductMatchStatus = "MATCHED" | "RULE_PENDING" | "UNMATCHED" | "NO_PRODUCT"
export type ProductMatchSource = "CLIENT_PRODUCT_CODE" | "PRODUCT_CODE" | "PATTERN_NUMBER" | "RULE" | "MANUAL"

/** 正規化した照合キー。空なら null */
export function normalizeKey(s: string | null | undefined): string | null {
  if (s == null) return null
  const t = s
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[\s　]/g, "")
    .replace(/[-‐‑‒–—―−_.]/g, "")
  return t === "" ? null : t
}

/**
 * 投入先を断片に分ける: 元の文字全体を先頭に、「/」「(」「)」「（」「）」「、」「,」「空白」で区切った断片を続ける（重複は除く）。
 * 例「26A-PT05(25SY-50)」→ ["26A-PT05(25SY-50)", "26A-PT05", "25SY-50"]
 */
export function splitTargetTokens(raw: string | null | undefined): string[] {
  const whole = (raw ?? "").trim()
  if (!whole) return []
  const out = [whole]
  for (const part of whole.split(/[/()（）、,\s　]+/)) {
    const p = part.trim()
    if (p && !out.includes(p)) out.push(p)
  }
  return out
}

export type ProductIndexEntry = {
  productId: string
  productCode: string
  clientProductCode: string | null
  patternNumber: string | null
}

export type ProductIndex = {
  byClientCode: Map<string, string[]>
  byProductCode: Map<string, string[]>
  byPatternNumber: Map<string, string[]>
}

function push(map: Map<string, string[]>, key: string | null, id: string) {
  if (!key) return
  const list = map.get(key)
  if (list) {
    if (!list.includes(id)) list.push(id)
  } else map.set(key, [id])
}

/** 取り込み1回につき1回だけ作る（会社の品番を全部読んで正規化した文字 → productId[]） */
export function buildProductIndex(products: ProductIndexEntry[]): ProductIndex {
  const index: ProductIndex = { byClientCode: new Map(), byProductCode: new Map(), byPatternNumber: new Map() }
  for (const p of products) {
    push(index.byClientCode, normalizeKey(p.clientProductCode), p.productId)
    push(index.byProductCode, normalizeKey(p.productCode), p.productId)
    push(index.byPatternNumber, normalizeKey(p.patternNumber), p.productId)
  }
  return index
}

export type ProductMatchResult = {
  status: ProductMatchStatus
  matchedBy: ProductMatchSource | null
  productId: string | null
  /** パターンナンバーなどで複数に当たったときの候補（UNMATCHED） */
  candidates: string[]
}

const STAGES: { source: ProductMatchSource; map: keyof ProductIndex }[] = [
  { source: "CLIENT_PRODUCT_CODE", map: "byClientCode" },
  { source: "PRODUCT_CODE", map: "byProductCode" },
  { source: "PATTERN_NUMBER", map: "byPatternNumber" },
]

/**
 * 1行の投入先を品番に当てる（P1-D4 の順）:
 *  1. その相手先の覚えた対応（sourceKey＝normalizeKey(投入先の全体)）→ RULE_PENDING
 *  2. 断片ごとに 先方品番 → 社内品番 → パターンナンバー の完全一致。最初に当たった段で1つなら MATCHED、複数なら UNMATCHED＋候補
 *  3. 当たらない → 費目があれば NO_PRODUCT、無ければ UNMATCHED
 */
export function matchProduct(
  targetRaw: string | null | undefined,
  opts: { index: ProductIndex; rules: Map<string, string>; hasCostCategory: boolean },
): ProductMatchResult {
  const none: ProductMatchResult = {
    status: opts.hasCostCategory ? "NO_PRODUCT" : "UNMATCHED",
    matchedBy: null,
    productId: null,
    candidates: [],
  }
  const tokens = splitTargetTokens(targetRaw)
  if (tokens.length === 0) return none
  const wholeKey = normalizeKey(tokens[0])
  if (wholeKey) {
    const ruled = opts.rules.get(wholeKey)
    if (ruled) return { status: "RULE_PENDING", matchedBy: "RULE", productId: ruled, candidates: [] }
  }
  for (const token of tokens) {
    const key = normalizeKey(token)
    if (!key) continue
    for (const stage of STAGES) {
      const ids = opts.index[stage.map].get(key)
      if (!ids || ids.length === 0) continue
      if (ids.length === 1) return { status: "MATCHED", matchedBy: stage.source, productId: ids[0], candidates: [] }
      return { status: "UNMATCHED", matchedBy: null, productId: null, candidates: [...ids] }
    }
  }
  return none
}

// ---------------------------------------------------------------- 相手先（P1-D5）

export type CounterpartKind = "SUPPLIER" | "FACTORY" | "CONTRACTOR"
export type CounterpartEntry = { type: CounterpartKind; id: string; code: string; name: string }

const CORPORATE_SUFFIX = /(株式会社|有限会社|合同会社|合資会社|合名会社|\(株\)|（株）|㈱|\(有\)|（有）|㈲|\(同\)|（同）)/g

/** 社名から法人の種類（株式会社・(株)・㈱・有限会社・(有)・㈲・合同会社）を取り除く */
export function stripCorporateSuffix(name: string): string {
  return name.replace(CORPORATE_SUFFIX, "").trim()
}

/** 相手先の照合キー: 相手先コードがあれば normalizeKey(コード)、無ければ normalizeKey(法人の種類を除いた社名) */
export function counterpartKey(codeRaw: string | null | undefined, nameRaw: string | null | undefined): string | null {
  const byCode = normalizeKey(codeRaw)
  if (byCode) return byCode
  return normalizeKey(stripCorporateSuffix(nameRaw ?? ""))
}

export type CounterpartMatchResult = {
  status: "MATCHED" | "RULE_PENDING" | "UNMATCHED"
  matchedBy: "RULE" | "CODE" | "NAME" | null
  type: CounterpartKind | "OTHER"
  id: string | null
  candidates: CounterpartEntry[]
}

/**
 * 相手先を当てる（P1-D5 の順）: ①覚えた対応 → 要確認 ②マスターのコードと相手先コードの完全一致 ③法人の種類を除いた社名の一致。
 * 複数に当たったら UNMATCHED＋候補。当たらなければ OTHER・null
 */
export function matchCounterpart(
  codeRaw: string | null | undefined,
  nameRaw: string | null | undefined,
  opts: { entries: CounterpartEntry[]; rules: Map<string, { type: CounterpartKind; id: string }> },
): CounterpartMatchResult {
  const none: CounterpartMatchResult = { status: "UNMATCHED", matchedBy: null, type: "OTHER", id: null, candidates: [] }
  const key = counterpartKey(codeRaw, nameRaw)
  if (!key) return none
  const ruled = opts.rules.get(key)
  if (ruled) return { status: "RULE_PENDING", matchedBy: "RULE", type: ruled.type, id: ruled.id, candidates: [] }
  const codeKey = normalizeKey(codeRaw)
  if (codeKey) {
    const byCode = opts.entries.filter((e) => normalizeKey(e.code) === codeKey)
    if (byCode.length === 1) return { status: "MATCHED", matchedBy: "CODE", type: byCode[0].type, id: byCode[0].id, candidates: [] }
    if (byCode.length > 1) return { ...none, candidates: byCode }
  }
  const nameKey = normalizeKey(stripCorporateSuffix(nameRaw ?? ""))
  if (nameKey) {
    const byName = opts.entries.filter((e) => normalizeKey(stripCorporateSuffix(e.name)) === nameKey)
    if (byName.length === 1) return { status: "MATCHED", matchedBy: "NAME", type: byName[0].type, id: byName[0].id, candidates: [] }
    if (byName.length > 1) return { ...none, candidates: byName }
  }
  return none
}
