/**
 * B-054 PR-4a/4b: 縫製仕様書 PDF の純関数部（prisma 非依存・テスト対象）。
 * - parseSewingSpecPages: クエリ `page=<kind>:<woId>[:<sortOrder>(,<sortOrder>…)]` の解釈（addendum v0.2 D-35）
 * - kindLabel: 区分の札（量産／サンプル n／量産（追加）／量産（やり直し）＝D-15・D-16・D-28）
 * - quantityMode: 数量の出し方（量産＝SKU の色×サイズ／それ以外＝この発注の合計だけ・D-27）
 *
 * 4b で measure（2枚目・採寸用）と process（3枚目・加工工場用）を受け付ける。クエリの形は 4a から変えない。
 */

export const SEWING_SPEC_PAGE_KINDS = ["sewing", "measure", "process"] as const
export type SewingSpecPageKind = (typeof SEWING_SPEC_PAGE_KINDS)[number]

export const SEWING_SPEC_MAX_PAGES = 10

/**
 * 載せる画像（絵型）の上限。
 * - sewing: 4a のまま（上限なし・先頭の1枚を使う）
 * - measure: 2 まで（1つ目＝採寸位置の絵型・2つ目＝サイズ表の画像）
 * - process: 4 まで（2列に並べる）。宛先は加工5種＋SEWING（詳細図・D-71）
 */
export const SEWING_SPEC_MAX_IMAGES: Record<SewingSpecPageKind, number | null> = {
  sewing: null,
  measure: 2,
  process: 4,
}

export type SewingSpecPageSpec = {
  kind: SewingSpecPageKind
  woId: string
  /** 載せる絵型の sortOrder（クエリの順）。省略時は null（＝最小の1枚） */
  sortOrders: number[] | null
}

export type ParseSewingSpecPagesResult =
  | { ok: true; pages: SewingSpecPageSpec[] }
  | { ok: false; code: "invalid"; error: string }

function isPageKind(v: string): v is SewingSpecPageKind {
  return (SEWING_SPEC_PAGE_KINDS as readonly string[]).includes(v)
}

export function parseSewingSpecPages(
  searchParams: URLSearchParams,
): ParseSewingSpecPagesResult {
  const raw = searchParams.getAll("page")
  if (raw.length === 0) {
    return { ok: false, code: "invalid", error: "page が指定されていません" }
  }
  if (raw.length > SEWING_SPEC_MAX_PAGES) {
    return {
      ok: false,
      code: "invalid",
      error: `page は ${SEWING_SPEC_MAX_PAGES} 件までです（${raw.length} 件）`,
    }
  }
  const pages: SewingSpecPageSpec[] = []
  for (const p of raw) {
    const parts = p.split(":")
    if (parts.length < 2 || parts.length > 3) {
      return { ok: false, code: "invalid", error: `page の形式が不正です: ${p}` }
    }
    const [kind, woId, orders] = parts
    if (!isPageKind(kind)) {
      return { ok: false, code: "invalid", error: `page の種別が不正です: ${kind}` }
    }
    if (!woId) {
      return { ok: false, code: "invalid", error: `page の woId が空です: ${p}` }
    }
    let sortOrders: number[] | null = null
    if (parts.length === 3) {
      if (orders === "") {
        return { ok: false, code: "invalid", error: `page の sortOrder が空です: ${p}` }
      }
      sortOrders = []
      for (const s of orders.split(",")) {
        if (!/^-?\d+$/.test(s)) {
          return {
            ok: false,
            code: "invalid",
            error: `page の sortOrder が整数ではありません: ${s}`,
          }
        }
        sortOrders.push(Number.parseInt(s, 10))
      }
      if (new Set(sortOrders).size !== sortOrders.length) {
        return { ok: false, code: "invalid", error: `page の sortOrder が重複しています: ${p}` }
      }
      const max = SEWING_SPEC_MAX_IMAGES[kind]
      if (max !== null && sortOrders.length > max) {
        return {
          ok: false,
          code: "invalid",
          error: `${kind} の画像は ${max} つまでです（${sortOrders.length} つ）: ${p}`,
        }
      }
    }
    pages.push({ kind, woId, sortOrders })
  }
  return { ok: true, pages }
}

/**
 * 区分の札。WorkOrderCategory の文字列を受ける（prisma の enum に依存しない）。
 * - PRODUCTION → 量産
 * - SAMPLE → サンプル {sampleRound}（sampleRound が空なら「サンプル」。"2nd" などは変換せずそのまま・D-28）
 * - ADDITIONAL → 量産（追加）／REWORK → 量産（やり直し）
 * - それ以外（PATTERN / GRADING など）→ null（札を出さない）
 */
export function kindLabel(
  workCategory: string,
  sampleRound: string | null | undefined,
): string | null {
  switch (workCategory) {
    case "PRODUCTION":
      return "量産"
    case "SAMPLE": {
      const r = (sampleRound ?? "").trim()
      return r ? `サンプル ${r}` : "サンプル"
    }
    case "ADDITIONAL":
      return "量産（追加）"
    case "REWORK":
      return "量産（やり直し）"
    default:
      return null
  }
}

export type SewingSpecQuantityMode = "sku-matrix" | "wo-total-only"

/** 数量の出し方。量産だけ SKU の色×サイズを出す（dev 実測: WO 明細は色×サイズを持たない・D-27）。 */
export function quantityMode(workCategory: string): SewingSpecQuantityMode {
  return workCategory === "PRODUCTION" ? "sku-matrix" : "wo-total-only"
}
