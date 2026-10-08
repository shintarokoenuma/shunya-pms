"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  CounterpartType,
  CostCategoryStatus,
  SupplierInvoiceMatchSource,
  SupplierInvoiceMatchStatus,
  SupplierInvoicePostingType,
  SupplierInvoiceRuleType,
  SupplierInvoiceSource,
} from "@prisma/client"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { checkArea } from "@/lib/area-access"
import { fromYmd, toYmd } from "@/lib/calc/invoice-period"
import {
  buildProductIndex,
  counterpartKey,
  matchCounterpart,
  matchProduct,
  normalizeKey,
  type CounterpartEntry,
  type CounterpartKind,
  type CounterpartMatchResult,
  type ProductMatchResult,
} from "@/lib/supplier-invoice/match"
import { parseSupplierInvoiceCsv, sumCountedByCurrency, type CsvIssue, type ParsedDocument, type ParsedLine } from "@/lib/supplier-invoice/csv"
import {
  supplierInvoiceCancelSchema,
  supplierInvoiceConfirmSchema,
  supplierInvoiceCounterpartUpdateSchema,
  supplierInvoiceCsvPreviewSchema,
  supplierInvoiceImportSchema,
  supplierInvoiceLineUpdateSchema,
  type SupplierInvoiceDocumentChoice,
} from "@/lib/validators/supplier-invoice"

/**
 * B-212 PR-1: 仕入先・工場・外注先から受け取った請求書（買う側）の Server Actions。
 * 仕様確認書 v1.1 D-1〜D-10・実装ブリーフ P1-D4〜P1-D8。
 * - ★SupplierInvoice / SupplierInvoiceLine / SupplierInvoiceMatchRule は TENANT_MODELS に無い。companyId / deletedAt: null を必ず手書きする
 * - 役割と権限: すべての action の先頭で checkArea("purchases")（D-8）
 * - 採番 SIV-{月度の年}-{4桁}（invoices.ts の computeNextInvoiceNumber と同型・deletedAt で絞らない）
 * - 取り込みは CSV の文字を受けてサーバで読み直し、人が直した choices を重ねてから保存する（画面の検証に頼らない）
 * - 締め（period-close）の判定は PR-1 では行わない（ブリーフ §7）
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

async function requireSession() {
  const session = await auth()
  if (!session?.user) return { ok: false as const, error: "認証されていません" }
  return { ok: true as const, companyId: session.user.companyId, userId: session.user.id }
}

const CREATE_MAX_RETRIES = 3
const LIST_PAGE_SIZE = 20

function invoiceNumberPrefix(periodMonth: string): string {
  return `SIV-${periodMonth.slice(0, 4)}-`
}

type NumberFinder = {
  findFirst: (args: {
    where: { companyId: string; invoiceNumber: { startsWith: string } }
    orderBy: { invoiceNumber: "desc" }
    select: { invoiceNumber: true }
  }) => Promise<{ invoiceNumber: string } | null>
}

/** ★deletedAt で絞らない：論理削除レコードも最大値判定に含める（番号の再利用を防ぐ）。 */
async function computeNextSupplierInvoiceSeq(finder: NumberFinder, companyId: string, prefix: string): Promise<number> {
  const last = await finder.findFirst({
    where: { companyId, invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  })
  if (!last) return 1
  const m = last.invoiceNumber.match(/-(\d+)$/)
  return m ? parseInt(m[1], 10) + 1 : 1
}

// ---------------------------------------------------------------- 選択肢（品番・相手先・費目）

export type ProductOption = { id: string; productCode: string; productName: string; clientProductCode: string | null; patternNumber: string | null }
export type CounterpartOption = CounterpartEntry
export type CostCategoryOption = { id: string; categoryCode: string; categoryName: string; level: number }
export type SupplierInvoiceOptions = { products: ProductOption[]; counterparts: CounterpartOption[]; costCategories: CostCategoryOption[] }

async function loadOptions(companyId: string): Promise<SupplierInvoiceOptions> {
  const [products, suppliers, factories, contractors, costCategories] = await Promise.all([
    prisma.product.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, productCode: true, productName: true, clientProductCode: true, modelCode: { select: { patternNumber: true } } },
      orderBy: { productCode: "asc" },
    }),
    prisma.supplier.findMany({ where: { companyId, deletedAt: null }, select: { id: true, supplierCode: true, companyName: true }, orderBy: { supplierCode: "asc" } }),
    prisma.factory.findMany({ where: { companyId, deletedAt: null }, select: { id: true, factoryCode: true, factoryName: true }, orderBy: { factoryCode: "asc" } }),
    prisma.contractor.findMany({ where: { companyId, deletedAt: null }, select: { id: true, contractorCode: true, contractorName: true }, orderBy: { contractorCode: "asc" } }),
    prisma.costCategory.findMany({
      where: { companyId, deletedAt: null, status: CostCategoryStatus.ACTIVE },
      select: { id: true, categoryCode: true, categoryName: true, level: true },
      orderBy: [{ level: "asc" }, { categoryCode: "asc" }],
    }),
  ])
  return {
    products: products.map((p) => ({ id: p.id, productCode: p.productCode, productName: p.productName, clientProductCode: p.clientProductCode, patternNumber: p.modelCode.patternNumber })),
    counterparts: [
      ...suppliers.map((s) => ({ type: "SUPPLIER" as const, id: s.id, code: s.supplierCode, name: s.companyName })),
      ...factories.map((f) => ({ type: "FACTORY" as const, id: f.id, code: f.factoryCode, name: f.factoryName })),
      ...contractors.map((c) => ({ type: "CONTRACTOR" as const, id: c.id, code: c.contractorCode, name: c.contractorName })),
    ],
    costCategories,
  }
}

