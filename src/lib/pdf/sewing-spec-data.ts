import { prisma } from "@/lib/prisma"
import { loadSketchForPdf, type PdfImage } from "./sketch-image"
import {
  kindLabel,
  quantityMode,
  type SewingSpecPageSpec,
  type SewingSpecQuantityMode,
} from "./sewing-spec-format"
import {
  SEWING_DETAIL_ORDER,
  SEWING_FIXED_ORDER,
  SEWING_INSTRUCTION_LABELS,
  type SewingInstruction,
} from "@/lib/types/sewing-instruction"
import { PATTERN_WORK_TYPE_LABELS } from "@/lib/types/pattern-version"
import type { ProductSketch } from "@/lib/types/product-sketch"

/**
 * B-054 PR-4a: 縫製仕様書 PDF のデータ取得（order-data.ts と同じく server action は呼ばず prisma を直接引く）。
 * - 全クエリに companyId（と deletedAt: null）。BomItem は material / supplier の relation が無いので手動 join。
 * - 金額・用尺は Decimal のまま持ち、文字列化は表示の直前（この層の末尾）で toString() する。
 * - 4a は 1枚目（縫製工場用・workType=SEWING の WO 宛て）のみ。2・3枚目は 4b。
 * 仕様: docs/specs/b-054-b-146-spec-confirmation-v1_0-2026-09-20.md（D-1〜D-21）／addendum v0.1（D-22〜D-26）
 */

const SKETCH_MAX_EDGE = 1600 // addendum v0.1 D-25
const SKETCH_QUALITY = 85
export const SEWING_SPEC_MAX_ACCESSORY_ROWS = 15 // D-6
export const SEWING_SPEC_MAX_COLORWAYS = 5 // D-7

const DASH = "—"

export type SewingSpecInstruction = { label: string; value: string }

export type SewingSpecAccessoryRow = {
  part: string
  itemCode: string
  spec: string
  /** カラーウェイごとの色（colorwayNames と同じ長さ・順）。全色共通の行は空配列 */
  colors: string[]
  /** 色別の行が1つも無い行＝全色共通（BomItem.colorCode があれば併記） */
  commonColor: string | null
  usage: string
  supplier: string
}

export type SewingSpecSkuMatrix = {
  sizes: string[]
  rows: { colorLabel: string; cells: number[]; total: number }[]
  colTotals: number[]
  grandTotal: number
}

export type SewingSpecSketch = {
  image: PdfImage | null
  caption: string | null
  sortOrder: number
}

export type SewingSpecPage = {
  kind: "sewing"
  recipientName: string
  /** 主担当が居なければ null（紙面で行ごと省く） */
  contactName: string | null
  plannedStartDate: string
  expectedDeliveryDate: string
  kindLabel: string | null
  orderQuantity: number
  orderUnit: string
  quantityMode: SewingSpecQuantityMode
  patternLabel: string
  sketch: SewingSpecSketch | null
}

export type SewingSpecPdfData = {
  productCode: string
  clientProductCode: string
  patternNumber: string
  assignedToName: string
  instructions: SewingSpecInstruction[]
  colorwayNames: string[]
  accessories: SewingSpecAccessoryRow[]
  /** 15行を超えた分の件数（0 なら注記なし） */
  accessoriesOverflow: number
  skuMatrix: SewingSpecSkuMatrix | null
  issuedDate: string
  pages: SewingSpecPage[]
}

export type SewingSpecDataResult =
  | { ok: true; data: SewingSpecPdfData }
  | { ok: false; reason: "product-not-found" }
  | { ok: false; reason: "wo-invalid"; woId: string }
  | { ok: false; reason: "sketch-not-found"; woId: string; sortOrder: number }

function fmtDate(d: Date | null | undefined): string {
  if (!d) return DASH
  return new Date(d).toISOString().slice(0, 10)
}

/** JST の今日（YYYY-MM-DD）。コンテナ TZ 非依存（gcs.ts の timestampJst と同じ考え方）。 */
function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/**
 * 同梱の NotoSansJP サブセットに無い文字を、同じ意味でフォントにある文字へ置き換える（PDF 表示専用・DB は触らない）。
 * ★2026-09-21 fontTools 実測: U+FF5E（～ 全角チルダ）・U+203B（※）は cmap に無く、U+301C（〜）はある。
 *   縫製指示の既定候補（sewing-instruction.ts）と dev の値は U+FF5E を使っている。
 *   フォントの差し替えは発注書・見積書にも影響するため別番号で扱う。
 */
