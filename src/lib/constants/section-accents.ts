/**
 * B-078-3: セクション別アクセントカラー（3系統・定数集約）。
 *
 * - master系（マスター）/ project系（案件=品番・サンプル）/ trade系（取引=見積・発注・受注）。
 * - 適用箇所はサイドバーのセクション見出しと各ページ上部のヘッダー帯のみ（過剰配色を避ける）。
 * - 彩度低めの既存 Tailwind パレット。色を変えたいときはこのファイル1箇所を編集する。
 */
export type SectionAccentKey = "master" | "project" | "trade" | "neutral"

export const SECTION_ACCENTS: Record<
  SectionAccentKey,
  { label: string; bar: string; heading: string }
> = {
  master: { label: "マスター", bar: "bg-sky-400/70", heading: "text-sky-600" },
  project: {
    label: "案件",
    bar: "bg-emerald-400/70",
    heading: "text-emerald-600",
  },
  trade: {
    label: "取引",
    bar: "bg-violet-400/70",
    heading: "text-violet-600",
  },
  neutral: { label: "", bar: "bg-transparent", heading: "text-muted-foreground" },
}

// パス前方一致 → 系統。（project の "/products" は "/product-categories" と別＝前方一致は "/products/" で判定）
const ACCENT_PREFIXES: { key: SectionAccentKey; prefixes: string[] }[] = [
  // A-seed1: 量産見積は品番カルテ直結の案件系（ブリーフ指定＝project/emerald）。
  {
    key: "project",
    prefixes: ["/products", "/samples", "/skus", "/production-estimates"],
  },
  {
    key: "trade",
    prefixes: [
      "/quotations",
      "/purchase-orders",
      "/work-orders",
      "/sales-orders",
      "/deliveries",
    ],
  },
  {
    key: "master",
    prefixes: [
      "/clients",
      "/brands",
      "/suppliers",
      "/factories",
      "/contractors",
      "/buyers",
      "/delivery-destinations",
      "/model-codes",
      "/materials",
      "/material-categories",
      "/colors",
      "/textile-pattern-types",
      "/textile-patterns",
      "/product-categories",
      "/processing-types",
      "/cost-categories",
      "/inquiries",
    ],
  },
]

export function sectionAccentForPath(pathname: string): SectionAccentKey {
  for (const g of ACCENT_PREFIXES) {
    if (
      g.prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))
    ) {
      return g.key
    }
  }
  return "neutral"
}