/** 画面（詳細の選び直し）用 */
export async function getSupplierInvoiceOptions(): Promise<ActionResult<SupplierInvoiceOptions>> {
  const sess = await requireSession()
  if (!sess.ok) return sess
  const area = await checkArea("purchases")
  if (!area.ok) return area
  return { ok: true, data: await loadOptions(sess.companyId) }
}

type RuleRow = { ruleType: SupplierInvoiceRuleType; scopeCounterpartType: CounterpartType | null; scopeCounterpartId: string | null; sourceKey: string; targetCounterpartType: CounterpartType | null; targetId: string }

function productRuleScope(type: CounterpartType | "OTHER", id: string | null): string {
  return `${type}:${id ?? ""}`
}

function toCounterpartType(t: CounterpartKind | "OTHER"): CounterpartType {
  return CounterpartType[t]
}

/** 費目の当て: categoryCode か categoryName（normalizeKey）で比べる */
function resolveCostCategory(raw: string | null, cats: CostCategoryOption[]): { id: string | null; unresolved: boolean } {
  if (!raw) return { id: null, unresolved: false }
  const key = normalizeKey(raw)
  if (!key) return { id: null, unresolved: false }
  const hit = cats.find((c) => normalizeKey(c.categoryCode) === key || normalizeKey(c.categoryName) === key)
  return hit ? { id: hit.id, unresolved: false } : { id: null, unresolved: true }
}

// ---------------------------------------------------------------- 取り込みの前の確認（P1-D6・P1-D7）

export type PreviewLine = ParsedLine & {
  match: ProductMatchResult
  costCategoryId: string | null
  /** 費目の文字がマスターに当たらなかった（警告） */
  costCategoryUnresolved: boolean
}
export type PreviewDocument = Omit<ParsedDocument, "lines"> & {
  lines: PreviewLine[]
  counterpart: CounterpartMatchResult
  /** 同じ相手先名・書類No・月度の書類が既にある */
  duplicateOf: { id: string; invoiceNumber: string } | null
}
export type SupplierInvoicePreview = {
  documents: PreviewDocument[]
  errors: CsvIssue[]
  warnings: CsvIssue[]
  options: SupplierInvoiceOptions
}

async function buildPreview(companyId: string, csvText: string): Promise<SupplierInvoicePreview> {
  const parsed = parseSupplierInvoiceCsv(csvText)
  const options = await loadOptions(companyId)
  const warnings = [...parsed.warnings]
  if (parsed.documents.length === 0) return { documents: [], errors: parsed.errors, warnings, options }

  const rules: RuleRow[] = await prisma.supplierInvoiceMatchRule.findMany({
    where: { companyId, deletedAt: null },
    select: { ruleType: true, scopeCounterpartType: true, scopeCounterpartId: true, sourceKey: true, targetCounterpartType: true, targetId: true },
  })
  const counterpartRules = new Map<string, { type: CounterpartKind; id: string }>()
  const productRulesByScope = new Map<string, Map<string, string>>()
  for (const r of rules) {
    if (r.ruleType === SupplierInvoiceRuleType.COUNTERPART) {
      if (r.targetCounterpartType && r.targetCounterpartType !== CounterpartType.OTHER) {
        counterpartRules.set(r.sourceKey, { type: r.targetCounterpartType as CounterpartKind, id: r.targetId })
      }
    } else {
      const scope = productRuleScope(r.scopeCounterpartType ?? "OTHER", r.scopeCounterpartId)
      let m = productRulesByScope.get(scope)
      if (!m) { m = new Map(); productRulesByScope.set(scope, m) }
      m.set(r.sourceKey, r.targetId)
    }
  }
  const index = buildProductIndex(options.products.map((p) => ({ productId: p.id, productCode: p.productCode, clientProductCode: p.clientProductCode, patternNumber: p.patternNumber })))

  // 重複（同じ相手先名・書類No・月度・削除されていない）
  const existing = await prisma.supplierInvoice.findMany({
    where: {
      companyId,
      deletedAt: null,
      periodMonth: { in: [...new Set(parsed.documents.map((d) => d.periodMonth))] },
      documentNumber: { in: [...new Set(parsed.documents.map((d) => d.documentNumber))] },
    },
    select: { id: true, invoiceNumber: true, counterpartNameRaw: true, documentNumber: true, periodMonth: true },
  })

  const documents: PreviewDocument[] = parsed.documents.map((d) => {
    const counterpart = matchCounterpart(d.counterpartCodeRaw, d.counterpartNameRaw, { entries: options.counterparts, rules: counterpartRules })
    const scopeRules = productRulesByScope.get(productRuleScope(counterpart.type, counterpart.id)) ?? new Map<string, string>()
    const lines: PreviewLine[] = d.lines.map((l) => {
      const cost = resolveCostCategory(l.costCategoryRaw, options.costCategories)
      if (cost.unresolved) warnings.push({ row: l.csvRow, column: "費目", message: `費目「${l.costCategoryRaw}」は費目マスターに当たりません（空にします）` })
      const match = matchProduct(l.targetRaw, { index, rules: scopeRules, hasCostCategory: !!l.costCategoryRaw })
      return { ...l, match, costCategoryId: cost.id, costCategoryUnresolved: cost.unresolved }
    })
    const dup = existing.find((e) => e.counterpartNameRaw === d.counterpartNameRaw && e.documentNumber === d.documentNumber && e.periodMonth === d.periodMonth)
    return { ...d, lines, counterpart, duplicateOf: dup ? { id: dup.id, invoiceNumber: dup.invoiceNumber } : null }
  })
  return { documents, errors: parsed.errors, warnings, options }
}

/** CSV を読み取って確認画面の内容を返す（保存しない） */
export async function previewSupplierInvoiceCsv(input: unknown): Promise<ActionResult<SupplierInvoicePreview>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const area = await checkArea("purchases")
    if (!area.ok) return area
    const parsed = supplierInvoiceCsvPreviewSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    return { ok: true, data: await buildPreview(sess.companyId, parsed.data.csvText) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "読み取りに失敗しました" }
  }
}

