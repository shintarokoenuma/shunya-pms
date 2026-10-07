#!/usr/bin/env tsx
/**
 * B-267（§2-4）: 縫製仕様書 PDF の試し刷り（★DB に触れない・repo は変えない）。
 *
 * 使い方: npx tsx scripts/render-sewing-spec-sample.tsx [出力フォルダ]（既定 /tmp/b267-sewing-spec-sample）
 * - 手作りの SewingSpecPdfData（長い指示・長い仕様・長い仕入先名・長い品番・20行の付属・色5つ）を SewingSpecDocument に渡す
 * - ケースごとに PDF を出し、PDF のページ数がページの計画（planSewingSpecPdf）と一致することを確かめる。合わなければ exit 1（B-267 D-7）
 * - 絵型は環境変数 SKETCH_JPG の JPEG（無ければ 1×1 の JPEG を埋め込む）
 * - 埋め込みフォントの名前・画像での目視は別の手順（pypdf / sips）で行う
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"
import type {
  SewingSpecAccessoryRow,
  SewingSpecInstruction,
  SewingSpecPage,
  SewingSpecPdfData,
  SewingSpecSketch,
} from "../src/lib/pdf/sewing-spec-data"
import { planSewingSpecPdf, renderSewingSpecPdfBuffer } from "../src/lib/pdf/render"

const OUT_DIR = process.argv[2] ?? "/tmp/b267-sewing-spec-sample"

// 1×1 のグレーの JPEG（SKETCH_JPG が無いときの代わり）
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64",
)

function sketch(caption: string | null, sortOrder = 0): SewingSpecSketch {
  const p = process.env.SKETCH_JPG
  const data = p && existsSync(p) ? readFileSync(p) : TINY_JPEG
  return { image: { data, format: "jpg" }, caption, sortOrder }
}

const LONG_JP =
  "身頃と袖は本縫い 1.0cm で縫い合わせ、縫い代は2枚一緒にロックをかけて後ろ身頃側へ倒す。裾は三つ折りにして 1.5cm のステッチ、前立ては接着芯 ST-2210-W を貼ってから 0.1cm のコバステッチを入れる。糸は地色 #60 を2本取り。"
const LABELS: [SewingSpecInstruction["key"], string][] = [
  ["namePosition", "ネーム位置"], ["careLabelPosition", "洗濯ネーム位置"], ["finishingMethod", "仕上げ方法"], ["postProcessing", "製品後加工"],
  ["hangTag", "下げ札"], ["lining", "裏"], ["thread", "糸"], ["stitch", "ステッチ（番手）"], ["patternMatching", "柄合わせ"], ["insertion", "差し込み"], ["fabricDirection", "生地方向"],
]
const SHORT_INSTRUCTIONS: SewingSpecInstruction[] = [
  { key: "namePosition", label: "ネーム位置", value: "CB衿ぐり付け〜3.0cm下" },
  { key: "finishingMethod", label: "仕上げ方法", value: "製品洗い後にプレス仕上げ。畳みは A4 サイズに統一し、OPP 袋に入れる" },
  { key: "postProcessing", label: "製品後加工", value: "ワンウォッシュ（柔軟剤なし）" },
  { key: "hangTag", label: "下げ札", value: "第2ボタンに糸ループで取り付け。下げ札は HT-ETB-27SS を使用" },
  { key: "insertion", label: "差し込み", value: "一方向" },
]
const COLORS5 = ["BLACK", "WHITE", "NAVY", "KHAKI GREEN", "ECRU"]

function acc(i: number, colored: boolean, long = false): SewingSpecAccessoryRow {
  return {
    part: long ? `前立て・見返し・袖口（${i + 1}）` : `部位 ${i + 1}`,
    itemCode: long ? `SUP-ITEM-2026-${String(i + 1).padStart(4, "0")}-LONGCODE` : `HT-ETB-27SS-${i + 1}`,
    spec: long ? `第2ボタンに糸ループで取り付け。糸は地色 #60 を使い、ループの長さは 1.2cm に揃える（${i + 1}）` : `仕様 ${i + 1}`,
    colors: colored ? COLORS5.map((c) => `LC25-${String(i + 1).padStart(2, "0")} ${c}`) : [],
    commonColor: colored ? null : "C/#12",
    usage: long ? "12.5m 2.1kg/反 ×3" : "1 枚",
    supplier: long ? "株式会社ナイトウ繊維商事 大阪本社 資材部（担当 山田・TEL 06-0000-0000）" : "ナイトウ繊維",
  }
}

function page(kind: SewingSpecPage["kind"], sketches: SewingSpecSketch[], quantityMode: SewingSpecPage["quantityMode"] = "sku-matrix"): SewingSpecPage {
  return {
    kind,
    recipientName: "瀬戸内ソーイングラボ",
    contactName: "山田 太郎",
    plannedStartDate: "2026-10-20",
    expectedDeliveryDate: "2026-11-30",
    kindLabel: "量産",
    workType: kind === "process" ? "PRINTING" : "SEWING",
    workTypeLabel: kind === "process" ? "プリント" : "縫製",
    orderQuantity: 400,
    orderUnit: "枚",
    quantityMode,
    patternLabel: "2026-10-01 量産用",
    sketches,
  }
}

function base(partial: Partial<SewingSpecPdfData>): SewingSpecPdfData {
  return {
    issuer: {
      name: "株式会社シュンヤ", companyName: "シュンヤ", legalEntity: "株式会社シュンヤ", postalCode: "150-0001", address: "東京都渋谷区1-2-3",
      phone: "03-0000-0000", fax: "03-0000-0001", email: "info@example.test", website: null, taxId: null, bank: null,
    },
    productCode: "ETB-27SS-U-TP-001",
    productName: "ワイドパンツ 1800枚 ロングネームの品名テスト",
    brandName: "ETB",
    clientProductCode: "ETB-2027SS-0001",
    patternNumber: "PT-2026-0012",
    assignedToName: "確認用 生産管理",
    instructions: SHORT_INSTRUCTIONS,
    colorwayNames: COLORS5,
    accessories: [acc(0, true), acc(1, false), acc(2, true)],
    skuMatrix: {
      sizes: ["S", "M", "L", "XL"],
      rows: COLORS5.map((c, i) => ({ colorLabel: `${c} / LC25-${String(i + 1).padStart(2, "0")}`, cells: [10, 20, 30, 40], total: 100 })),
      colTotals: [50, 100, 150, 200],
      grandTotal: 500,
    },
    issuedDate: "2026-10-06",
    pages: [page("sewing", [sketch("前身頃（修正後）")])],
    ...partial,
  }
}

const CASES: { name: string; data: SewingSpecPdfData }[] = [
  { name: "01-short-3rows", data: base({}) },
  { name: "02-long-15rows", data: base({ accessories: Array.from({ length: 15 }, (_, i) => acc(i, i % 2 === 0, true)) }) },
  { name: "03-20rows", data: base({ accessories: Array.from({ length: 20 }, (_, i) => acc(i, i % 3 === 0, false)) }) },
  {
    name: "04-colorspec-spill",
    data: base({
      accessories: Array.from({ length: 14 }, (_, i) => ({ ...acc(i, true), colors: COLORS5.map((c) => `LC25-${String(i + 1).padStart(2, "0")} ${c} ミッドナイト（先方指定・ロット注意）`) })),
    }),
  },
  { name: "05-long-11instructions", data: base({ instructions: LABELS.map(([key, label]) => ({ key, label, value: LONG_JP + LONG_JP })), accessories: Array.from({ length: 20 }, (_, i) => acc(i, i % 2 === 0, true)) }) },
  {
    name: "06-measure-long",
    data: base({
      instructions: [
        { key: "finishingMethod", label: "仕上げ方法", value: LONG_JP.repeat(3) },
        { key: "postProcessing", label: "製品後加工", value: LONG_JP.repeat(3) },
        { key: "fabricDirection", label: "生地方向", value: "並。柄は上下方向をそろえる。耳の文字が読める向きを表とする。" },
      ],
      pages: [page("measure", [sketch("採寸位置", 0), sketch("サイズ表", 1)]), page("measure", [sketch("採寸位置", 0)])],
    }),
  },
  {
    name: "07-two-recipients-and-process",
    data: base({
      accessories: Array.from({ length: 15 }, (_, i) => acc(i, i % 2 === 0, true)),
      pages: [page("sewing", [sketch(null)]), page("sewing", [sketch(null)], "wo-total-only"), page("process", [sketch("プリント位置"), sketch("版下")])],
    }),
  },
]

function countPdfPages(buf: Buffer): number {
  return (buf.toString("latin1").match(/\/Type\s*\/Page(?![s])/g) ?? []).length
}

;(async () => {
  mkdirSync(OUT_DIR, { recursive: true })
  let ok = true
  for (const c of CASES) {
    const plan = await planSewingSpecPdf(c.data)
    const buf = await renderSewingSpecPdfBuffer(c.data, plan)
    const out = path.join(OUT_DIR, `${c.name}.pdf`)
    writeFileSync(out, buf)
    const actual = countPdfPages(buf)
    const planned = plan.pages.length
    const flag = actual === planned ? "OK" : "NG"
    if (flag === "NG") ok = false
    const summary = plan.pages
      .map((p) =>
        p.kind === "sewing-main"
          ? `main(instr ${p.instructionCount}, acc ${p.accessoryRange[0]}-${p.accessoryRange[1]}, cs ${p.colorSpec ? 1 : 0}, ${p.booklet.index}/${p.booklet.total})`
          : p.kind === "sewing-cont"
            ? `cont(instr ${p.instructionRange ? p.instructionRange.join("-") : "-"}, acc ${p.accessoryRange ? p.accessoryRange.join("-") : "-"}, cs ${p.colorSpec ? 1 : 0}, ${p.booklet.index}/${p.booklet.total})`
            : p.kind === "measure"
              ? `measure(first ${p.firstSketchHeight ?? "rest"})`
              : "process",
      )
      .join(" | ")
    console.log(`${flag} ${c.name}: planned=${planned} actual=${actual} bytes=${buf.length} ${out}\n    ${summary}`)
  }
  if (!ok) {
    console.error("STOP: ページ数が計画と一致しないケースがある（自動改ページが起きた可能性）")
    process.exit(1)
  }
  console.log("render-sewing-spec-sample: all page counts match the plan")
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
