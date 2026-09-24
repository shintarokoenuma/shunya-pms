#!/usr/bin/env tsx
/**
 * dev 用デモデータ（インスタ宣伝用の画面キャプチャ向け）一括シード — **dev 専用エントリ**
 *
 * 設計: docs/specs/demo-data-seed-implementation-brief-2026-09-24.md §1 / §3 / §7（D-1〜D-14）
 *
 * 流儀（scripts/seed-dev-sample-data.ts を踏襲）:
 *   - ホストガード: 本番ホスト（shuttle:16099）を検知したら常に abort。期待 dev ホスト（hopper:12921）以外も
 *     ALLOW_DEV_HOST_OVERRIDE=1 が無ければ abort。
 *   - テナントは tenantType MASTER_ADMIN を動的解決。AuditLog の userId は OWNER（role=OWNER）を動的解決。
 *   - 冪等: 各行はコード等のキーで get-or-create（既存ならスキップ）。2回流しても件数が増えない。
 *   - ★既存行の UPDATE / DELETE はしない（D-1）。例外は「この実行で作った ModelCode」への patternNumber 書き込み（D-10）と、
 *     受注作成時の Sku.orderedQuantity / productionQuantity の再集計（createSalesOrder と同じ recomputeSkuOrderedQuantities・D-13）。
 *   - ★量産 WO / ProgressTask / PO は作らない（D-8 / D-9）。Phase 2 で量産見積の生成画面から作る。
 *   - 量産見積（PE）3 件は画面の createProductionEstimateFromSample と同じ計算（computeProductionEstimate）・保存形で作るが、
 *     確定サンプル経由ではない（sourceSampleProductionId null・明細は BOM 行 source BOM ＋ 工賃 source MANUAL）。
 *   - 受注（SO）1 件は createSalesOrder と同じ書き込み規則（productId null・version 1・totalAmount=subtotal 税抜）で
 *     status CONFIRMED（confirmedAt / confirmedByUserId も入れる）。
 *   - createProduct の副作用（ModelCode 自動発番・patternNumber=productCode・ProductStatusHistory 1行）を同じ形で再現（D-10）。
 *   - Sku / Bom / BomItem / ProductColorway / Comment は各 action と同じ形で作り、AuditLog を同じ形（action CREATE・entityType・
 *     afterData）で書く。afterData には source: "seed-dev-demo-data" を足す。
 *
 * 使い方（dev DB にだけ）:
 *   npx tsx scripts/seed-dev-demo-data.ts --dry-run   # 何を作るかだけ出す（DB に書かない・読み取りのみ）
 *   npx tsx scripts/seed-dev-demo-data.ts             # 実投入（★--dry-run の出力を慎太郎さんが確認してから）
 */
import { Prisma, PrismaClient, type Company } from "@prisma/client"
import {
  computeProductionEstimate,
  type ProductionEstimateLineForCalc,
} from "@/lib/production-estimate/calc"
import { computeProductionQuantity } from "@/lib/calc/sales-order-quantity"

const prisma = new PrismaClient()

const EXPECTED_DEV_HOST = "hopper.proxy.rlwy.net:12921"
const KNOWN_PROD_HOSTS = ["shuttle.proxy.rlwy.net:16099"]
const SOURCE = "seed-dev-demo-data"
const DRY_RUN = process.argv.includes("--dry-run")

// ─────────────────────────────────────────────────── 集計
const stats = new Map<string, { created: number; skipped: number }>()
function bump(master: string, kind: "created" | "skipped") {
  const s = stats.get(master) ?? { created: 0, skipped: 0 }
  s[kind]++
  stats.set(master, s)
}
function log(line: string) {
  console.log(line)
}

/**
 * 冪等な get-or-create。finder が見つければ skip、無ければ creator で作成。
 * --dry-run では creator を呼ばず「作る予定」を出して仮 id を返す（下流の finder は仮 id では見つからないので「作る予定」が連鎖する）。
 */
async function getOrCreate(
  master: string,
  label: string,
  finder: () => Promise<{ id: string } | null>,
  creator: () => Promise<{ id: string }>,
): Promise<string> {
  const found = await finder()
  if (found) {
    bump(master, "skipped")
    log(`  skip   ${master.padEnd(20)} ${label}`)
    return found.id
  }
  bump(master, "created")
  if (DRY_RUN) {
    log(`  CREATE ${master.padEnd(20)} ${label}`)
    return `dry:${master}:${label}`
  }
  const made = await creator()
  log(`  CREATE ${master.padEnd(20)} ${label}`)
  return made.id
}

/** 各 action と同じ形の AuditLog（action CREATE）。--dry-run では書かない。 */
async function audit(
  companyId: string,
  userId: string,
  entityType: string,
  entityId: string,
  afterData: Record<string, unknown>,
  description: string,
) {
  if (DRY_RUN) return
  await prisma.auditLog.create({
    data: {
      companyId,
      userId,
      action: "CREATE",
      entityType,
      entityId,
      afterData: { ...afterData, source: SOURCE },
      description,
    },
  })
}