// ---------------------------------------------------------------- 保存（P1-D7）

/** $transaction の中のクライアント（prisma は Extension 付きなので Prisma.TransactionClient では型が合わない） */
type Tx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

/** 覚えた対応（MatchRule）を作るか書き換える（同じ ruleType・scope・sourceKey の行があれば targetId を書き換える） */
async function upsertRule(
  tx: Tx,
  companyId: string,
  userId: string,
  r: { ruleType: SupplierInvoiceRuleType; scopeCounterpartType: CounterpartType | null; scopeCounterpartId: string | null; sourceKey: string; targetCounterpartType: CounterpartType | null; targetId: string },
): Promise<void> {
  const found = await tx.supplierInvoiceMatchRule.findFirst({
    where: { companyId, deletedAt: null, ruleType: r.ruleType, sourceKey: r.sourceKey, scopeCounterpartType: r.scopeCounterpartType, scopeCounterpartId: r.scopeCounterpartId },
    select: { id: true },
  })
  if (found) {
    await tx.supplierInvoiceMatchRule.update({ where: { id: found.id }, data: { targetId: r.targetId, targetCounterpartType: r.targetCounterpartType } })
  } else {
    await tx.supplierInvoiceMatchRule.create({ data: { companyId, createdByUserId: userId, ...r } })
  }
}

function dec(s: string | null): Prisma.Decimal | null {
  return s == null ? null : new Prisma.Decimal(s)
}
function dateOf(s: string | null): Date | null {
  return s ? fromYmd(s) : null
}

export type SupplierInvoiceImportResult = { importBatchId: string; created: { id: string; invoiceNumber: string; documentNumber: string }[]; skipped: number }

/**
 * 確認画面で人が直した内容を保存する。CSV をサーバで読み直し、choices（書類の鍵＋行番号）を重ねる。
 * 1回の取り込みで importBatchId を1つ。書類ごとに採番・ヘッダと明細・AuditLog CREATE。全体を1つの $transaction（P2002 はリトライ）
 */