function pdfText(s: string): string {
  return s.replace(/～/g, "〜")
}

function personName(p: {
  displayName: string | null
  lastName: string
  firstName: string
}): string {
  return p.displayName ?? `${p.lastName} ${p.firstName}`
}

function readSketches(raw: unknown): ProductSketch[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (s): s is ProductSketch =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as ProductSketch).gcsPath === "string",
    )
    .map((s) => ({ ...s, sortOrder: typeof s.sortOrder === "number" ? s.sortOrder : 0 }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/** sewingInstructions(Json) から、値のある項目だけを SEWING_INSTRUCTION_LABELS の順で出す。 */
function readInstructions(raw: unknown): SewingSpecInstruction[] {
  if (typeof raw !== "object" || raw === null) return []
  const si = raw as Partial<SewingInstruction>
  const out: SewingSpecInstruction[] = []
  for (const k of SEWING_FIXED_ORDER) {
    const v = si.fixed?.[k]
    if (typeof v === "string" && v.trim()) out.push({ label: SEWING_INSTRUCTION_LABELS[k], value: pdfText(v) })
  }
  for (const k of SEWING_DETAIL_ORDER) {
    const v = si.sewing?.[k]
    if (typeof v === "string" && v.trim()) out.push({ label: SEWING_INSTRUCTION_LABELS[k], value: pdfText(v) })
  }
  return out
}

export async function getSewingSpecPdfData(
  productId: string,
  pages: SewingSpecPageSpec[],
  companyId: string,
): Promise<SewingSpecDataResult> {
  // ---------------------------------------------------------------- 品番（共通）
  const product = await prisma.product.findFirst({
    where: { id: productId, companyId, deletedAt: null },
    select: {
      productCode: true,
      clientProductCode: true,
      modelCodeId: true,
      assignedToUserId: true,
      sewingInstructions: true,
      sketchImages: true,
    },
  })
  if (!product) return { ok: false, reason: "product-not-found" }

  const [modelCode, assignedTo, colorways, skus, bom] = await Promise.all([
    prisma.modelCode.findFirst({
      where: { id: product.modelCodeId, companyId, deletedAt: null },
      select: { patternNumber: true },
    }),
    product.assignedToUserId
      ? prisma.user.findFirst({
          where: { id: product.assignedToUserId, companyId },
          select: { displayName: true, lastName: true, firstName: true },
        })
      : Promise.resolve(null),
    prisma.productColorway.findMany({
      where: { productId, companyId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { colorwayCode: "asc" }],
      select: { id: true, colorwayName: true },
    }),
    prisma.sku.findMany({
      where: { productId, companyId, deletedAt: null },
      orderBy: [{ colorway: { sortOrder: "asc" } }, { sizeOrder: "asc" }, { size: "asc" }],
      select: {
        colorwayId: true,
        colorCode: true,
        colorName: true,
        size: true,
        sizeOrder: true,
        productionQuantity: true,
      },
    }),
    prisma.bom.findFirst({
      where: { productId, companyId, deletedAt: null },
      select: { id: true },
    }),
  ])

  // ---------------------------------------------------------------- 付属（BOM）
  const shownColorways = colorways.slice(0, SEWING_SPEC_MAX_COLORWAYS)
  const colorwayNames = shownColorways.map((c) => c.colorwayName)
  let accessories: SewingSpecAccessoryRow[] = []
  let accessoriesOverflow = 0
  if (bom) {
    const items = await prisma.bomItem.findMany({
      where: { bomId: bom.id },
      orderBy: { itemOrder: "asc" },
      select: {
        id: true,
        materialId: true,
        customMaterialName: true,
        specification: true,
        supplierItemCode: true,
        supplierId: true,
        usagePerUnit: true,
        unit: true,
        colorCode: true,
      },
    })
    const shown = items.slice(0, SEWING_SPEC_MAX_ACCESSORY_ROWS)
    accessoriesOverflow = Math.max(0, items.length - shown.length)
    const materialIds = [...new Set(shown.map((i) => i.materialId).filter((v): v is string => !!v))]
    const supplierIds = [...new Set(shown.map((i) => i.supplierId).filter((v): v is string => !!v))]
    const [mats, sups, cwRows] = await Promise.all([
      materialIds.length
        ? prisma.material.findMany({
            where: { id: { in: materialIds }, companyId },
            select: { id: true, materialName: true },
          })
        : Promise.resolve([]),
      supplierIds.length
        ? prisma.supplier.findMany({
            where: { id: { in: supplierIds }, companyId },
            select: { id: true, companyName: true },
          })
        : Promise.resolve([]),
      shown.length
        ? prisma.bomItemColorway.findMany({
            where: { bomItemId: { in: shown.map((i) => i.id) } },
            select: {
              bomItemId: true,
              productColorwayId: true,
              supplierColorCode: true,
              supplierColorName: true,
            },
          })
        : Promise.resolve([]),
    ])
    const matName = new Map(mats.map((m) => [m.id, m.materialName]))
    const supName = new Map(sups.map((s) => [s.id, s.companyName]))
    const cwByItem = new Map<string, Map<string, string>>()
    for (const r of cwRows) {
      const m = cwByItem.get(r.bomItemId) ?? new Map<string, string>()
      m.set(
        r.productColorwayId,
        r.supplierColorName ? `${r.supplierColorCode} ${r.supplierColorName}` : r.supplierColorCode,
      )
      cwByItem.set(r.bomItemId, m)
    }
    accessories = shown.map((i) => {
      const perCw = cwByItem.get(i.id)
      const isCommon = !perCw || perCw.size === 0
      return {
        part:
          (i.materialId ? matName.get(i.materialId) : undefined) ??
          i.customMaterialName ??
          DASH,
        itemCode: i.supplierItemCode || DASH,
        spec: i.specification || DASH,
        colors: isCommon ? [] : shownColorways.map((c) => perCw.get(c.id) ?? DASH),
        commonColor: isCommon ? i.colorCode || null : null,
        // Decimal は float にせず、表示の直前にここで toString()
        usage: i.usagePerUnit ? `${i.usagePerUnit.toString()} ${i.unit}` : DASH,
        supplier: (i.supplierId ? supName.get(i.supplierId) : undefined) ?? DASH,
      }
    })
  }

  // ---------------------------------------------------------------- SKU の色×サイズ
  let skuMatrix: SewingSpecSkuMatrix | null = null
  if (skus.length > 0) {
    const sizeOrder = new Map<string, number>()
    for (const s of skus) if (!sizeOrder.has(s.size)) sizeOrder.set(s.size, s.sizeOrder)
    const sizes = [...sizeOrder.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([size]) => size)
    const rowMap = new Map<string, { colorLabel: string; cells: number[] }>()
    for (const s of skus) {
      const key = s.colorwayId
      const row = rowMap.get(key) ?? {
        colorLabel: `${s.colorCode} ${s.colorName}`,
        cells: sizes.map(() => 0),
      }
      row.cells[sizes.indexOf(s.size)] += s.productionQuantity
      rowMap.set(key, row)
    }
    // 色の行はカラーウェイの順（sortOrder → colorwayCode）＝付属の列と同じ並び。
    // ★SKU の orderBy（colorway.sortOrder）だけでは sortOrder が同値のとき並びが揃わない（dev 実測 A, C, B）
    const cwIndex = new Map(colorways.map((c, i) => [c.id, i]))
    const rows = [...rowMap.entries()]
      .sort(
        (a, b) =>
          (cwIndex.get(a[0]) ?? Number.MAX_SAFE_INTEGER) -
          (cwIndex.get(b[0]) ?? Number.MAX_SAFE_INTEGER),
      )
      .map(([, r]) => ({
        ...r,
        total: r.cells.reduce((a, b) => a + b, 0),
      }))
    const colTotals = sizes.map((_, j) => rows.reduce((a, r) => a + r.cells[j], 0))
    skuMatrix = {
      sizes,
      rows,
      colTotals,
      grandTotal: colTotals.reduce((a, b) => a + b, 0),
    }
  }

  // ---------------------------------------------------------------- ページ（宛先ごと）
  const sketches = readSketches(product.sketchImages)
  const sketchCache = new Map<string, Promise<PdfImage | null>>()
  const loadSketch = (gcsPath: string) => {
    let p = sketchCache.get(gcsPath)
    if (!p) {
      p = loadSketchForPdf(gcsPath, { maxEdge: SKETCH_MAX_EDGE, quality: SKETCH_QUALITY }).then(
        (r) => r.image,
      )
      sketchCache.set(gcsPath, p)
    }
    return p
  }

  const outPages: SewingSpecPage[] = []
  for (const spec of pages) {
    const wo = await prisma.workOrder.findFirst({
      where: {
        id: spec.woId,
        companyId,
        deletedAt: null,
        productId,
        workType: "SEWING", // 1枚目＝縫製工場用（D-1）
      },
      select: {
        factoryId: true,
        contractorId: true,
        workCategory: true,
        sampleRound: true,
        plannedStartDate: true,
        expectedDeliveryDate: true,
        patternVersionId: true,
        items: { orderBy: { itemOrder: "asc" }, select: { quantity: true, unit: true } },
      },
    })
    if (!wo) return { ok: false, reason: "wo-invalid", woId: spec.woId }

    // 絵型: 指定の sortOrder（省略時は最小の1枚）。指定の絵型が無ければ sketch-not-found
    let sketch: SewingSpecSketch | null = null
    const wanted = spec.sortOrders?.[0]
    if (wanted !== undefined) {
      const target = sketches.find((s) => s.sortOrder === wanted)
      if (!target) {
        return { ok: false, reason: "sketch-not-found", woId: spec.woId, sortOrder: wanted }
      }
      sketch = {
        image: await loadSketch(target.gcsPath),
        caption: target.caption ? pdfText(target.caption) : null,
        sortOrder: target.sortOrder,
      }
    } else if (sketches.length > 0) {
      const target = sketches[0]
      sketch = {
        image: await loadSketch(target.gcsPath),
        caption: target.caption ? pdfText(target.caption) : null,
        sortOrder: target.sortOrder,
      }
    }

    const [factory, contractor] = await Promise.all([
      wo.factoryId
        ? prisma.factory.findFirst({
            where: { id: wo.factoryId, companyId, deletedAt: null },
            select: { id: true, factoryName: true },
          })
        : Promise.resolve(null),
      wo.contractorId
        ? prisma.contractor.findFirst({
            where: { id: wo.contractorId, companyId, deletedAt: null },
            select: { id: true, contractorName: true },
          })
        : Promise.resolve(null),
    ])
    const contact = factory
      ? await prisma.factoryContact.findFirst({
          where: { factoryId: factory.id, companyId, isPrimary: true, deletedAt: null },
          select: { displayName: true, lastName: true, firstName: true },
        })
      : contractor
        ? await prisma.contractorContact.findFirst({
            where: { contractorId: contractor.id, companyId, isPrimary: true, deletedAt: null },
            select: { displayName: true, lastName: true, firstName: true },
          })
        : null

    // 型紙: WO の patternVersionId があればその行、無ければ型番の最新（receivedAt desc・nulls last）
    const pv = wo.patternVersionId
      ? await prisma.patternVersion.findFirst({
          where: { id: wo.patternVersionId, companyId, deletedAt: null },
          select: { receivedAt: true, workType: true },
        })
      : await prisma.patternVersion.findFirst({
          where: { modelCodeId: product.modelCodeId, companyId, deletedAt: null },
          orderBy: [{ receivedAt: { sort: "desc", nulls: "last" } }, { versionNumber: "desc" }],
          select: { receivedAt: true, workType: true },
        })

    outPages.push({
      kind: "sewing",
      recipientName:
        factory?.factoryName ?? contractor?.contractorName ?? "（発注先未設定）",
      contactName: contact ? personName(contact) : null,
      plannedStartDate: fmtDate(wo.plannedStartDate),
      expectedDeliveryDate: fmtDate(wo.expectedDeliveryDate),
      kindLabel: kindLabel(wo.workCategory, wo.sampleRound),
      orderQuantity: wo.items.reduce((a, it) => a + it.quantity, 0),
      orderUnit: wo.items[0]?.unit ?? "枚",
      quantityMode: quantityMode(wo.workCategory),
      patternLabel: pv
        ? `${fmtDate(pv.receivedAt)} ${PATTERN_WORK_TYPE_LABELS[pv.workType]}`
        : DASH,
      sketch,
    })
  }

  return {
    ok: true,
    data: {
      productCode: product.productCode,
      clientProductCode: product.clientProductCode || DASH,
      patternNumber: modelCode?.patternNumber || DASH,
      assignedToName: assignedTo ? personName(assignedTo) : DASH,
      instructions: readInstructions(product.sewingInstructions),
      colorwayNames,
      accessories,
      accessoriesOverflow,
      skuMatrix,
      issuedDate: todayJst(),
      pages: outPages,
    },
  }
}