// ─────────────────────────────────────────────────── ホストガード
function guardHost(): string {
  const url = process.env.DATABASE_URL ?? ""
  const host = url.match(/@([^/]+)\//)?.[1] ?? "(unknown)"
  console.log(`[${SOURCE}] DB host: ${host}${DRY_RUN ? "  (--dry-run: DB には書きません)" : ""}`)

  for (const prod of KNOWN_PROD_HOSTS) {
    if (url.includes(prod)) {
      console.error(`[FATAL] DATABASE_URL は本番ホスト(${prod})を指しています。dev 専用スクリプトのため中止します。`)
      process.exit(1)
    }
  }
  if (host !== EXPECTED_DEV_HOST && process.env.ALLOW_DEV_HOST_OVERRIDE !== "1") {
    console.error(`[FATAL] 期待する dev ホスト(${EXPECTED_DEV_HOST})と一致しません: ${host}`)
    console.error("        dev エンドポイントがローテした場合は ALLOW_DEV_HOST_OVERRIDE=1 を付けて再実行してください。")
    process.exit(1)
  }
  return host
}

// ─────────────────────────────────────────────────── 採番（products.ts の computeNext* と同じ規則）
/** --dry-run で同じ prefix を複数回採番しても連番が進むよう、実行内で見た最大値を覚える。 */
const seenNext = new Map<string, number>()

async function nextNumbered(
  prefix: string,
  pad: number,
  findLast: () => Promise<string | null>,
): Promise<string> {
  const last = await findLast()
  let nextNum = 1
  if (last) {
    const m = last.match(/-(\d+)$/)
    if (m) nextNum = parseInt(m[1], 10) + 1
  }
  const remembered = seenNext.get(prefix)
  if (remembered !== undefined && remembered >= nextNum) nextNum = remembered + 1
  seenNext.set(prefix, nextNum)
  return `${prefix}${String(nextNum).padStart(pad, "0")}`
}

// ─────────────────────────────────────────────────── データ定義
type ClientDef = {
  clientCode: string
  companyName: string
  legalEntity: string
  postalCode: string
  prefecture: string
  city: string
  address: string
  addressLine2: string | null
  phone: string
  email: string
  closingDay: number
  paymentMonthOffset: number
  paymentDay: number
  taxId: string | null
  notes: string
}

const CLIENTS: ClientDef[] = [
  {
    clientCode: "CL-003",
    companyName: "ÉTÉ BLANC",
    legalEntity: "株式会社エテ・ブラン",
    postalCode: "150-0001",
    prefecture: "東京都",
    city: "渋谷区",
    address: "神宮前5丁目",
    addressLine2: null,
    phone: "03-0000-0101",
    email: "order@ete-blanc.example.jp",
    closingDay: 31,
    paymentMonthOffset: 1,
    paymentDay: 31,
    taxId: null,
    notes: "リネン中心のフレンチカジュアル。27SS からデイリーラインを追加。",
  },
  {
    clientCode: "CL-004",
    companyName: "HINOKI WORK SUPPLY",
    legalEntity: "株式会社ヒノキワークサプライ",
    postalCode: "153-0061",
    prefecture: "東京都",
    city: "目黒区",
    address: "中目黒3丁目",
    addressLine2: null,
    phone: "03-0000-0102",
    email: "mono@hinoki-ws.example.jp",
    closingDay: 20,
    paymentMonthOffset: 1,
    paymentDay: 31,
    taxId: null,
    notes: "日本のワークウェア。国内縫製・堅牢度重視。",
  },
  {
    clientCode: "CL-005",
    companyName: "SLOW CURRENT",
    legalEntity: "スロウカレント合同会社",
    postalCode: "154-0024",
    prefecture: "東京都",
    city: "世田谷区",
    address: "三軒茶屋2丁目",
    addressLine2: null,
    phone: "03-0000-0103",
    email: "hello@slowcurrent.example.jp",
    closingDay: 31,
    paymentMonthOffset: 2,
    paymentDay: 10,
    taxId: null,
    notes: "街着寄りのアウトドア。機能素材とベーシックカラー。",
  },
]

const BRANDS = [
  { brandCode: "ETB", brandName: "ÉTÉ BLANC", brandNameEn: "ETE BLANC", clientCode: "CL-003" },
  { brandCode: "HNK", brandName: "HINOKI WORK SUPPLY", brandNameEn: "HINOKI WORK SUPPLY", clientCode: "CL-004" },
  { brandCode: "SLC", brandName: "SLOW CURRENT", brandNameEn: "SLOW CURRENT", clientCode: "CL-005" },
]

const SUPPLIERS = [
  {
    supplierCode: "SP-003",
    companyName: "遠州テキスタイル工房",
    companyNameEn: "Enshu Textile Studio",
    supplierType: ["FABRIC"],
    postalCode: "430-0929",
    prefecture: "静岡県",
    city: "浜松市中央区",
    address: "中央1丁目",
    phone: "053-000-0201",
    email: "sales@enshu-tex.example.jp",
    notes: "綿・リネンの機屋。先染め・ワッシャー加工に強い。",
  },
  {
    supplierCode: "SP-004",
    companyName: "Brass & Bone Trims",
    companyNameEn: "Brass & Bone Trims",
    supplierType: ["TRIM", "ACCESSORY", "LABEL"],
    postalCode: "111-0053",
    prefecture: "東京都",
    city: "台東区",
    address: "浅草橋3丁目",
    phone: "03-0000-0202",
    email: "trims@brassandbone.example.jp",
    notes: "ボタン・金具・織ネーム・下げ札。小ロット対応。",
  },
]

type MaterialDef = {
  materialCode: string
  materialName: string
  materialNameEn: string
  materialType: "FABRIC" | "BUTTON" | "LABEL" | "CARE_LABEL" | "HANG_TAG"
  supplierCode: string
  unit: string
  unitPrice: number
  composition?: string
  fabricWidth?: number
  fabricWeight?: number
  specification?: string
}

const MATERIALS: MaterialDef[] = [
  { materialCode: "MT-004", materialName: "リネンキャンバス 1/25", materialNameEn: "Linen Canvas 1/25", materialType: "FABRIC", supplierCode: "SP-003", unit: "m", unitPrice: 1450, composition: "Linen 100%", fabricWidth: 148, fabricWeight: 260, specification: "先染め・ワッシャー加工" },
  { materialCode: "MT-005", materialName: "フレンチリネン 1/40", materialNameEn: "French Linen 1/40", materialType: "FABRIC", supplierCode: "SP-003", unit: "m", unitPrice: 1680, composition: "Linen 100%", fabricWidth: 140, fabricWeight: 170, specification: "細番手・エアタンブラー仕上げ" },
  { materialCode: "MT-006", materialName: "綿ツイル 10oz", materialNameEn: "Cotton Twill 10oz", materialType: "FABRIC", supplierCode: "SP-003", unit: "m", unitPrice: 980, composition: "Cotton 100%", fabricWidth: 150, fabricWeight: 340, specification: "ヴィンテージ仕上げ・防縮加工" },
  { materialCode: "MT-007", materialName: "綿ツイル 8oz", materialNameEn: "Cotton Twill 8oz", materialType: "FABRIC", supplierCode: "SP-003", unit: "m", unitPrice: 880, composition: "Cotton 100%", fabricWidth: 150, fabricWeight: 270, specification: "防縮加工" },
  { materialCode: "MT-008", materialName: "マイクロフリース", materialNameEn: "Micro Fleece", materialType: "FABRIC", supplierCode: "SP-003", unit: "m", unitPrice: 720, composition: "Polyester 100%", fabricWidth: 160, fabricWeight: 240, specification: "両面起毛・アンチピリング" },
  { materialCode: "MT-009", materialName: "ナイロンタフタ", materialNameEn: "Nylon Taffeta", materialType: "FABRIC", supplierCode: "SP-003", unit: "m", unitPrice: 640, composition: "Nylon 100%", fabricWidth: 150, fabricWeight: 70, specification: "撥水加工・シレー仕上げ" },
  { materialCode: "MT-010", materialName: "貝ボタン 11.5mm", materialNameEn: "Shell Button 11.5mm", materialType: "BUTTON", supplierCode: "SP-004", unit: "個", unitPrice: 28, specification: "白蝶貝・4穴" },
  { materialCode: "MT-011", materialName: "真鍮ドーナツボタン 17mm", materialNameEn: "Brass Donut Button 17mm", materialType: "BUTTON", supplierCode: "SP-004", unit: "個", unitPrice: 45, specification: "真鍮・アンティーク仕上げ・打ち込み" },
  { materialCode: "MT-012", materialName: "織ネーム", materialNameEn: "Woven Label", materialType: "LABEL", supplierCode: "SP-004", unit: "枚", unitPrice: 18, specification: "ブランド別・両端折り" },
  { materialCode: "MT-013", materialName: "品質表示ラベル", materialNameEn: "Care Label", materialType: "CARE_LABEL", supplierCode: "SP-004", unit: "枚", unitPrice: 6, specification: "日本語表示・洗濯表示 JIS L0001" },
  { materialCode: "MT-014", materialName: "下げ札", materialNameEn: "Hang Tag", materialType: "HANG_TAG", supplierCode: "SP-004", unit: "枚", unitPrice: 22, specification: "ブランド別・糸ループ付き" },
]

const FACTORIES = [
  {
    factoryCode: "FC-003",
    factoryName: "Saigon Linen Works",
    factoryNameEn: "Saigon Linen Works Co., Ltd.",
    factoryTypes: ["SEWING"],
    contractTypes: ["CMT", "FULL_PACKAGE"],
    country: "VN",
    city: "Ho Chi Minh City",
    address: "District 7",
    addressEn: "District 7, Ho Chi Minh City, Vietnam",
    phone: "+84-28-0000-0301",
    email: "merch@saigonlinen.example.vn",
    preferredLanguage: "EN",
    preferredCurrency: "USD",
    timezone: "Asia/Ho_Chi_Minh",
    monthlyCapacity: 6000,
    minimumOrderQty: 300,
    averageLeadTimeDays: 45,
    notes: "布帛（リネン・綿）の縫製。シャツ・パンツが得意。",
    contact: { firstName: "Lan", lastName: "Nguyen", displayName: "Nguyen Thi Lan", jobTitle: "Merchandiser", email: "lan.nguyen@saigonlinen.example.vn" },
  },
  {
    factoryCode: "FC-004",
    factoryName: "瀬戸内ソーイングラボ",
    factoryNameEn: "Setouchi Sewing Lab",
    factoryTypes: ["SEWING"],
    contractTypes: ["CMT"],
    country: "JP",
    postalCode: "711-0913",
    prefecture: "岡山県",
    city: "倉敷市",
    address: "児島味野2丁目",
    phone: "086-000-0302",
    email: "lab@setouchi-sewing.example.jp",
    preferredLanguage: "JA",
    preferredCurrency: "JPY",
    timezone: "Asia/Tokyo",
    monthlyCapacity: 1500,
    minimumOrderQty: 100,
    averageLeadTimeDays: 30,
    notes: "デニム・ワーク系。厚地の縫製と洗い加工の手配に強い。",
    contact: { firstName: "健太", lastName: "児島", displayName: "児島 健太", jobTitle: "工場長", email: "kojima@setouchi-sewing.example.jp" },
  },
]

/** 縫製指示（validators/sewing-instruction.ts の v1 の形。各 ≤200 字） */
type SewingInstructionV1 = {
  version: 1
  fixed: { namePosition: string | null; careLabelPosition: string | null; finishingMethod: string | null; postProcessing: string | null; hangTag: string | null }
  sewing: { lining: string | null; thread: string | null; stitch: string | null; patternMatching: string | null; insertion: string | null; fabricDirection: string | null }
}

type ColorwayDef = {
  code: string
  colorNumber: string
  clientColorName: string
  total: number
  supplierColorCode: string
  supplierColorName: string
}

type BomRowDef = {
  itemCategory: string
  materialCode?: string
  customMaterialName?: string
  supplierCode: string
  usagePerUnit: number
  unit: string
  lossRate: number
  unitPrice: number
  supplierItemCode?: string
  specification?: string
  procurementMode?: "METER" | "ROLL"
  /** 生地行: カラーウェイごとの調達カラーを作る */
  perColorway?: boolean
  notes?: string
}

type ProductDef = {
  brandCode: string
  productName: string
  productNameEn: string
  categoryCode: string
  clientProductCode: string
  status: string
  silhouette: string
  description: string
  internalNotes: string
  desiredDeliveryDate: string
  colorways: ColorwayDef[]
  bom: BomRowDef[]
  sewingInstructions: SewingInstructionV1 | null
  comments: string[]
}

const SIZES = [
  { size: "S", sizeOrder: 1, weight: 0.2 },
  { size: "M", sizeOrder: 2, weight: 0.32 },
  { size: "L", sizeOrder: 3, weight: 0.3 },
  { size: "XL", sizeOrder: 4, weight: 0.18 },
]

const LABEL_ROWS = (brandTag: string): BomRowDef[] => [
  { itemCategory: "BRAND_LABEL", materialCode: "MT-012", supplierCode: "SP-004", usagePerUnit: 1, unit: "枚", lossRate: 2, unitPrice: 18, supplierItemCode: `WL-${brandTag}-01`, specification: "衿裏中央・織ネーム" },
  { itemCategory: "CARE_LABEL", materialCode: "MT-013", supplierCode: "SP-004", usagePerUnit: 1, unit: "枚", lossRate: 2, unitPrice: 6, supplierItemCode: "CL-JP-STD", specification: "左脇縫い目・裾から 10cm" },
]

const PRODUCTS: ProductDef[] = [
  {
    brandCode: "ETB",
    productName: "リネン開襟シャツ",
    productNameEn: "Linen Open Collar Shirt",
    categoryCode: "U-TP",
    clientProductCode: "EB27-SH01",
    status: "ORDER_CONFIRMED",
    silhouette: "オーバーサイズ・ドロップショルダー",
    description:
      "先染めリネンキャンバスのオープンカラーシャツ。ボックスシルエットで着丈はヒップにかかる長さ。前立てはフレンチフロント、裾はラウンドのステップヘム。胸ポケット1つ。貝ボタン 11.5mm を7個使用。ワッシャー加工で最初から柔らかい風合いにする。",
    internalNotes: "27SS の主力。1st サンプルで衿の返りが弱かったため衿芯を薄手に変更（2nd で解消）。縮率は洗い後 経 -3.0% / 緯 -1.5% で確認済み。",
    desiredDeliveryDate: "2027-03-12",
    colorways: [
      { code: "A", colorNumber: "01", clientColorName: "Blanc Cassé", total: 200, supplierColorCode: "LC25-01", supplierColorName: "エクリュ" },
      { code: "B", colorNumber: "57", clientColorName: "Bleu Nuit", total: 160, supplierColorCode: "LC25-57", supplierColorName: "インディゴ" },
      { code: "C", colorNumber: "81", clientColorName: "Sable", total: 120, supplierColorCode: "LC25-81", supplierColorName: "サンド" },
      { code: "D", colorNumber: "47", clientColorName: "Kaki", total: 90, supplierColorCode: "LC25-47", supplierColorName: "オリーブ" },
    ],
    bom: [
      { itemCategory: "MAIN_FABRIC", materialCode: "MT-004", supplierCode: "SP-003", usagePerUnit: 1.85, unit: "m", lossRate: 5, unitPrice: 1450, supplierItemCode: "ETX-LC25", specification: "リネンキャンバス 1/25・148cm 幅・先染め", procurementMode: "METER", perColorway: true },
      { itemCategory: "INTERLINING", customMaterialName: "芯地 薄手（衿・前立て）", supplierCode: "SP-004", usagePerUnit: 0.25, unit: "m", lossRate: 5, unitPrice: 320, supplierItemCode: "IF-THIN-90", specification: "接着芯・90cm 幅" },
      { itemCategory: "BUTTON", materialCode: "MT-010", supplierCode: "SP-004", usagePerUnit: 7, unit: "個", lossRate: 3, unitPrice: 28, supplierItemCode: "BB-115-WH", specification: "白蝶貝 11.5mm・前立て6＋胸ポケット1" },
      { itemCategory: "THREAD", customMaterialName: "縫い糸 #60 スパン", supplierCode: "SP-004", usagePerUnit: 0.02, unit: "本", lossRate: 0, unitPrice: 380, supplierItemCode: "TH-60-SP", specification: "#60 スパン・生地色合わせ（1コーン 5,000m）" },
      ...LABEL_ROWS("ETB"),
      { itemCategory: "HANG_TAG", materialCode: "MT-014", supplierCode: "SP-004", usagePerUnit: 1, unit: "枚", lossRate: 2, unitPrice: 22, supplierItemCode: "HT-ETB-27SS", specification: "第2ボタンに糸ループで取り付け" },
      { itemCategory: "POLYBAG", customMaterialName: "OPP 袋（シャツ用）", supplierCode: "SP-004", usagePerUnit: 1, unit: "枚", lossRate: 1, unitPrice: 8, supplierItemCode: "OPP-SH-M", specification: "テープ付き・1枚ずつ個包装" },
    ],
    sewingInstructions: {
      version: 1,
      fixed: {
        namePosition: "衿裏中央・織ネーム。上端を衿付け線から 1cm 下げる",
        careLabelPosition: "左脇縫い目に挟み込み。裾から 10cm",
        finishingMethod: "縫製後に製品ワッシャー。畳み仕上げ・シャツ折り",
        postProcessing: "製品洗い（ワッシャー）1回。乾燥はタンブラー中温",
        hangTag: "第2ボタンに糸ループで取り付け。バーコードシール貼付",
      },
      sewing: {
        lining: "裏地なし。衿・前立てに薄手接着芯",
        thread: "#60 スパン糸・生地色合わせ。ボタン付けは #30",
        stitch: "本縫い 3.0cm に 12針。端はロック始末",
        patternMatching: "無地のため柄合わせなし。前立ての地の目を通す",
        insertion: "胸ポケット口は三つ折り 2.5cm。ポケット付けは閂止め",
        fabricDirection: "経方向に裁断。柔らかさを出すため逆毛不可",
      },
    },
    comments: [
      "生地の縮率は洗い後 経 -3.0% / 緯 -1.5% で確認済み。パターンは縮率込みで補正済み。",
      "ボタン付けは十字付けで統一。糸足は 3mm。",
      "先方から Bleu Nuit の色ブレ注意あり。ロットごとにビーカーを提出すること。",
    ],
  },
  {
    brandCode: "ETB",
    productName: "リネンワイドパンツ",
    productNameEn: "Linen Wide Trousers",
    categoryCode: "U-BT",
    clientProductCode: "EB27-PT01",
    status: "SAMPLE_APPROVED",
    silhouette: "ハイウエスト・ワイドストレート",
    description: "細番手のフレンチリネンを使ったワイドパンツ。ウエストは後ろゴム＋前は釦留めのイージー仕様。両脇ポケット、後ろは片玉縁ポケット1つ。",
    internalNotes: "サンプル承認済み。裾幅を 1st から 1.5cm 絞った。",
    desiredDeliveryDate: "2027-03-12",
    colorways: [
      { code: "A", colorNumber: "01", clientColorName: "Blanc Cassé", total: 150, supplierColorCode: "FL40-01", supplierColorName: "エクリュ" },
      { code: "B", colorNumber: "59", clientColorName: "Encre", total: 140, supplierColorCode: "FL40-59", supplierColorName: "ミッドナイト" },
      { code: "C", colorNumber: "81", clientColorName: "Sable", total: 110, supplierColorCode: "FL40-81", supplierColorName: "サンド" },
    ],
    bom: [
      { itemCategory: "MAIN_FABRIC", materialCode: "MT-005", supplierCode: "SP-003", usagePerUnit: 2.1, unit: "m", lossRate: 5, unitPrice: 1680, supplierItemCode: "ETX-FL40", specification: "フレンチリネン 1/40・140cm 幅", procurementMode: "METER", perColorway: true },
      { itemCategory: "BUTTON", materialCode: "MT-011", supplierCode: "SP-004", usagePerUnit: 1, unit: "個", lossRate: 3, unitPrice: 45, supplierItemCode: "BD-17-AT", specification: "前釦 1個" },
      ...LABEL_ROWS("ETB"),
      { itemCategory: "HANG_TAG", materialCode: "MT-014", supplierCode: "SP-004", usagePerUnit: 1, unit: "枚", lossRate: 2, unitPrice: 22, supplierItemCode: "HT-ETB-27SS" },
    ],
    sewingInstructions: null,
    comments: [],
  },
  {
    brandCode: "HNK",
    productName: "カバーオール",
    productNameEn: "Coverall Jacket",
    categoryCode: "M-OT",
    clientProductCode: "HW27-JK01",
    status: "SAMPLE_IN_PROGRESS",
    silhouette: "レギュラー・ボックス",
    description: "10oz の綿ツイルを使ったカバーオール。胸ポケット2つ＋腰ポケット2つ、内ポケット1つ。前立ては真鍮ドーナツボタン6個。袖口は剣ボラン付き。三本針の巻き縫いで堅牢に。",
    internalNotes: "2nd サンプル製作中。1st で肩幅を 1cm 広げる指示あり。",
    desiredDeliveryDate: "2027-03-26",
    colorways: [
      { code: "A", colorNumber: "57", clientColorName: "Indigo", total: 180, supplierColorCode: "TW10-57", supplierColorName: "インディゴ" },
      { code: "B", colorNumber: "83", clientColorName: "Duck Brown", total: 120, supplierColorCode: "TW10-83", supplierColorName: "ダックブラウン" },
      { code: "C", colorNumber: "99", clientColorName: "Sumi", total: 100, supplierColorCode: "TW10-99", supplierColorName: "スミクロ" },
    ],
    bom: [
      { itemCategory: "MAIN_FABRIC", materialCode: "MT-006", supplierCode: "SP-003", usagePerUnit: 2.4, unit: "m", lossRate: 6, unitPrice: 980, supplierItemCode: "ETX-TW10", specification: "綿ツイル 10oz・150cm 幅・防縮", procurementMode: "METER", perColorway: true },
      { itemCategory: "BUTTON", materialCode: "MT-011", supplierCode: "SP-004", usagePerUnit: 6, unit: "個", lossRate: 3, unitPrice: 45, supplierItemCode: "BD-17-AT", specification: "前立て 6個・打ち込み" },
      ...LABEL_ROWS("HNK"),
    ],
    sewingInstructions: {
      version: 1,
      fixed: {
        namePosition: "後ろ衿ぐり中央・織ネーム。上端は衿付け線から 1.5cm 下",
        careLabelPosition: "左脇内側の縫い目に挟み込み。裾から 12cm",
        finishingMethod: "製品洗い（ワンウォッシュ）後にプレス仕上げ。ハンガー納品",
        postProcessing: "ワンウォッシュ。ボタンは洗い後に打つ",
        hangTag: "左胸ポケットのボタンに糸ループで取り付け",
      },
      sewing: {
        lining: "裏地なし。前立て・衿・カフスに中厚接着芯",
        thread: "#30 スパン糸・オレンジ（配色）。ボタンホールは #20",
        stitch: "脇・袖下は三本針巻き縫い。3.0cm に 10針",
        patternMatching: "無地。綾目の方向を左右で揃える（右上がり）",
        insertion: "ポケット口と前端に閂止め。ポケット口は 2 本針 1/4 インチ",
        fabricDirection: "経方向。綾目の向きを全パーツ同一にする",
      },
    },
    comments: [],
  },
  {
    brandCode: "HNK",
    productName: "ペインターパンツ",
    productNameEn: "Painter Pants",
    categoryCode: "M-BT",
    clientProductCode: "HW27-PT02",
    status: "SAMPLE_REQUESTED",
    silhouette: "ルーズストレート",
    description: "8oz 綿ツイルのペインターパンツ。ハンマーループ・定規ポケット付き。裾はシングル 3cm。",
    internalNotes: "サンプル依頼済み。カバーオールとセットアップで提案。",
    desiredDeliveryDate: "2027-03-26",
    colorways: [
      { code: "A", colorNumber: "81", clientColorName: "Natural", total: 140, supplierColorCode: "TW08-81", supplierColorName: "生成" },
      { code: "B", colorNumber: "57", clientColorName: "Indigo", total: 120, supplierColorCode: "TW08-57", supplierColorName: "インディゴ" },
      { code: "C", colorNumber: "47", clientColorName: "Olive", total: 80, supplierColorCode: "TW08-47", supplierColorName: "オリーブ" },
    ],
    bom: [
      { itemCategory: "MAIN_FABRIC", materialCode: "MT-007", supplierCode: "SP-003", usagePerUnit: 1.9, unit: "m", lossRate: 6, unitPrice: 880, supplierItemCode: "ETX-TW08", specification: "綿ツイル 8oz・150cm 幅", procurementMode: "METER", perColorway: true },
      { itemCategory: "BUTTON", materialCode: "MT-011", supplierCode: "SP-004", usagePerUnit: 1, unit: "個", lossRate: 3, unitPrice: 45, supplierItemCode: "BD-17-AT" },
      ...LABEL_ROWS("HNK"),
    ],
    sewingInstructions: null,
    comments: [],
  },
  {
    brandCode: "SLC",
    productName: "フリースプルオーバー",
    productNameEn: "Fleece Pullover",
    categoryCode: "U-TP",
    clientProductCode: "SC27-TP03",
    status: "PLANNING",
    silhouette: "リラックス・ハーフジップ",
    description: "マイクロフリースのハーフジッププルオーバー。ハイネック、カンガルーポケット、裾と袖口はリブ。",
    internalNotes: "企画中。ジップは YKK の樹脂を想定。",
    desiredDeliveryDate: "2027-03-19",
    colorways: [
      { code: "A", colorNumber: "97", clientColorName: "Charcoal", total: 160, supplierColorCode: "MF-97", supplierColorName: "チャコール" },
      { code: "B", colorNumber: "47", clientColorName: "Moss", total: 120, supplierColorCode: "MF-47", supplierColorName: "モス" },
      { code: "C", colorNumber: "27", clientColorName: "Clay", total: 100, supplierColorCode: "MF-27", supplierColorName: "クレイ" },
      { code: "D", colorNumber: "05", clientColorName: "Ash", total: 80, supplierColorCode: "MF-05", supplierColorName: "アッシュ" },
    ],
    bom: [
      { itemCategory: "MAIN_FABRIC", materialCode: "MT-008", supplierCode: "SP-003", usagePerUnit: 1.6, unit: "m", lossRate: 5, unitPrice: 720, supplierItemCode: "ETX-MF", specification: "マイクロフリース・160cm 幅", procurementMode: "METER", perColorway: true },
      ...LABEL_ROWS("SLC"),
    ],
    sewingInstructions: null,
    comments: [],
  },
  {
    brandCode: "SLC",
    productName: "ナイロンショーツ",
    productNameEn: "Nylon Shorts",
    categoryCode: "U-BT",
    clientProductCode: "SC27-SH04",
    status: "PLANNING",
    silhouette: "ショート・イージー",
    description: "撥水ナイロンタフタのイージーショーツ。ウエストは総ゴム＋ドローコード。両脇と後ろにジップポケット。",
    internalNotes: "企画中。インナーメッシュの要否を先方に確認。",
    desiredDeliveryDate: "2027-03-19",
    colorways: [
      { code: "A", colorNumber: "99", clientColorName: "Black", total: 130, supplierColorCode: "NT-99", supplierColorName: "ブラック" },
      { code: "B", colorNumber: "57", clientColorName: "Navy", total: 110, supplierColorCode: "NT-57", supplierColorName: "ネイビー" },
      { code: "C", colorNumber: "81", clientColorName: "Sand", total: 80, supplierColorCode: "NT-81", supplierColorName: "サンド" },
    ],
    bom: [
      { itemCategory: "MAIN_FABRIC", materialCode: "MT-009", supplierCode: "SP-003", usagePerUnit: 1.2, unit: "m", lossRate: 5, unitPrice: 640, supplierItemCode: "ETX-NT", specification: "ナイロンタフタ・撥水・150cm 幅", procurementMode: "METER", perColorway: true },
      ...LABEL_ROWS("SLC"),
    ],
    sewingInstructions: null,
    comments: [],
  },
]

const SEASON_TYPE = "SS"
const YEAR = 2027
const SEASON = `${String(YEAR).slice(-2)}${SEASON_TYPE}` // composeSeason と同じ合成（"27SS"）

// ─────────────────────────────────────────────────── 量産見積（PE）・受注（SO）の定義
/**
 * 量産見積は画面では createProductionEstimateFromSample（確定サンプル経由）でしか作れない。
 * デモ品番にはサンプル生産が無いので、同 action の FullItem → toCalcLine → computeProductionEstimate →
 * ヘッダ/明細保存（toItemCreateBase）と同じ対応をここに写し、明細は BOM 行（source BOM）と工賃（source MANUAL）で組む。
 * sourceSampleProductionId は null（画面経路との相違点・PR 本文に明記）。
 */
type PeLaborDef = { itemName: string; unitPrice: number; factoryCode: string }
type PeDef = {
  productName: string
  title: string
  marginRate: number
  finalUnitPriceManualJpy: number
  notes: string
  labor: PeLaborDef[]
}
const PE_TITLE = `${SEASON} 量産見積`
const PRODUCTION_ESTIMATES: PeDef[] = [
  {
    productName: "リネン開襟シャツ",
    title: PE_TITLE,
    marginRate: 30,
    finalUnitPriceManualJpy: 4800,
    notes: "27SS 初回生産分。生地は先染め・ロット指定。",
    labor: [
      { itemName: "縫製工賃", unitPrice: 850, factoryCode: "FC-003" },
      { itemName: "検品・仕上げ", unitPrice: 60, factoryCode: "FC-003" },
      { itemName: "国際物流・通関", unitPrice: 180, factoryCode: "FC-003" },
    ],
  },
  {
    productName: "リネンワイドパンツ",
    title: PE_TITLE,
    marginRate: 30,
    finalUnitPriceManualJpy: 5600,
    notes: "27SS 初回生産分。生地は先染め・ロット指定。",
    labor: [
      { itemName: "縫製工賃", unitPrice: 780, factoryCode: "FC-003" },
      { itemName: "検品・仕上げ", unitPrice: 60, factoryCode: "FC-003" },
      { itemName: "国際物流・通関", unitPrice: 170, factoryCode: "FC-003" },
    ],
  },
  {
    productName: "カバーオール",
    title: PE_TITLE,
    marginRate: 30,
    finalUnitPriceManualJpy: 6200,
    notes: "27SS 初回生産分。生地は先染め・ロット指定。",
    labor: [
      { itemName: "縫製工賃", unitPrice: 2200, factoryCode: "FC-004" },
      { itemName: "製品洗い", unitPrice: 180, factoryCode: "FC-004" },
      { itemName: "検品・仕上げ", unitPrice: 80, factoryCode: "FC-004" },
    ],
  },
]

/** 受注（createSalesOrder と同じ書き込み規則: productId null・version 1・isLatest true・totalAmount=subtotal 税抜）。 */
const SALES_ORDERS = [
  {
    clientCode: "CL-003",
    buyerOrderNumber: "EB-PO-27SS-014",
    title: `${SEASON} 初回発注`,
    orderDate: "2026-09-20",
    desiredDeliveryDate: "2027-03-12",
    status: "CONFIRMED",
    sourceType: "EMAIL",
    /** 品番ごとの単価 = その品番の PE の finalUnitPriceManualJpy */
    productNames: ["リネン開襟シャツ", "リネンワイドパンツ"],
  },
]

/**
 * production-estimates.ts 163-185 toCalcLine と同じ対応（FullItem 相当 → 計算入力）。
 * ここでは Prisma の createMany 入力（number 正規化前の値）から直接組む。
 */
type PeItemDraft = {
  key: string
  itemOrder: number
  itemCategory: "MATERIAL" | "LABOR"
  isSeparateBilling: boolean
  procurementRoute: "COMPANY_ARRANGED"
  itemName: string
  itemNameEn: string | null
  materialId: string | null
  costCategoryId: string | null
  source: "MANUAL" | "BOM"
  sourceBomItemId: string | null
  supplierId: string | null
  factoryId: string | null
  unitPrice: number | null
  currency: "JPY" | "USD" | "CNY" | "VND" | "EUR"
  usagePerUnit: number | null
  lossRate: number
  procurementMode: "ROLL" | "METER" | null
  rollLength: number | null
  rollPrice: number | null
  rollCurrency: "JPY" | "USD" | "CNY" | "VND" | "EUR" | null
  cutFee: number | null
  quantity: number | null
  unit: string | null
  presentedPriceManualJpy: number | null
  notes: string | null
}
function toCalcLine(f: PeItemDraft): ProductionEstimateLineForCalc {
  return {
    id: f.key,
    itemCategory: f.itemCategory,
    isSeparateBilling: f.isSeparateBilling,
    procurementRoute: f.procurementRoute,
    usagePerUnit: f.usagePerUnit,
    lossRate: f.lossRate,
    procurementMode: f.procurementMode,
    rollLength: f.rollLength,
    rollPrice: f.rollPrice,
    rollCurrency: f.rollCurrency,
    cutFee: f.cutFee,
    unitPrice: f.unitPrice,
    currency: f.currency,
    quantity: f.quantity,
    unit: f.unit,
    presentedPriceManualJpy: f.presentedPriceManualJpy,
  }
}
/** production-estimates.ts 79-81 dec と同じ（number → Decimal・null 保持）。 */
function dec(n: number | null): Prisma.Decimal | null {
  return n != null ? new Prisma.Decimal(n) : null
}
/** production-estimates.ts 188-223 toItemCreateBase と同じ対応（productionEstimateId・subtotal は呼び出し側）。 */
function toItemCreateBase(
  f: PeItemDraft,
): Omit<Prisma.ProductionEstimateItemCreateManyInput, "productionEstimateId" | "subtotal" | "subtotalJpy"> {
  return {
    itemOrder: f.itemOrder,
    itemCategory: f.itemCategory,
    isSeparateBilling: f.isSeparateBilling,
    procurementRoute: f.procurementRoute,
    itemName: f.itemName,
    itemNameEn: f.itemNameEn,
    materialId: f.materialId,
    costCategoryId: f.costCategoryId,
    source: f.source,
    sourcePoItemId: null,
    sourceWoItemId: null,
    sourceBomItemId: f.sourceBomItemId,
    supplierId: f.supplierId,
    factoryId: f.factoryId,
    contractorId: null,
    unitPrice: dec(f.unitPrice),
    currency: f.currency,
    usagePerUnit: dec(f.usagePerUnit),
    lossRate: new Prisma.Decimal(f.lossRate),
    procurementMode: f.procurementMode,
    rollLength: dec(f.rollLength),
    rollPrice: dec(f.rollPrice),
    rollCurrency: f.rollCurrency,
    cutFee: dec(f.cutFee),
    quantity: dec(f.quantity),
    unit: f.unit,
    presentedPriceManualJpy: dec(f.isSeparateBilling ? f.presentedPriceManualJpy : null),
    notes: f.notes,
  }
}

/**
 * sales-orders.ts 60-66 COUNTED_STATUSES ＋ 135-162 recomputeSkuOrderedQuantities と同じ集計。
 * CONFIRMED 以降・isLatest・deletedAt null の SoItem を SKU ごとに合計し、Sku.orderedQuantity / productionQuantity を書く
 * （0 件なら 0 を書く・D-13 の「受注の経路でしか受注数を入れない」を同じ規則で満たす）。
 */
const COUNTED_STATUSES = ["CONFIRMED", "IN_PRODUCTION", "PARTIAL_DELIVERED", "DELIVERED", "COMPLETED"] as const
async function recomputeSkuOrderedQuantities(
  tx: Prisma.TransactionClient,
  companyId: string,
  skuIds: string[],
): Promise<void> {
  const ids = [...new Set(skuIds.filter((v): v is string => !!v))]
  for (const skuId of ids) {
    const agg = await tx.soItem.aggregate({
      _sum: { orderedQuantity: true, productionQuantity: true },
      where: { skuId, so: { companyId, deletedAt: null, isLatest: true, status: { in: [...COUNTED_STATUSES] } } },
    })
    await tx.sku.update({
      where: { id: skuId },
      data: { orderedQuantity: agg._sum.orderedQuantity ?? 0, productionQuantity: agg._sum.productionQuantity ?? 0 },
    })
  }
}

// ─────────────────────────────────────────────────── 投入
async function main() {
  guardHost()

  const company: Company | null = await prisma.company.findFirst({ where: { tenantType: "MASTER_ADMIN" } })
  if (!company) throw new Error("MASTER_ADMIN tenant not found（先に prisma/seed.ts で company/user を投入してください）")
  const companyId = company.id
  const owner = await prisma.user.findFirst({ where: { companyId, role: "OWNER", deletedAt: null }, select: { id: true, email: true } })
  if (!owner) throw new Error("OWNER user not found")
  log(`Tenant: ${company.companyName} (${companyId}) / AuditLog userId: ${owner.email}\n`)

  // 参照マスター（既存・作らない）
  const categories = await prisma.productCategory.findMany({
    where: { companyId, deletedAt: null, categoryCode: { in: [...new Set(PRODUCTS.map((p) => p.categoryCode))] } },
    select: { id: true, categoryCode: true },
  })
  const categoryIdByCode = new Map(categories.map((c) => [c.categoryCode, c.id]))
  for (const p of PRODUCTS) {
    if (!categoryIdByCode.has(p.categoryCode)) throw new Error(`ProductCategory ${p.categoryCode} が無い`)
  }
  const colorNumbers = [...new Set(PRODUCTS.flatMap((p) => p.colorways.map((c) => c.colorNumber)))]
  const colors = await prisma.color.findMany({
    where: { companyId, deletedAt: null, colorNumber: { in: colorNumbers } },
    select: { id: true, colorNumber: true, colorName: true, hex: true },
  })
  const colorByNumber = new Map(colors.map((c) => [c.colorNumber, c]))
  for (const n of colorNumbers) {
    if (!colorByNumber.has(n)) throw new Error(`Color ${n} が無い`)
  }

  // --- Client ---
  log("=== Client ===")
  const clientIds: Record<string, string> = {}
  for (const r of CLIENTS) {
    clientIds[r.clientCode] = await getOrCreate(
      "Client",
      `${r.clientCode} ${r.companyName}`,
      () => prisma.client.findFirst({ where: { companyId, clientCode: r.clientCode, deletedAt: null }, select: { id: true } }),
      () =>
        prisma.client.create({
          data: {
            companyId,
            clientCode: r.clientCode,
            companyName: r.companyName,
            legalEntity: r.legalEntity,
            businessType: "APPAREL_BRAND",
            country: "JP",
            postalCode: r.postalCode,
            prefecture: r.prefecture,
            city: r.city,
            address: r.address,
            addressLine2: r.addressLine2,
            phone: r.phone,
            email: r.email,
            taxId: r.taxId,
            isQualifiedInvoiceIssuer: true,
            paymentTermType: "MONTHLY_CLOSING",
            closingDay: r.closingDay,
            paymentMonthOffset: r.paymentMonthOffset,
            paymentDay: r.paymentDay,
            taxRoundingMode: "TRUNCATE",
            assignedToUserId: owner.id,
            notes: r.notes,
            status: "ACTIVE",
          },
          select: { id: true },
        }),
    )
  }

  // --- Brand ---
  log("=== Brand ===")
  const brandIds: Record<string, string> = {}
  for (const r of BRANDS) {
    brandIds[r.brandCode] = await getOrCreate(
      "Brand",
      `${r.brandCode} ${r.brandName}`,
      () => prisma.brand.findFirst({ where: { companyId, brandCode: r.brandCode, deletedAt: null }, select: { id: true } }),
      () =>
        prisma.brand.create({
          data: { companyId, clientId: clientIds[r.clientCode], brandCode: r.brandCode, brandName: r.brandName, brandNameEn: r.brandNameEn },
          select: { id: true },
        }),
    )
  }

  // --- Supplier ---
  log("=== Supplier ===")
  const supplierIds: Record<string, string> = {}
  for (const r of SUPPLIERS) {
    supplierIds[r.supplierCode] = await getOrCreate(
      "Supplier",
      `${r.supplierCode} ${r.companyName}`,
      () => prisma.supplier.findFirst({ where: { companyId, supplierCode: r.supplierCode, deletedAt: null }, select: { id: true } }),
      () =>
        prisma.supplier.create({
          data: {
            companyId,
            supplierCode: r.supplierCode,
            companyName: r.companyName,
            companyNameEn: r.companyNameEn,
            supplierType: r.supplierType as never,
            country: "JP",
            postalCode: r.postalCode,
            prefecture: r.prefecture,
            city: r.city,
            address: r.address,
            phone: r.phone,
            email: r.email,
            notes: r.notes,
          },
          select: { id: true },
        }),
    )
  }

  // --- Material（Supplier FK 必須） ---
  log("=== Material ===")
  const materialIds: Record<string, string> = {}
  for (const r of MATERIALS) {
    materialIds[r.materialCode] = await getOrCreate(
      "Material",
      `${r.materialCode} ${r.materialName}`,
      () =>
        prisma.material.findFirst({
          where: { companyId, primarySupplierId: supplierIds[r.supplierCode], materialCode: r.materialCode, deletedAt: null },
          select: { id: true },
        }),
      () =>
        prisma.material.create({
          data: {
            companyId,
            materialCode: r.materialCode,
            materialName: r.materialName,
            materialNameEn: r.materialNameEn,
            materialType: r.materialType,
            primarySupplierId: supplierIds[r.supplierCode],
            unit: r.unit,
            unitPrice: new Prisma.Decimal(r.unitPrice),
            composition: r.composition ?? null,
            fabricWidth: r.fabricWidth != null ? new Prisma.Decimal(r.fabricWidth) : null,
            fabricWeight: r.fabricWeight != null ? new Prisma.Decimal(r.fabricWeight) : null,
            specification: r.specification ?? null,
            originCountry: "JP",
          },
          select: { id: true },
        }),
    )
  }

  // --- Factory (+ FactoryContact isPrimary) ---
  log("=== Factory ===")
  for (const r of FACTORIES) {
    const factoryId = await getOrCreate(
      "Factory",
      `${r.factoryCode} ${r.factoryName}`,
      () => prisma.factory.findFirst({ where: { companyId, factoryCode: r.factoryCode, deletedAt: null }, select: { id: true } }),
      () =>
        prisma.factory.create({
          data: {
            companyId,
            factoryCode: r.factoryCode,
            factoryName: r.factoryName,
            factoryNameEn: r.factoryNameEn,
            factoryTypes: r.factoryTypes as never,
            contractTypes: r.contractTypes as never,
            country: r.country,
            postalCode: r.postalCode ?? null,
            prefecture: r.prefecture ?? null,
            city: r.city,
            address: r.address,
            addressEn: r.addressEn ?? null,
            phone: r.phone,
            email: r.email,
            preferredLanguage: r.preferredLanguage as never,
            preferredCurrency: r.preferredCurrency as never,
            timezone: r.timezone,
            monthlyCapacity: r.monthlyCapacity,
            minimumOrderQty: r.minimumOrderQty,
            averageLeadTimeDays: r.averageLeadTimeDays,
            notes: r.notes,
          },
          select: { id: true },
        }),
    )
    await getOrCreate(
      "FactoryContact",
      `${r.factoryCode} ${r.contact.displayName}`,
      () =>
        prisma.factoryContact.findFirst({
          where: { companyId, factoryId, lastName: r.contact.lastName, firstName: r.contact.firstName, deletedAt: null },
          select: { id: true },
        }),
      () =>
        prisma.factoryContact.create({
          data: {
            companyId,
            factoryId,
            firstName: r.contact.firstName,
            lastName: r.contact.lastName,
            displayName: r.contact.displayName,
            jobTitle: r.contact.jobTitle,
            email: r.contact.email,
            isPrimary: true,
          },
          select: { id: true },
        }),
    )
  }

  // --- Product (+ ModelCode + StatusHistory) → Colorway → Sku → Bom → BomItem(+Colorway) → Comment ---
  const productIdByName = new Map<string, string>()
  for (const p of PRODUCTS) {
    log(`\n=== 品番: ${p.brandCode} ${p.productName} ===`)
    const brandId = brandIds[p.brandCode]
    const categoryId = categoryIdByCode.get(p.categoryCode)!
    const codePrefix = `${p.brandCode.toUpperCase()}-${SEASON.toUpperCase()}-${p.categoryCode.toUpperCase()}-`
    const modelPrefix = `M-${p.brandCode.toUpperCase()}-`

    // D-12: 冪等キーは (companyId, brandId, productName, deletedAt null)
    const productId = await getOrCreate(
      "Product",
      `${codePrefix}NNN ${p.productName}`,
      () => prisma.product.findFirst({ where: { companyId, brandId, productName: p.productName, deletedAt: null }, select: { id: true } }),
      async () => {
        // createProduct と同じ: ModelCode 自動発番 → Product 採番 → patternNumber=productCode → StatusHistory、同一 tx・P2002 で最大3回
        let created: { id: string; productCode: string } | null = null
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            created = await prisma.$transaction(async (tx) => {
              const modelCode = await nextNumbered(modelPrefix, 4, async () => {
                const last = await tx.modelCode.findFirst({ where: { companyId, modelCode: { startsWith: modelPrefix } }, orderBy: { modelCode: "desc" }, select: { modelCode: true } })
                return last?.modelCode ?? null
              })
              const newModelCode = await tx.modelCode.create({
                data: { companyId, modelCode, brandId, modelName: p.productName, categoryId, status: "ACTIVE" },
                select: { id: true },
              })
              const productCode = await nextNumbered(codePrefix, 3, async () => {
                const last = await tx.product.findFirst({ where: { companyId, productCode: { startsWith: codePrefix } }, orderBy: { productCode: "desc" }, select: { productCode: true } })
                return last?.productCode ?? null
              })
              const expectedQuantity = p.colorways.reduce((a, c) => a + c.total, 0)
              const product = await tx.product.create({
                data: {
                  companyId,
                  productCode,
                  clientProductCode: p.clientProductCode,
                  modelCodeId: newModelCode.id,
                  clientId: clientIds[BRANDS.find((b) => b.brandCode === p.brandCode)!.clientCode],
                  brandId,
                  categoryId,
                  productName: p.productName,
                  productNameEn: p.productNameEn,
                  description: p.description,
                  silhouette: p.silhouette,
                  season: SEASON,
                  seasonType: SEASON_TYPE,
                  year: YEAR,
                  expectedQuantity,
                  desiredDeliveryDate: new Date(p.desiredDeliveryDate),
                  assignedToUserId: owner.id,
                  internalNotes: p.internalNotes,
                  status: p.status as never,
                  sewingInstructions: p.sewingInstructions ? (p.sewingInstructions as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
                },
                select: { id: true, productCode: true },
              })
              // D-10 / B-054 D-13: この実行で作った ModelCode にだけ patternNumber を書く
              await tx.modelCode.update({ where: { id: newModelCode.id }, data: { patternNumber: product.productCode } })
              await tx.productStatusHistory.create({
                data: { productId: product.id, fromStatus: null, toStatus: p.status as never, changedByUserId: owner.id, changeReason: "品番カルテ新規作成" },
              })
              return product
            })
            break
          } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue
            throw e
          }
        }
        if (!created) throw new Error(`採番衝突が解消されない: ${p.productName}`)
        await audit(companyId, owner.id, "Product", created.id, { productCode: created.productCode, productName: p.productName, season: SEASON }, `品番新規作成（デモ）: ${created.productCode}`)
        log(`         → ${created.productCode}`)
        return created
      },
    )

    productIdByName.set(p.productName, productId)

    // --- ProductColorway（createColorway と同じ形） ---
    const colorwayIdByCode: Record<string, string> = {}
    for (const [i, c] of p.colorways.entries()) {
      const color = colorByNumber.get(c.colorNumber)!
      colorwayIdByCode[c.code] = await getOrCreate(
        "ProductColorway",
        `${p.productName} ${c.code} ${color.colorName}`,
        () => prisma.productColorway.findFirst({ where: { productId, colorwayCode: c.code, deletedAt: null }, select: { id: true } }),
        async () => {
          const cw = await prisma.productColorway.create({
            data: {
              companyId,
              productId,
              colorwayCode: c.code,
              colorwayName: color.colorName,
              clientColorName: c.clientColorName,
              colorId: color.id,
              colorHex: color.hex,
              sortOrder: i,
              status: "ACTIVE",
            },
            select: { id: true },
          })
          await audit(companyId, owner.id, "ProductColorway", cw.id, { productId, colorwayCode: c.code, colorwayName: color.colorName, clientColorName: c.clientColorName, status: "ACTIVE" }, `カラー展開（デモ）: ${p.productName} ${c.code}`)
          return cw
        },
      )
    }

    // --- Sku（createSkusForProduct と同じ skuCode 規則。orderedQuantity 0・productionQuantity のみ入れる: D-13） ---
    const skuCreatedBefore = stats.get("Sku")?.created ?? 0
    const productCodeRow = DRY_RUN && productId.startsWith("dry:") ? null : await prisma.product.findFirst({ where: { id: productId }, select: { productCode: true } })
    const productCodeForSku = productCodeRow?.productCode ?? `${codePrefix}NNN`
    for (const c of p.colorways) {
      const color = colorByNumber.get(c.colorNumber)!
      for (const sz of SIZES) {
        const skuCode = `${productCodeForSku}-${c.code}-${sz.size}`
        const qty = Math.round(c.total * sz.weight)
        await getOrCreate(
          "Sku",
          `${skuCode} ×${qty}`,
          () => prisma.sku.findFirst({ where: { companyId, skuCode, deletedAt: null }, select: { id: true } }),
          () =>
            prisma.sku.create({
              data: {
                companyId,
                productId,
                skuCode,
                colorwayId: colorwayIdByCode[c.code],
                colorCode: c.code,
                colorName: color.colorName,
                colorHex: color.hex,
                size: sz.size,
                sizeOrder: sz.sizeOrder,
                orderedQuantity: 0,
                productionQuantity: qty,
              },
              select: { id: true },
            }),
        )
      }
    }
    const skuCreated = (stats.get("Sku")?.created ?? 0) - skuCreatedBefore
    // createSkusForProduct と同じく生成 1 回につき AuditLog 1 件。全部スキップ（2回目の実行）なら書かない
    if (skuCreated > 0) {
      await audit(companyId, owner.id, "Sku", productId, { action: "generate_skus", colorways: p.colorways.length, sizes: SIZES.length, count: p.colorways.length * SIZES.length }, `SKU 生成（デモ）: ${p.productName}`)
    }

    // --- Bom（createBom と同じ: product ごとに live BOM 1本・version "1"） ---
    const bomId = await getOrCreate(
      "Bom",
      `${p.productName} v1`,
      () => prisma.bom.findFirst({ where: { companyId, productId, deletedAt: null }, select: { id: true } }),
      async () => {
        const b = await prisma.bom.create({ data: { companyId, productId, version: "1" }, select: { id: true } })
        await audit(companyId, owner.id, "Bom", b.id, { productId, version: "1" }, `BOM 作成（デモ）: ${p.productName}`)
        return b
      },
    )

    // --- BomItem（addBomItem と同じ形・itemOrder は末尾＋1。冪等キーは (bomId, materialId or customMaterialName)） ---
    for (const row of p.bom) {
      const label = row.materialCode ? MATERIALS.find((m) => m.materialCode === row.materialCode)!.materialName : row.customMaterialName!
      const materialId = row.materialCode ? materialIds[row.materialCode] : null
      const bomItemId = await getOrCreate(
        "BomItem",
        `${p.productName} / ${label}`,
        () =>
          bomId.startsWith("dry:")
            ? Promise.resolve(null)
            : prisma.bomItem.findFirst({
                where: materialId ? { bomId, materialId } : { bomId, customMaterialName: row.customMaterialName },
                select: { id: true },
              }),
        async () => {
          const last = await prisma.bomItem.findFirst({ where: { bomId }, orderBy: { itemOrder: "desc" }, select: { itemOrder: true } })
          const itemOrder = (last?.itemOrder ?? -1) + 1
          const it = await prisma.bomItem.create({
            data: {
              bomId,
              itemOrder,
              itemCategory: row.itemCategory as never,
              materialId,
              customMaterialName: materialId ? null : row.customMaterialName ?? null,
              supplierId: supplierIds[row.supplierCode],
              usagePerUnit: new Prisma.Decimal(row.usagePerUnit),
              unit: row.unit,
              lossRate: new Prisma.Decimal(row.lossRate),
              procurementMode: row.procurementMode ?? null,
              usageSource: "MANUAL",
              unitPrice: new Prisma.Decimal(row.unitPrice),
              supplierItemCode: row.supplierItemCode ?? null,
              specification: row.specification ?? null,
              notes: row.notes ?? null,
            },
            select: { id: true },
          })
          await audit(companyId, owner.id, "BomItem", it.id, { bomId, itemCategory: row.itemCategory, materialId, customMaterialName: materialId ? null : row.customMaterialName ?? null }, `BOM 明細（デモ）: ${p.productName} / ${label}`)
          return it
        },
      )
      // --- BomItemColorway（生地行だけ・カラーウェイごとの調達カラー） ---
      if (row.perColorway) {
        for (const c of p.colorways) {
          const productColorwayId = colorwayIdByCode[c.code]
          await getOrCreate(
            "BomItemColorway",
            `${label} × ${c.code} ${c.supplierColorCode}`,
            () =>
              bomItemId.startsWith("dry:") || productColorwayId.startsWith("dry:")
                ? Promise.resolve(null)
                : prisma.bomItemColorway.findFirst({ where: { bomItemId, productColorwayId }, select: { id: true } }),
            () =>
              prisma.bomItemColorway.create({
                data: { bomItemId, productColorwayId, supplierColorCode: c.supplierColorCode, supplierColorName: c.supplierColorName },
                select: { id: true },
              }),
          )
        }
      }
    }

    // --- Comment（createProductComment と同じ形: attachedToType "product"・PLAIN・authorRole OWNER） ---
    for (const content of p.comments) {
      await getOrCreate(
        "Comment",
        `${p.productName} / ${content.slice(0, 24)}…`,
        () =>
          productId.startsWith("dry:")
            ? Promise.resolve(null)
            : prisma.comment.findFirst({ where: { companyId, attachedToType: "product", attachedToId: productId, content, deletedAt: null }, select: { id: true } }),
        async () => {
          const cm = await prisma.comment.create({
            data: { companyId, attachedToType: "product", attachedToId: productId, content, contentFormat: "PLAIN", authorUserId: owner.id, authorRole: "OWNER" },
            select: { id: true },
          })
          await audit(companyId, owner.id, "Comment", cm.id, { action: "create_product_comment", productId, content }, `メモ（デモ）: ${p.productName}`)
          return cm
        },
      )
    }
  }

  // ─────────────────────────────────────────────── 量産見積（Comment の後・SO の前）
  // 画面の createProductionEstimateFromSample（production-estimates.ts 339-676）と同じ対応:
  //   (c) 明細 → FullItem[]（ここでは BOM 行 source BOM ＋ 工賃 source MANUAL）
  //   → computeProductionEstimate（565-570）→ tx 内で採番（581）・ヘッダ create（586-601）・明細 createMany（602-612）
  //   → AuditLog CREATE / ProductionEstimate（639-654 と同じ afterData ＋ source）
  const factoryIdByCode = new Map<string, string>()
  for (const f of await prisma.factory.findMany({ where: { companyId, factoryCode: { in: [...new Set(PRODUCTION_ESTIMATES.flatMap((d) => d.labor.map((l) => l.factoryCode)))] }, deletedAt: null }, select: { id: true, factoryCode: true } })) {
    factoryIdByCode.set(f.factoryCode, f.id)
  }
  const pePrefix = `PE-${new Date().getFullYear()}-` // estimateNumberPrefix（83-85）
  const finalUnitPriceByProductName = new Map<string, number>()
  for (const d of PRODUCTION_ESTIMATES) {
    finalUnitPriceByProductName.set(d.productName, d.finalUnitPriceManualJpy)
    const productId = productIdByName.get(d.productName)
    if (!productId) throw new Error(`品番が無い: ${d.productName}`)
    log(`\n=== 量産見積: ${d.productName} ===`)
    const peCreatedBefore = stats.get("ProductionEstimate")?.created ?? 0
    await getOrCreate(
      "ProductionEstimate",
      `${d.productName} / ${d.title}`,
      () =>
        productId.startsWith("dry:")
          ? Promise.resolve(null)
          : prisma.productionEstimate.findFirst({ where: { companyId, productId, title: d.title, deletedAt: null }, select: { id: true } }),
      async () => {
        // (c) BOM 既定値 → MATERIAL 行（ヘッダは live BOM 1 本・createdAt desc は 420-424 と同じ）
        const bom = await prisma.bom.findFirst({ where: { productId, companyId, deletedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true } })
        if (!bom) throw new Error(`BOM が無い: ${d.productName}`)
        const bomItems = await prisma.bomItem.findMany({ where: { bomId: bom.id }, orderBy: { itemOrder: "asc" } })
        const materialIdsInBom = [...new Set(bomItems.map((b) => b.materialId).filter((x): x is string => x !== null))]
        const materials = materialIdsInBom.length
          ? await prisma.material.findMany({ where: { id: { in: materialIdsInBom }, companyId }, select: { id: true, materialName: true, materialNameEn: true, rollLength: true, rollPrice: true, currency: true } })
          : []
        const materialById = new Map(materials.map((m) => [m.id, m]))
        // (d) 見積数量＝Σ Sku.productionQuantity（455-462）
        const skus = await prisma.sku.findMany({ where: { productId, companyId }, select: { productionQuantity: true } })
        const estimateQuantity = skus.reduce((s, r) => s + r.productionQuantity, 0)

        const drafts: PeItemDraft[] = []
        let order = 0
        for (const b of bomItems) {
          const mat = b.materialId ? materialById.get(b.materialId) : undefined
          const isRoll = b.procurementMode === "ROLL"
          drafts.push({
            key: String(order),
            itemOrder: order,
            itemCategory: "MATERIAL",
            isSeparateBilling: false,
            procurementRoute: "COMPANY_ARRANGED",
            itemName: mat?.materialName ?? b.customMaterialName ?? "（品目名未設定）",
            itemNameEn: mat?.materialNameEn ?? b.customMaterialNameEn ?? null,
            materialId: b.materialId,
            costCategoryId: null,
            source: "BOM",
            sourceBomItemId: b.id,
            supplierId: b.supplierId,
            factoryId: null,
            unitPrice: b.unitPrice != null ? Number(b.unitPrice) : null,
            currency: b.currency,
            // 案A（489-498）: MATERIAL 行は所要量ベース。BOM 既定があれば優先、無ければ usagePerUnit=1・lossRate=0
            usagePerUnit: b.usagePerUnit != null ? Number(b.usagePerUnit) : 1,
            lossRate: Number(b.lossRate),
            procurementMode: b.procurementMode,
            rollLength: isRoll && mat?.rollLength != null ? Number(mat.rollLength) : null,
            rollPrice: isRoll && mat?.rollPrice != null ? Number(mat.rollPrice) : null,
            rollCurrency: isRoll ? mat?.currency ?? null : null,
            cutFee: null,
            // BOM 由来は購入数量を持たない（PoItem.quantity 相当が無い）。計算は usagePerUnit ベースで quantity を使わない
            quantity: null,
            unit: b.unit,
            presentedPriceManualJpy: null,
            notes: null,
          })
          order++
        }
        for (const l of d.labor) {
          const factoryId = factoryIdByCode.get(l.factoryCode)
          if (!factoryId) throw new Error(`Factory ${l.factoryCode} が無い`)
          drafts.push({
            key: String(order),
            itemOrder: order,
            itemCategory: "LABOR",
            isSeparateBilling: false,
            procurementRoute: "COMPANY_ARRANGED",
            itemName: l.itemName,
            itemNameEn: null,
            materialId: null,
            costCategoryId: null,
            source: "MANUAL",
            sourceBomItemId: null,
            supplierId: null,
            factoryId,
            unitPrice: l.unitPrice,
            currency: "JPY",
            usagePerUnit: null,
            lossRate: 0,
            procurementMode: null,
            rollLength: null,
            rollPrice: null,
            rollCurrency: null,
            cutFee: null,
            // dev 既存 PE の LABOR 行と同じ持ち方（quantity=見積数量・unit 枚 → 単価×数量）
            quantity: estimateQuantity,
            unit: "枚",
            presentedPriceManualJpy: null,
            notes: null,
          })
          order++
        }
        // 565-570: 画面と同じ計算（exchangeRate は null）
        const calc = computeProductionEstimate(drafts.map(toCalcLine), estimateQuantity, d.marginRate, null)
        const calcById = new Map(calc.rows.map((r) => [r.itemId, r]))

        let created: { id: string; estimateNumber: string } | null = null
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            created = await prisma.$transaction(async (tx) => {
              const estimateNumber = await nextNumbered(pePrefix, 4, async () => {
                const last = await tx.productionEstimate.findFirst({ where: { companyId, estimateNumber: { startsWith: pePrefix } }, orderBy: { estimateNumber: "desc" }, select: { estimateNumber: true } })
                return last?.estimateNumber ?? null
              })
              const header = await tx.productionEstimate.create({
                data: {
                  companyId,
                  estimateNumber,
                  productId,
                  sourceSampleProductionId: null,
                  title: d.title,
                  notes: d.notes,
                  estimateQuantity,
                  currency: "JPY",
                  exchangeRateUsdJpy: null,
                  marginRate: dec(d.marginRate),
                  marginRateSource: "MANUAL_OVERRIDE",
                  initialCostBillingMode: "SEPARATE",
                  autoUnitCostJpy: dec(calc.autoUnitCostJpy),
                  autoUnitPriceJpy: dec(calc.autoUnitPriceJpy),
                  finalUnitPriceManualJpy: dec(d.finalUnitPriceManualJpy),
                  createdByUserId: owner.id,
                },
                select: { id: true, estimateNumber: true },
              })
              await tx.productionEstimateItem.createMany({
                data: drafts.map((f) => {
                  const row = calcById.get(f.key)
                  return { ...toItemCreateBase(f), productionEstimateId: header.id, subtotal: dec(row?.subtotal ?? null), subtotalJpy: dec(row?.subtotalJpy ?? null) }
                }),
              })
              return header
            }, { timeout: 15000 })
            break
          } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue
            throw e
          }
        }
        if (!created) throw new Error(`採番衝突が解消されない: PE ${d.productName}`)
        await audit(companyId, owner.id, "ProductionEstimate", created.id, {
          estimateNumber: created.estimateNumber,
          productId,
          sourceSampleProductionId: null,
          estimateQuantity,
          itemCount: drafts.length,
          autoUnitCostJpy: calc.autoUnitCostJpy,
          autoUnitPriceJpy: calc.autoUnitPriceJpy,
        }, `量産見積（デモ）: ${created.estimateNumber} ${d.productName}`)
        log(`         → ${created.estimateNumber}  qty=${estimateQuantity} autoCost=${calc.autoUnitCostJpy} autoPrice=${calc.autoUnitPriceJpy} items=${drafts.length}`)
        return created
      },
    )
    // 明細は PE と同じ tx で作る（画面と同じ）。集計は行数（BOM 行数＋工賃行数）だけ別に出す。
    {
      const bom = productId.startsWith("dry:") ? null : await prisma.bom.findFirst({ where: { productId, companyId, deletedAt: null }, select: { _count: { select: { items: true } } } })
      const n = (bom?._count.items ?? 0) + d.labor.length
      const justCreated = (stats.get("ProductionEstimate")?.created ?? 0) !== peCreatedBefore
      for (let i = 0; i < n; i++) bump("ProductionEstimateItem", justCreated ? "created" : "skipped")
      log(`  ${justCreated ? "CREATE" : "skip  "} ${"ProductionEstimateItem".padEnd(20)} ${d.productName} × ${n} 行`)
    }
  }

  // ─────────────────────────────────────────────── 受注（PE の後）
  // 画面の createSalesOrder（sales-orders.ts 464-600）と同じ対応:
  //   buildAndValidateItems（200-261: 単価は品番単位・小計=単価×数量・productionQuantity=computeProductionQuantity）
  //   → sumSubtotals（263-268）→ tx 内で採番（496）・ヘッダ create（500-529）・SoItem createMany（530-546）
  //   → recomputeSkuOrderedQuantities（547-552）→ AuditLog CREATE / SalesOrder（582-595 と同じ afterData ＋ source）
  //   status CONFIRMED のため、updateSalesOrderStatus（747-808）が入れる confirmedAt / confirmedByUserId も同じ値で入れる。
  for (const so of SALES_ORDERS) {
    const clientId = clientIds[so.clientCode]
    log(`\n=== 受注: ${so.clientCode} ${so.buyerOrderNumber} ===`)
    // 品番ブロック（SKU は skuCode 順・現在の productionQuantity を受注数にする）
    type SoRow = { skuId: string; skuCode: string; orderedQuantity: number; unitPrice: Prisma.Decimal; subtotal: Prisma.Decimal; productionQuantity: number }
    const rows: SoRow[] = []
    for (const name of so.productNames) {
      const productId = productIdByName.get(name)
      if (!productId) throw new Error(`品番が無い: ${name}`)
      const unitPriceNum = finalUnitPriceByProductName.get(name)
      if (unitPriceNum == null) throw new Error(`単価（PE の finalUnitPriceManualJpy）が無い: ${name}`)
      const skus = productId.startsWith("dry:") ? [] : await prisma.sku.findMany({ where: { companyId, productId, deletedAt: null }, orderBy: { skuCode: "asc" }, select: { id: true, skuCode: true, productionQuantity: true } })
      for (const s of skus) {
        const unitPrice = new Prisma.Decimal(unitPriceNum)
        // 既定の歩留まり（validator: yieldMode QUANTITY・yieldQuantity null → +0）
        const productionQuantity = computeProductionQuantity(s.productionQuantity, "QUANTITY", null, null)
        rows.push({ skuId: s.id, skuCode: s.skuCode, orderedQuantity: s.productionQuantity, unitPrice, subtotal: unitPrice.mul(s.productionQuantity), productionQuantity })
      }
    }
    const totalQuantity = rows.reduce((s, r) => s + r.orderedQuantity, 0)
    const subtotal = rows.reduce((s, r) => s.add(r.subtotal), new Prisma.Decimal(0))
    const soPrefix = `SO-${new Date().getFullYear()}-` // salesOrderNumberPrefix（68-70）
    const before = stats.get("SalesOrder")?.created ?? 0
    await getOrCreate(
      "SalesOrder",
      `${so.clientCode} / ${so.buyerOrderNumber}`,
      () =>
        clientId.startsWith("dry:")
          ? Promise.resolve(null)
          : prisma.salesOrder.findFirst({ where: { companyId, clientId, buyerOrderNumber: so.buyerOrderNumber, deletedAt: null }, select: { id: true } }),
      async () => {
        if (rows.length === 0) throw new Error("SKU が 0 件（受注明細を作れない）")
        const now = new Date()
        let created: { id: string; soNumber: string } | null = null
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            created = await prisma.$transaction(async (tx) => {
              const soNumber = await nextNumbered(soPrefix, 4, async () => {
                const last = await tx.salesOrder.findFirst({ where: { companyId, soNumber: { startsWith: soPrefix } }, orderBy: { soNumber: "desc" }, select: { soNumber: true } })
                return last?.soNumber ?? null
              })
              const header = await tx.salesOrder.create({
                data: {
                  companyId,
                  soNumber,
                  productId: null, // D-3: 品番は SoItem→Sku で辿る
                  clientId,
                  buyerId: null,
                  sourceType: so.sourceType as never,
                  buyerOrderNumber: so.buyerOrderNumber,
                  orderDate: new Date(so.orderDate),
                  desiredDeliveryDate: new Date(so.desiredDeliveryDate),
                  currency: "JPY",
                  title: so.title,
                  internalNotes: null,
                  buyerSpecialRequests: null,
                  status: so.status as never,
                  originalFiles: [],
                  version: 1,
                  isLatest: true,
                  totalQuantity,
                  subtotal,
                  totalAmount: subtotal, // §1-1: 税抜合計
                  createdByUserId: owner.id,
                  // updateSalesOrderStatus（765-772）が CONFIRMED 時に入れる列
                  ...(so.status === "CONFIRMED" ? { confirmedAt: now, confirmedByUserId: owner.id } : {}),
                },
                select: { id: true, soNumber: true },
              })
              await tx.soItem.createMany({
                data: rows.map((r) => ({
                  soId: header.id,
                  skuId: r.skuId,
                  orderedQuantity: r.orderedQuantity,
                  unitPrice: r.unitPrice,
                  subtotal: r.subtotal,
                  currency: "JPY",
                  moqStatus: "NOT_DETERMINED",
                  moqDecisionReason: null,
                  yieldMode: "QUANTITY",
                  yieldRate: null,
                  yieldQuantity: null,
                  productionQuantity: r.productionQuantity,
                })),
              })
              await recomputeSkuOrderedQuantities(tx, companyId, rows.map((r) => r.skuId))
              return header
              // 画面（createSalesOrder）は timeout 15000。ここはリモート proxy 越しに SKU 28 件 × 2 往復するため
              // 15 秒を超えて P2028 になった（dev 実測）。集計規則は同じまま、待ち時間だけ伸ばす。
            }, { maxWait: 30000, timeout: 180000 })
            break
          } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue
            throw e
          }
        }
        if (!created) throw new Error(`採番衝突が解消されない: SO ${so.buyerOrderNumber}`)
        await audit(companyId, owner.id, "SalesOrder", created.id, {
          soNumber: created.soNumber,
          clientId,
          status: so.status,
          itemCount: rows.length,
          totalQuantity,
        }, `受注（デモ）: ${created.soNumber} ${so.title}`)
        log(`         → ${created.soNumber}  status=${so.status} totalQuantity=${totalQuantity} totalAmount=${subtotal.toString()} items=${rows.length}`)
        return created
      },
    )
    const justCreated = (stats.get("SalesOrder")?.created ?? 0) !== before
    for (const r of rows) {
      bump("SoItem", justCreated ? "created" : "skipped")
      log(`  ${justCreated ? "CREATE" : "skip  "} ${"SoItem".padEnd(20)} ${r.skuCode} × ${r.orderedQuantity} @ ${r.unitPrice.toString()}`)
    }
  }

  // --- サマリ ---
  console.log(`\n======== ${DRY_RUN ? "作成予定（--dry-run・DB には書いていない）" : "投入結果"} サマリ ========`)
  const masters = [...stats.keys()].sort()
  for (const m of masters) {
    const s = stats.get(m)!
    console.log(`${m.padEnd(20)} created=${String(s.created).padStart(3)}  skipped=${String(s.skipped).padStart(3)}  total=${s.created + s.skipped}`)
  }
  const totalCreated = masters.reduce((a, m) => a + stats.get(m)!.created, 0)
  const totalSkipped = masters.reduce((a, m) => a + stats.get(m)!.skipped, 0)
  console.log(`${"—".repeat(20)} created=${String(totalCreated).padStart(3)}  skipped=${String(totalSkipped).padStart(3)}`)
  console.log(DRY_RUN ? "\n（--dry-run）実投入は --dry-run を外して再実行" : "\n🎉 dev デモデータ投入 完了")
}

main()
  .catch((e) => {
    console.error(`[${SOURCE}] FATAL:`, e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