export async function importSupplierInvoices(input: unknown): Promise<ActionResult<SupplierInvoiceImportResult>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const area = await checkArea("purchases")
    if (!area.ok) return area
    const parsed = supplierInvoiceImportSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    const data = parsed.data

    // サーバ側で同じ検証をもう一度行う
    const preview = await buildPreview(sess.companyId, data.csvText)
    if (preview.errors.length > 0) return { ok: false, error: `CSV にエラーが ${preview.errors.length} 件あります。直してから取り込んでください` }
    if (preview.documents.length === 0) return { ok: false, error: "取り込む書類がありません" }
    const choiceByKey = new Map<string, SupplierInvoiceDocumentChoice>(data.documents.map((d) => [d.key, d]))
    const validProductIds = new Set(preview.options.products.map((p) => p.id))
    const validCostIds = new Set(preview.options.costCategories.map((c) => c.id))
    const validCounterpart = (type: CounterpartType, id: string | null) =>
      type === CounterpartType.OTHER ? id === null : preview.options.counterparts.some((c) => c.type === type && c.id === id)

    // 取り込む書類と、その書類に重ねる choices を先に組む（tx の外で検証を終える）
    type Planned = {
      doc: PreviewDocument
      counterpartType: CounterpartType
      counterpartId: string | null
      counterpartRule: { sourceKey: string } | null
      lines: {
        line: PreviewLine
        productId: string | null
        matchStatus: SupplierInvoiceMatchStatus
        matchedBy: SupplierInvoiceMatchSource | null
        costCategoryId: string | null
        productRule: { sourceKey: string } | null
      }[]
    }
    const planned: Planned[] = []
    let skipped = 0
    for (const doc of preview.documents) {
      const choice = choiceByKey.get(doc.key)
      // 重複は既定で取り込まない。choices で skip を外していても、既にある書類は取り込まない（二重計上の防止）
      if (choice?.skip || doc.duplicateOf) { skipped += 1; continue }
      let counterpartType: CounterpartType = toCounterpartType(doc.counterpart.type)
      let counterpartId: string | null = doc.counterpart.id
      let counterpartRule: { sourceKey: string } | null = null
      if (choice?.counterpartType) {
        counterpartType = CounterpartType[choice.counterpartType]
        counterpartId = choice.counterpartType === "OTHER" ? null : choice.counterpartId
        if (!validCounterpart(counterpartType, counterpartId)) return { ok: false, error: `書類 ${doc.documentNumber} の相手先が正しくありません` }
        if (choice.counterpartChosen && counterpartId) {
          const key = counterpartKey(doc.counterpartCodeRaw, doc.counterpartNameRaw)
          if (key) counterpartRule = { sourceKey: key }
        }
      } else if (doc.counterpart.status === "RULE_PENDING" && !choice?.counterpartConfirmed) {
        // 覚えた対応で当てたが確認されていない: 当てた値は保存するが（後から直せる）、覚えた対応は書き換えない
      }
      const lineChoice = new Map((choice?.lines ?? []).map((l) => [l.lineNo, l]))
      const lines: Planned["lines"] = []
      for (const line of doc.lines) {
        const lc = lineChoice.get(line.lineNo)
        let productId = line.match.productId
        let matchStatus = SupplierInvoiceMatchStatus[line.match.status]
        let matchedBy: SupplierInvoiceMatchSource | null = line.match.matchedBy ? SupplierInvoiceMatchSource[line.match.matchedBy] : null
        let costCategoryId = line.costCategoryId
        let productRule: { sourceKey: string } | null = null
        if (lc) {
          if (lc.costCategoryId !== null) {
            if (!validCostIds.has(lc.costCategoryId)) return { ok: false, error: `書類 ${doc.documentNumber} 行 ${line.lineNo} の費目が正しくありません` }
            costCategoryId = lc.costCategoryId
          }
          if (lc.productId) {
            if (!validProductIds.has(lc.productId)) return { ok: false, error: `書類 ${doc.documentNumber} 行 ${line.lineNo} の品番が正しくありません` }
            productId = lc.productId
            matchStatus = SupplierInvoiceMatchStatus.MATCHED
            matchedBy = SupplierInvoiceMatchSource.MANUAL
            const key = normalizeKey(line.targetRaw)
            if (key) productRule = { sourceKey: key }
          } else if (lc.noProduct) {
            productId = null
            matchStatus = SupplierInvoiceMatchStatus.NO_PRODUCT
            matchedBy = null
          } else if (lc.confirmed && matchStatus === SupplierInvoiceMatchStatus.RULE_PENDING) {
            matchStatus = SupplierInvoiceMatchStatus.MATCHED // matchedBy は RULE のまま
          }
        }
        lines.push({ line, productId, matchStatus, matchedBy, costCategoryId, productRule })
      }
      planned.push({ doc, counterpartType, counterpartId, counterpartRule, lines })
    }
    if (planned.length === 0) return { ok: false, error: skipped > 0 ? "取り込む書類がありません（すべて取り込まない・重複）" : "取り込む書類がありません" }

    const importBatchId = randomUUID()
    const created: SupplierInvoiceImportResult["created"] = []
    let lastError: unknown = null
    for (let attempt = 0; attempt < CREATE_MAX_RETRIES; attempt++) {
      created.length = 0
      try {
        await prisma.$transaction(
          async (tx) => {
            const counters = new Map<string, number>()
            for (const p of planned) {
              const prefix = invoiceNumberPrefix(p.doc.periodMonth)
              if (!counters.has(prefix)) counters.set(prefix, await computeNextSupplierInvoiceSeq(tx.supplierInvoice, sess.companyId, prefix))
              const seq = counters.get(prefix)!
              counters.set(prefix, seq + 1)
              const invoiceNumber = `${prefix}${String(seq).padStart(4, "0")}`
              const row = await tx.supplierInvoice.create({
                data: {
                  companyId: sess.companyId,
                  invoiceNumber,
                  counterpartType: p.counterpartType,
                  counterpartId: p.counterpartId,
                  counterpartNameRaw: p.doc.counterpartNameRaw,
                  counterpartCodeRaw: p.doc.counterpartCodeRaw,
                  counterpartCategoryRaw: p.doc.counterpartCategoryRaw,
                  registrationNumber: p.doc.registrationNumber,
                  documentType: p.doc.documentType,
                  documentNumber: p.doc.documentNumber,
                  periodMonth: p.doc.periodMonth,
                  issueDate: dateOf(p.doc.issueDate),
                  closingDate: dateOf(p.doc.closingDate),
                  dueDate: dateOf(p.doc.dueDate),
                  subtotal: dec(p.doc.subtotal),
                  taxAmount: dec(p.doc.taxAmount),
                  totalAmount: new Prisma.Decimal(p.doc.totalAmount),
                  currency: p.doc.currency,
                  postingType: SupplierInvoicePostingType[p.doc.postingType],
                  pairedDocumentNumber: p.doc.pairedDocumentNumber,
                  source: SupplierInvoiceSource.B070_CSV,
                  importBatchId,
                  importFileName: data.fileName || null,
                  sourceFileName: p.doc.sourceFileName,
                  createdByUserId: sess.userId,
                  lines: {
                    create: p.lines.map((l) => ({
                      lineNo: l.line.lineNo,
                      slipDate: dateOf(l.line.slipDate),
                      slipNumber: l.line.slipNumber,
                      targetRaw: l.line.targetRaw,
                      itemCodeRaw: l.line.itemCodeRaw,
                      itemName: l.line.itemName,
                      quantity: dec(l.line.quantity),
                      unit: l.line.unit,
                      unitPrice: dec(l.line.unitPrice),
                      amount: new Prisma.Decimal(l.line.amount),
                      taxCategory: l.line.taxCategory,
                      productId: l.productId,
                      matchStatus: l.matchStatus,
                      matchedBy: l.matchedBy,
                      costCategoryId: l.costCategoryId,
                      packageCount: l.line.packageCount,
                      pieceCount: l.line.pieceCount,
                      weightKg: dec(l.line.weightKg),
                      sourcePage: l.line.sourcePage,
                      memo: l.line.memo,
                    })),
                  },
                },
                select: { id: true, invoiceNumber: true },
              })
              if (p.counterpartRule && p.counterpartId) {
                await upsertRule(tx, sess.companyId, sess.userId, {
                  ruleType: SupplierInvoiceRuleType.COUNTERPART, scopeCounterpartType: null, scopeCounterpartId: null,
                  sourceKey: p.counterpartRule.sourceKey, targetCounterpartType: p.counterpartType, targetId: p.counterpartId,
                })
              }
              for (const l of p.lines) {
                if (l.productRule && l.productId) {
                  await upsertRule(tx, sess.companyId, sess.userId, {
                    ruleType: SupplierInvoiceRuleType.PRODUCT, scopeCounterpartType: p.counterpartType, scopeCounterpartId: p.counterpartId,
                    sourceKey: l.productRule.sourceKey, targetCounterpartType: null, targetId: l.productId,
                  })
                }
              }
              await tx.auditLog.create({
                data: {
                  companyId: sess.companyId,
                  userId: sess.userId,
                  action: "CREATE",
                  entityType: "SupplierInvoice",
                  entityId: row.id,
                  afterData: {
                    invoiceNumber: row.invoiceNumber,
                    counterpartType: p.counterpartType,
                    counterpartId: p.counterpartId,
                    counterpartNameRaw: p.doc.counterpartNameRaw,
                    documentNumber: p.doc.documentNumber,
                    periodMonth: p.doc.periodMonth,
                    totalAmount: p.doc.totalAmount,
                    currency: p.doc.currency,
                    postingType: p.doc.postingType,
                    lineCount: p.lines.length,
                    importBatchId,
                  },
                },
              })
              created.push({ id: row.id, invoiceNumber: row.invoiceNumber, documentNumber: p.doc.documentNumber })
            }
          },
          { timeout: 30000 },
        )
        lastError = null
        break
      } catch (e) {
        lastError = e
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue
        throw e
      }
    }
    if (lastError) return { ok: false, error: "採番衝突が解消されませんでした。もう一度お試しください" }
    revalidatePath("/supplier-invoices")
    return { ok: true, data: { importBatchId, created, skipped } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "取り込みに失敗しました" }
  }
}

// ---------------------------------------------------------------- 一覧（P1-D8）

export type SupplierInvoiceListParams = {
  periodMonth?: string
  /** "SUPPLIER:id" の形。"OTHER" は相手先なし */
  counterpart?: string
  posting?: "COUNTED" | "REFERENCE"
  /** 要確認・未一致の行がある書類だけ */
  attention?: boolean
  page?: number
}

export type MatchCounts = { matched: number; pending: number; unmatched: number; noProduct: number }

export type SupplierInvoiceListRow = {
  id: string
  invoiceNumber: string
  periodMonth: string
  counterpartType: CounterpartType
  counterpartId: string | null
  counterpartNameRaw: string
  /** マスターに当たっていればマスターの名前、無ければ読み取ったままの社名 */
  counterpartName: string
  documentType: string
  documentNumber: string
  totalAmount: string
  currency: string
  postingType: SupplierInvoicePostingType
  pairedDocumentNumber: string | null
  counts: MatchCounts
}

export type SupplierInvoiceListResult = {
  items: SupplierInvoiceListRow[]
  /** 計上の書類だけを通貨ごとに合計（絞り込み結果の全件・参照は入れない・D-4） */
  totals: Record<string, string>
  count: number
  page: number
  pageSize: number
  totalPages: number
  periodMonths: string[]
  counterpartOptions: { value: string; label: string }[]
}

async function counterpartNameMap(companyId: string, rows: { counterpartType: CounterpartType; counterpartId: string | null }[]): Promise<Map<string, string>> {
  const ids = (t: CounterpartType) => [...new Set(rows.filter((r) => r.counterpartType === t && r.counterpartId).map((r) => r.counterpartId as string))]
  const [s, f, c] = await Promise.all([
    ids(CounterpartType.SUPPLIER).length ? prisma.supplier.findMany({ where: { companyId, id: { in: ids(CounterpartType.SUPPLIER) } }, select: { id: true, companyName: true } }) : [],
    ids(CounterpartType.FACTORY).length ? prisma.factory.findMany({ where: { companyId, id: { in: ids(CounterpartType.FACTORY) } }, select: { id: true, factoryName: true } }) : [],
    ids(CounterpartType.CONTRACTOR).length ? prisma.contractor.findMany({ where: { companyId, id: { in: ids(CounterpartType.CONTRACTOR) } }, select: { id: true, contractorName: true } }) : [],
  ])
  const m = new Map<string, string>()
  for (const x of s) m.set(`SUPPLIER:${x.id}`, x.companyName)
  for (const x of f) m.set(`FACTORY:${x.id}`, x.factoryName)
  for (const x of c) m.set(`CONTRACTOR:${x.id}`, x.contractorName)
  return m
}

function countsOf(lines: { matchStatus: SupplierInvoiceMatchStatus }[]): MatchCounts {
  const c: MatchCounts = { matched: 0, pending: 0, unmatched: 0, noProduct: 0 }
  for (const l of lines) {
    if (l.matchStatus === "MATCHED") c.matched += 1
    else if (l.matchStatus === "RULE_PENDING") c.pending += 1
    else if (l.matchStatus === "UNMATCHED") c.unmatched += 1
    else c.noProduct += 1
  }
  return c
}

export async function listSupplierInvoices(params: SupplierInvoiceListParams = {}): Promise<ActionResult<SupplierInvoiceListResult>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const area = await checkArea("purchases")
    if (!area.ok) return area
    const where: Prisma.SupplierInvoiceWhereInput = { companyId: sess.companyId, deletedAt: null }
    if (params.periodMonth && /^\d{4}-\d{2}$/.test(params.periodMonth)) where.periodMonth = params.periodMonth
    if (params.counterpart) {
      const [t, id] = params.counterpart.split(":")
      if (t === "OTHER") where.counterpartType = CounterpartType.OTHER
      else if (t && id && (t === "SUPPLIER" || t === "FACTORY" || t === "CONTRACTOR")) {
        where.counterpartType = CounterpartType[t]
        where.counterpartId = id
      }
    }
    if (params.posting) where.postingType = SupplierInvoicePostingType[params.posting]
    if (params.attention) where.lines = { some: { matchStatus: { in: [SupplierInvoiceMatchStatus.RULE_PENDING, SupplierInvoiceMatchStatus.UNMATCHED] } } }

    const page = Math.max(1, params.page ?? 1)
    const [count, rows, allForTotals, months, cpRows] = await Promise.all([
      prisma.supplierInvoice.count({ where }),
      prisma.supplierInvoice.findMany({
        where,
        orderBy: [{ periodMonth: "desc" }, { invoiceNumber: "desc" }],
        skip: (page - 1) * LIST_PAGE_SIZE,
        take: LIST_PAGE_SIZE,
        select: {
          id: true, invoiceNumber: true, periodMonth: true, counterpartType: true, counterpartId: true, counterpartNameRaw: true,
          documentType: true, documentNumber: true, totalAmount: true, currency: true, postingType: true, pairedDocumentNumber: true,
          lines: { select: { matchStatus: true } },
        },
      }),
      prisma.supplierInvoice.findMany({ where, select: { postingType: true, currency: true, totalAmount: true } }),
      prisma.supplierInvoice.findMany({ where: { companyId: sess.companyId, deletedAt: null }, select: { periodMonth: true }, distinct: ["periodMonth"], orderBy: { periodMonth: "desc" } }),
      prisma.supplierInvoice.findMany({ where: { companyId: sess.companyId, deletedAt: null }, select: { counterpartType: true, counterpartId: true, counterpartNameRaw: true }, distinct: ["counterpartType", "counterpartId"] }),
    ])
    const names = await counterpartNameMap(sess.companyId, [...rows, ...cpRows])
    const nameOf = (r: { counterpartType: CounterpartType; counterpartId: string | null; counterpartNameRaw: string }) =>
      (r.counterpartId ? names.get(`${r.counterpartType}:${r.counterpartId}`) : null) ?? r.counterpartNameRaw
    const counterpartOptions = [...new Map(cpRows.map((r) => {
      const value = r.counterpartId ? `${r.counterpartType}:${r.counterpartId}` : "OTHER"
      return [value, { value, label: r.counterpartId ? nameOf(r) : "相手先なし（マスターに当たっていない）" }]
    })).values()].sort((a, b) => a.label.localeCompare(b.label, "ja"))
    return {
      ok: true,
      data: {
        items: rows.map((r) => ({
          id: r.id, invoiceNumber: r.invoiceNumber, periodMonth: r.periodMonth, counterpartType: r.counterpartType, counterpartId: r.counterpartId,
          counterpartNameRaw: r.counterpartNameRaw, counterpartName: nameOf(r), documentType: r.documentType, documentNumber: r.documentNumber,
          totalAmount: r.totalAmount.toString(), currency: r.currency, postingType: r.postingType, pairedDocumentNumber: r.pairedDocumentNumber,
          counts: countsOf(r.lines),
        })),
        totals: sumCountedByCurrency(allForTotals.map((d) => ({ postingType: d.postingType, currency: d.currency, totalAmount: d.totalAmount.toString() }))),
        count,
        page,
        pageSize: LIST_PAGE_SIZE,
        totalPages: Math.max(1, Math.ceil(count / LIST_PAGE_SIZE)),
        periodMonths: months.map((m) => m.periodMonth),
        counterpartOptions,
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "一覧の取得に失敗しました" }
  }
}

// ---------------------------------------------------------------- 詳細（P1-D8）

export type SupplierInvoiceLineRow = {
  id: string
  lineNo: number
  slipDate: string | null
  slipNumber: string | null
  targetRaw: string | null
  itemCodeRaw: string | null
  itemName: string | null
  quantity: string | null
  unit: string | null
  unitPrice: string | null
  amount: string
  taxCategory: string | null
  productId: string | null
  productLabel: string | null
  matchStatus: SupplierInvoiceMatchStatus
  matchedBy: SupplierInvoiceMatchSource | null
  costCategoryId: string | null
  costCategoryLabel: string | null
  packageCount: number | null
  pieceCount: number | null
  weightKg: string | null
  sourcePage: number | null
  memo: string | null
}

export type SupplierInvoiceDetail = {
  id: string
  invoiceNumber: string
  periodMonth: string
  counterpartType: CounterpartType
  counterpartId: string | null
  counterpartNameRaw: string
  counterpartName: string
  counterpartCodeRaw: string | null
  counterpartCategoryRaw: string | null
  registrationNumber: string | null
  documentType: string
  documentNumber: string
  issueDate: string | null
  closingDate: string | null
  dueDate: string | null
  subtotal: string | null
  taxAmount: string | null
  totalAmount: string
  currency: string
  postingType: SupplierInvoicePostingType
  pairedDocumentNumber: string | null
  /** 参照の書類: 対の書類No が同じ月・同じ相手先の計上の書類にあればリンク */
  pairedInvoice: { id: string; invoiceNumber: string } | null
  /** 計上の書類: この書類を対の書類No に持つ参照の書類 */
  referencedBy: { id: string; invoiceNumber: string; documentNumber: string }[]
  source: SupplierInvoiceSource
  importFileName: string | null
  sourceFileName: string | null
  notes: string | null
  createdAt: string
  lines: SupplierInvoiceLineRow[]
  counts: MatchCounts
}

export async function getSupplierInvoice(id: string): Promise<ActionResult<SupplierInvoiceDetail>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const area = await checkArea("purchases")
    if (!area.ok) return area
    const r = await prisma.supplierInvoice.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      include: { lines: { orderBy: { lineNo: "asc" } } },
    })
    if (!r) return { ok: false, error: "書類が見つかりません" }
    const productIds = [...new Set(r.lines.map((l) => l.productId).filter((v): v is string => !!v))]
    const costIds = [...new Set(r.lines.map((l) => l.costCategoryId).filter((v): v is string => !!v))]
    const [products, costs, names, paired, referencedBy] = await Promise.all([
      productIds.length ? prisma.product.findMany({ where: { companyId: sess.companyId, id: { in: productIds } }, select: { id: true, productCode: true, productName: true } }) : [],
      costIds.length ? prisma.costCategory.findMany({ where: { companyId: sess.companyId, id: { in: costIds } }, select: { id: true, categoryCode: true, categoryName: true } }) : [],
      counterpartNameMap(sess.companyId, [r]),
      r.postingType === SupplierInvoicePostingType.REFERENCE && r.pairedDocumentNumber
        ? prisma.supplierInvoice.findFirst({
            where: { companyId: sess.companyId, deletedAt: null, postingType: SupplierInvoicePostingType.COUNTED, periodMonth: r.periodMonth, documentNumber: r.pairedDocumentNumber, counterpartNameRaw: r.counterpartNameRaw },
            select: { id: true, invoiceNumber: true },
          })
        : Promise.resolve(null),
      r.postingType === SupplierInvoicePostingType.COUNTED
        ? prisma.supplierInvoice.findMany({
            where: { companyId: sess.companyId, deletedAt: null, postingType: SupplierInvoicePostingType.REFERENCE, periodMonth: r.periodMonth, pairedDocumentNumber: r.documentNumber, counterpartNameRaw: r.counterpartNameRaw },
            select: { id: true, invoiceNumber: true, documentNumber: true },
            orderBy: { invoiceNumber: "asc" },
          })
        : Promise.resolve([]),
    ])
    const productLabel = new Map(products.map((p) => [p.id, `${p.productCode} ${p.productName}`]))
    const costLabel = new Map(costs.map((c) => [c.id, c.categoryName])) // FIX-1: 費目は名前で出す（コードは出さない）
    const ymd = (d: Date | null) => (d ? toYmd(d) : null)
    return {
      ok: true,
      data: {
        id: r.id, invoiceNumber: r.invoiceNumber, periodMonth: r.periodMonth, counterpartType: r.counterpartType, counterpartId: r.counterpartId,
        counterpartNameRaw: r.counterpartNameRaw,
        counterpartName: (r.counterpartId ? names.get(`${r.counterpartType}:${r.counterpartId}`) : null) ?? r.counterpartNameRaw,
        counterpartCodeRaw: r.counterpartCodeRaw, counterpartCategoryRaw: r.counterpartCategoryRaw, registrationNumber: r.registrationNumber,
        documentType: r.documentType, documentNumber: r.documentNumber, issueDate: ymd(r.issueDate), closingDate: ymd(r.closingDate), dueDate: ymd(r.dueDate),
        subtotal: r.subtotal?.toString() ?? null, taxAmount: r.taxAmount?.toString() ?? null, totalAmount: r.totalAmount.toString(), currency: r.currency,
        postingType: r.postingType, pairedDocumentNumber: r.pairedDocumentNumber, pairedInvoice: paired, referencedBy,
        source: r.source, importFileName: r.importFileName, sourceFileName: r.sourceFileName, notes: r.notes, createdAt: r.createdAt.toISOString(),
        lines: r.lines.map((l) => ({
          id: l.id, lineNo: l.lineNo, slipDate: ymd(l.slipDate), slipNumber: l.slipNumber, targetRaw: l.targetRaw, itemCodeRaw: l.itemCodeRaw, itemName: l.itemName,
          quantity: l.quantity?.toString() ?? null, unit: l.unit, unitPrice: l.unitPrice?.toString() ?? null, amount: l.amount.toString(), taxCategory: l.taxCategory,
          productId: l.productId, productLabel: l.productId ? productLabel.get(l.productId) ?? null : null, matchStatus: l.matchStatus, matchedBy: l.matchedBy,
          costCategoryId: l.costCategoryId, costCategoryLabel: l.costCategoryId ? costLabel.get(l.costCategoryId) ?? null : null,
          packageCount: l.packageCount, pieceCount: l.pieceCount, weightKg: l.weightKg?.toString() ?? null, sourcePage: l.sourcePage, memo: l.memo,
        })),
        counts: countsOf(r.lines),
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "書類の取得に失敗しました" }
  }
}

// ---------------------------------------------------------------- 詳細での直し（P1-D8）

async function loadOwnedInvoice(companyId: string, id: string) {
  return prisma.supplierInvoice.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, invoiceNumber: true, counterpartType: true, counterpartId: true, counterpartCodeRaw: true, counterpartNameRaw: true },
  })
}

/** 明細の品番・費目を直す。品番を選んだら覚えた対応も書き換える（D-5）。AuditLog UPDATE */
export async function updateSupplierInvoiceLine(input: unknown): Promise<ActionResult> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const area = await checkArea("purchases")
    if (!area.ok) return area
    const parsed = supplierInvoiceLineUpdateSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    const data = parsed.data
    const line = await prisma.supplierInvoiceLine.findFirst({ where: { id: data.lineId }, select: { id: true, supplierInvoiceId: true, targetRaw: true, productId: true, matchStatus: true, matchedBy: true, costCategoryId: true } })
    if (!line) return { ok: false, error: "明細が見つかりません" }
    const inv = await loadOwnedInvoice(sess.companyId, line.supplierInvoiceId)
    if (!inv) return { ok: false, error: "書類が見つかりません" }
    if (data.productId) {
      const p = await prisma.product.findFirst({ where: { id: data.productId, companyId: sess.companyId, deletedAt: null }, select: { id: true } })
      if (!p) return { ok: false, error: "品番が見つかりません" }
    }
    if (data.costCategoryId) {
      const c = await prisma.costCategory.findFirst({ where: { id: data.costCategoryId, companyId: sess.companyId, deletedAt: null }, select: { id: true } })
      if (!c) return { ok: false, error: "費目が見つかりません" }
    }
    const next = data.productId
      ? { productId: data.productId, matchStatus: SupplierInvoiceMatchStatus.MATCHED, matchedBy: SupplierInvoiceMatchSource.MANUAL }
      : data.noProduct
        ? { productId: null, matchStatus: SupplierInvoiceMatchStatus.NO_PRODUCT, matchedBy: null }
        : { productId: null, matchStatus: SupplierInvoiceMatchStatus.UNMATCHED, matchedBy: null }
    await prisma.$transaction(async (tx) => {
      await tx.supplierInvoiceLine.update({ where: { id: line.id }, data: { ...next, costCategoryId: data.costCategoryId } })
      const key = normalizeKey(line.targetRaw)
      if (data.productId && key) {
        await upsertRule(tx, sess.companyId, sess.userId, {
          ruleType: SupplierInvoiceRuleType.PRODUCT, scopeCounterpartType: inv.counterpartType, scopeCounterpartId: inv.counterpartId,
          sourceKey: key, targetCounterpartType: null, targetId: data.productId,
        })
      }
      await tx.auditLog.create({
        data: {
          companyId: sess.companyId, userId: sess.userId, action: "UPDATE", entityType: "SupplierInvoice", entityId: inv.id,
          beforeData: { lineId: line.id, productId: line.productId, matchStatus: line.matchStatus, matchedBy: line.matchedBy, costCategoryId: line.costCategoryId },
          afterData: { lineId: line.id, ...next, costCategoryId: data.costCategoryId },
        },
      })
    })
    revalidatePath(`/supplier-invoices/${inv.id}`)
    revalidatePath("/supplier-invoices")
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "更新に失敗しました" }
  }
}

/** 覚えた対応で当てた行（RULE_PENDING）を確認済み（MATCHED・matchedBy は RULE のまま）にする */
export async function confirmSupplierInvoiceLines(input: unknown): Promise<ActionResult<{ confirmed: number }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const area = await checkArea("purchases")
    if (!area.ok) return area
    const parsed = supplierInvoiceConfirmSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    const inv = await loadOwnedInvoice(sess.companyId, parsed.data.id)
    if (!inv) return { ok: false, error: "書類が見つかりません" }
    const where: Prisma.SupplierInvoiceLineWhereInput = { supplierInvoiceId: inv.id, matchStatus: SupplierInvoiceMatchStatus.RULE_PENDING }
    if (parsed.data.lineIds) where.id = { in: parsed.data.lineIds }
    const result = await prisma.$transaction(async (tx) => {
      const r = await tx.supplierInvoiceLine.updateMany({ where, data: { matchStatus: SupplierInvoiceMatchStatus.MATCHED } })
      if (r.count > 0) {
        await tx.auditLog.create({
          data: { companyId: sess.companyId, userId: sess.userId, action: "UPDATE", entityType: "SupplierInvoice", entityId: inv.id, afterData: { confirmedLines: r.count, lineIds: parsed.data.lineIds ?? "all" } },
        })
      }
      return r.count
    })
    revalidatePath(`/supplier-invoices/${inv.id}`)
    revalidatePath("/supplier-invoices")
    return { ok: true, data: { confirmed: result } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "更新に失敗しました" }
  }
}

/** 相手先の当てを直す。覚えた対応（COUNTERPART）も書き換える（D-5）。AuditLog UPDATE */
export async function updateSupplierInvoiceCounterpart(input: unknown): Promise<ActionResult> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const area = await checkArea("purchases")
    if (!area.ok) return area
    const parsed = supplierInvoiceCounterpartUpdateSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    const data = parsed.data
    const inv = await loadOwnedInvoice(sess.companyId, data.id)
    if (!inv) return { ok: false, error: "書類が見つかりません" }
    const type = CounterpartType[data.counterpartType]
    const id = data.counterpartType === "OTHER" ? null : data.counterpartId
    if (type !== CounterpartType.OTHER) {
      if (!id) return { ok: false, error: "相手先を選んでください" }
      const found =
        type === CounterpartType.SUPPLIER
          ? await prisma.supplier.findFirst({ where: { id, companyId: sess.companyId, deletedAt: null }, select: { id: true } })
          : type === CounterpartType.FACTORY
            ? await prisma.factory.findFirst({ where: { id, companyId: sess.companyId, deletedAt: null }, select: { id: true } })
            : await prisma.contractor.findFirst({ where: { id, companyId: sess.companyId, deletedAt: null }, select: { id: true } })
      if (!found) return { ok: false, error: "相手先が見つかりません" }
    }
    await prisma.$transaction(async (tx) => {
      await tx.supplierInvoice.update({ where: { id: inv.id }, data: { counterpartType: type, counterpartId: id } })
      const key = counterpartKey(inv.counterpartCodeRaw, inv.counterpartNameRaw)
      if (id && key) {
        await upsertRule(tx, sess.companyId, sess.userId, {
          ruleType: SupplierInvoiceRuleType.COUNTERPART, scopeCounterpartType: null, scopeCounterpartId: null, sourceKey: key, targetCounterpartType: type, targetId: id,
        })
      }
      await tx.auditLog.create({
        data: {
          companyId: sess.companyId, userId: sess.userId, action: "UPDATE", entityType: "SupplierInvoice", entityId: inv.id,
          beforeData: { counterpartType: inv.counterpartType, counterpartId: inv.counterpartId },
          afterData: { counterpartType: type, counterpartId: id },
        },
      })
    })
    revalidatePath(`/supplier-invoices/${inv.id}`)
    revalidatePath("/supplier-invoices")
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "更新に失敗しました" }
  }
}

/** 書類の取消（論理削除・理由必須・AuditLog DELETE）。読み取った値は直せない（取消して取り込み直す） */
export async function cancelSupplierInvoice(input: unknown): Promise<ActionResult> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const area = await checkArea("purchases")
    if (!area.ok) return area
    const parsed = supplierInvoiceCancelSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    const inv = await loadOwnedInvoice(sess.companyId, parsed.data.id)
    if (!inv) return { ok: false, error: "書類が見つかりません" }
    await prisma.$transaction(async (tx) => {
      await tx.supplierInvoice.update({ where: { id: inv.id }, data: { deletedAt: new Date() } })
      await tx.auditLog.create({
        data: {
          companyId: sess.companyId, userId: sess.userId, action: "DELETE", entityType: "SupplierInvoice", entityId: inv.id,
          beforeData: { invoiceNumber: inv.invoiceNumber, softDelete: true, reason: parsed.data.reason },
        },
      })
    })
    revalidatePath("/supplier-invoices")
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "取消に失敗しました" }
  }
}
