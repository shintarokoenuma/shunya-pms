/**
 * B-212 付帯: B-070 名寄せマスター（v0.3）から 仕入先（Supplier）・工場（Factory）・外注先（Contractor）を一括登録する core
 * （dev / prod 共通・CSV の読み取り・検証・get-or-create）。エントリは scripts/seed-b070-master.ts（dev）と
 * scripts/seed-b070-master-prod.ts（prod）。
 *
 * CSV の列（UTF-8 BOM 付き・見出し 1 行）: code,name,target,types,status,isIndividual,kubun,notes
 *   target = SUPPLIER / FACTORY / CONTRACTOR、types = 「|」区切りの enum 値（SUPPLIER→SupplierType、FACTORY→FactoryType、
 *   CONTRACTOR→ContractorSpecialty）、status = ACTIVE / PAUSED、isIndividual = true / false（CONTRACTOR だけ使う）、kubun = B-070 区分コード
 *
 * ルール:
 *   1. 行の検証（code は /^[A-Z0-9-_]+$/ かつ 50 文字以内・name は 1〜255・types は enum・status は ACTIVE/PAUSED）。
 *      1 行でも不正なら書き込みを始める前に全件を出して失敗（途中まで入れない）
 *   2. CSV 内で code が重複していない（3 マスター横断）。社名（正規化後）も重複していない。どちらかあれば失敗
 *   3. 既存の確認（deletedAt null も削除済みも含めて見る）:
 *      a. 同じ code が同じマスターにある → スキップ（既存・同じコード。UPDATE しない）
 *      b. 同じ code が別のマスターにある → スキップして一覧に出す
 *      c. code は無いが社名が既存と同じ（NFKC → 空白除去 → 法人の種類を除いて比較・3 マスター横断）→ 作らずに一覧に出す
 *      d. どれでもない → 作る
 *   4. 作る列は最小（code・name・種別・status・notes・country "JP"・CONTRACTOR は isIndividual と contractType PER_TASK）。
 *      取引条件・住所・口座は入れない。主担当（*Contact）は作らない。companyId は手で入れる（TENANT_MODELS 外の前提）
 *   5. 1 行ごとに create と AuditLog（CREATE・entityType は既存 create action と同じ "Supplier" / "Factory" / "Contractor"）を
 *      1 つの $transaction で書く。userId は OWNER を動的解決
 *   6. 集計: 対象 / 作成（マスター別・ACTIVE/PAUSED 別）/ スキップ a・b・c の件数と b・c の一覧
 *   7. 冪等（2 回流しても件数が増えない）
 */
import * as fs from "node:fs"
import Papa from "papaparse"
import {
  ContractorContractType,
  ContractorSpecialty,
  FactoryType,
  SupplierType,
  type PrismaClient,
} from "@prisma/client"

export const SEED_SOURCE = "seed-b070-master-v0_3"
export const DEFAULT_CSV = "scripts/seeds/b070-master-seed-v0_3.csv"

export type Target = "SUPPLIER" | "FACTORY" | "CONTRACTOR"
export type RowStatus = "ACTIVE" | "PAUSED"
export type MasterRow = {
  csvRow: number
  code: string
  name: string
  target: Target
  types: string[]
  status: RowStatus
  isIndividual: boolean
  kubun: string
  notes: string
}

const CODE_RE = /^[A-Z0-9-_]+$/
const TYPE_VALUES: Record<Target, readonly string[]> = {
  SUPPLIER: Object.values(SupplierType),
  FACTORY: Object.values(FactoryType),
  CONTRACTOR: Object.values(ContractorSpecialty),
}

const CORPORATE_SUFFIX = /(株式会社|有限会社|合同会社|合資会社|合名会社|\(株\)|（株）|㈱|\(有\)|（有）|㈲|\(同\)|（同）)/g

/** 社名の比較キー: NFKC → 空白除去 → 法人の種類を除く（B-212 の counterpartKey と同じ考え方） */
export function normalizeCompanyName(name: string): string {
  return name.normalize("NFKC").replace(/[\s　]/g, "").replace(CORPORATE_SUFFIX, "").toUpperCase()
}

/** CSV を読んで検証する（ルール 1・2）。errors があれば rows は使わない */
export function parseB070MasterCsv(text: string): { rows: MasterRow[]; errors: string[] } {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const parsed = Papa.parse<Record<string, string>>(body, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() })
  const errors: string[] = []
  const need = ["code", "name", "target", "types", "status", "isIndividual", "kubun", "notes"]
  const missing = need.filter((c) => !(parsed.meta.fields ?? []).includes(c))
  if (missing.length > 0) return { rows: [], errors: [`見出しに足りない列: ${missing.join(", ")}`] }
  for (const e of parsed.errors) errors.push(`${(e.row ?? 0) + 2} 行目: ${e.message}`)

  const rows: MasterRow[] = []
  parsed.data.forEach((r, i) => {
    const csvRow = i + 2
    const code = (r.code ?? "").trim()
    const name = (r.name ?? "").trim()
    const target = (r.target ?? "").trim() as Target
    const status = (r.status ?? "").trim() as RowStatus
    const types = (r.types ?? "").split("|").map((t) => t.trim()).filter(Boolean)
    const isIndividualRaw = (r.isIndividual ?? "").trim().toLowerCase()
    const bad = (m: string) => errors.push(`${csvRow} 行目（code=${code || "空"}）: ${m}`)
    if (!CODE_RE.test(code) || code.length > 50) bad("code は英大文字・数字・-・_ のみ・50 文字以内")
    if (name.length < 1 || name.length > 255) bad("name は 1〜255 文字")
    if (!(target in TYPE_VALUES)) bad(`target は SUPPLIER / FACTORY / CONTRACTOR（${r.target}）`)
    else {
      if (types.length === 0) bad("types が空")
      for (const t of types) if (!TYPE_VALUES[target].includes(t)) bad(`types の「${t}」は ${target} の enum に無い`)
    }
    if (status !== "ACTIVE" && status !== "PAUSED") bad(`status は ACTIVE / PAUSED（${r.status}）`)
    if (isIndividualRaw !== "true" && isIndividualRaw !== "false") bad(`isIndividual は true / false（${r.isIndividual}）`)
    rows.push({ csvRow, code, name, target, types, status, isIndividual: isIndividualRaw === "true", kubun: (r.kubun ?? "").trim(), notes: (r.notes ?? "").trim() })
  })
  // ルール 2: CSV 内の重複（code・社名）
  const byCode = new Map<string, number[]>()
  const byName = new Map<string, number[]>()
  for (const r of rows) {
    byCode.set(r.code, [...(byCode.get(r.code) ?? []), r.csvRow])
    const k = normalizeCompanyName(r.name)
    byName.set(k, [...(byName.get(k) ?? []), r.csvRow])
  }
  for (const [code, lines] of byCode) if (lines.length > 1) errors.push(`CSV 内で code が重複: ${code}（${lines.join(", ")} 行目）`)
  for (const [key, lines] of byName) if (lines.length > 1) errors.push(`CSV 内で社名が重複（正規化後 ${key}）: ${lines.join(", ")} 行目`)
  return { rows: errors.length > 0 ? [] : rows, errors }
}

type Existing = { master: Target; id: string; code: string; name: string; deleted: boolean }

export type SkipRecord = { row: MasterRow; reason: "same-code" | "code-in-other-master" | "same-name"; existing: Existing }
export type SeedSummary = {
  total: number
  created: Record<Target, { ACTIVE: number; PAUSED: number }>
  skipped: { sameCode: number; codeInOtherMaster: number; sameName: number }
  skips: SkipRecord[]
  dryRun: boolean
}

/** 既存の 3 マスターを読む（削除済みも含める） */
async function loadExisting(prisma: PrismaClient, companyId: string): Promise<Existing[]> {
  const [s, f, c] = await Promise.all([
    prisma.supplier.findMany({ where: { companyId }, select: { id: true, supplierCode: true, companyName: true, deletedAt: true } }),
    prisma.factory.findMany({ where: { companyId }, select: { id: true, factoryCode: true, factoryName: true, deletedAt: true } }),
    prisma.contractor.findMany({ where: { companyId }, select: { id: true, contractorCode: true, contractorName: true, deletedAt: true } }),
  ])
  return [
    ...s.map((x) => ({ master: "SUPPLIER" as const, id: x.id, code: x.supplierCode, name: x.companyName, deleted: !!x.deletedAt })),
    ...f.map((x) => ({ master: "FACTORY" as const, id: x.id, code: x.factoryCode, name: x.factoryName, deleted: !!x.deletedAt })),
    ...c.map((x) => ({ master: "CONTRACTOR" as const, id: x.id, code: x.contractorCode, name: x.contractorName, deleted: !!x.deletedAt })),
  ]
}

async function createOne(prisma: PrismaClient, companyId: string, userId: string, r: MasterRow): Promise<string> {
  const afterData = { code: r.code, name: r.name, target: r.target, types: r.types, status: r.status, kubun: r.kubun, source: SEED_SOURCE }
  return prisma.$transaction(async (tx) => {
    let id: string
    let entityType: "Supplier" | "Factory" | "Contractor"
    if (r.target === "SUPPLIER") {
      const s = await tx.supplier.create({
        data: { companyId, supplierCode: r.code, companyName: r.name, supplierType: r.types as SupplierType[], status: r.status, notes: r.notes || null, country: "JP" },
        select: { id: true },
      })
      id = s.id
      entityType = "Supplier"
    } else if (r.target === "FACTORY") {
      const f = await tx.factory.create({
        data: { companyId, factoryCode: r.code, factoryName: r.name, factoryTypes: r.types as FactoryType[], contractTypes: [], status: r.status, notes: r.notes || null, country: "JP" },
        select: { id: true },
      })
      id = f.id
      entityType = "Factory"
    } else {
      const c = await tx.contractor.create({
        data: {
          companyId, contractorCode: r.code, contractorName: r.name, specialties: r.types as ContractorSpecialty[], isIndividual: r.isIndividual,
          contractType: ContractorContractType.PER_TASK, status: r.status, notes: r.notes || null, country: "JP",
        },
        select: { id: true },
      })
      id = c.id
      entityType = "Contractor"
    }
    await tx.auditLog.create({ data: { companyId, userId, action: "CREATE", entityType, entityId: id, afterData } })
    return id
  })
}

/**
 * 本体。company は tenantType MASTER_ADMIN、AuditLog の userId は OWNER を動的解決。
 * dryRun なら DB に書かない（読み取りだけ）。
 */
export async function seedB070Master(prisma: PrismaClient, opts: { file: string; dryRun: boolean; log?: (s: string) => void }): Promise<SeedSummary> {
  const log = opts.log ?? ((s: string) => console.log(s))
  const text = fs.readFileSync(opts.file, "utf8")
  const { rows, errors } = parseB070MasterCsv(text)
  if (errors.length > 0) {
    for (const e of errors) log(`[CSV エラー] ${e}`)
    throw new Error(`CSV に ${errors.length} 件の不正があります。書き込みは始めていません`)
  }
  const company = await prisma.company.findFirst({ where: { tenantType: "MASTER_ADMIN" }, select: { id: true, companyName: true } })
  if (!company) throw new Error("MASTER_ADMIN tenant not found")
  const owner = await prisma.user.findFirst({ where: { companyId: company.id, role: "OWNER", deletedAt: null }, select: { id: true, email: true } })
  if (!owner) throw new Error("OWNER user not found")
  log(`Tenant: ${company.companyName} (${company.id}) / AuditLog userId: ${owner.email} / ${opts.dryRun ? "DRY-RUN（書かない）" : "実投入"}`)
  log(`CSV: ${opts.file} / ${rows.length} 行`)

  const existing = await loadExisting(prisma, company.id)
  const codeIndex = new Map<string, Existing[]>()
  const nameIndex = new Map<string, Existing[]>()
  const push = (e: Existing) => {
    codeIndex.set(e.code, [...(codeIndex.get(e.code) ?? []), e])
    const k = normalizeCompanyName(e.name)
    nameIndex.set(k, [...(nameIndex.get(k) ?? []), e])
  }
  for (const e of existing) push(e)
  log(`既存: suppliers ${existing.filter((e) => e.master === "SUPPLIER").length} / factories ${existing.filter((e) => e.master === "FACTORY").length} / contractors ${existing.filter((e) => e.master === "CONTRACTOR").length}（削除済みを含む）`)

  const summary: SeedSummary = {
    total: rows.length,
    created: { SUPPLIER: { ACTIVE: 0, PAUSED: 0 }, FACTORY: { ACTIVE: 0, PAUSED: 0 }, CONTRACTOR: { ACTIVE: 0, PAUSED: 0 } },
    skipped: { sameCode: 0, codeInOtherMaster: 0, sameName: 0 },
    skips: [],
    dryRun: opts.dryRun,
  }
  for (const r of rows) {
    const sameCode = codeIndex.get(r.code) ?? []
    const a = sameCode.find((e) => e.master === r.target)
    if (a) { summary.skipped.sameCode++; summary.skips.push({ row: r, reason: "same-code", existing: a }); continue }
    if (sameCode.length > 0) { summary.skipped.codeInOtherMaster++; summary.skips.push({ row: r, reason: "code-in-other-master", existing: sameCode[0] }); continue }
    const sameName = nameIndex.get(normalizeCompanyName(r.name)) ?? []
    if (sameName.length > 0) { summary.skipped.sameName++; summary.skips.push({ row: r, reason: "same-name", existing: sameName[0] }); continue }
    const id = opts.dryRun ? `(dry-run)` : await createOne(prisma, company.id, owner.id, r)
    summary.created[r.target][r.status]++
    push({ master: r.target, id, code: r.code, name: r.name, deleted: false })
  }
  return summary
}

const MASTER_LABEL: Record<Target, string> = { SUPPLIER: "仕入先", FACTORY: "工場", CONTRACTOR: "外注先" }

/** 集計（ルール 6）を人が読める形で出す */
export function formatSummary(s: SeedSummary): string {
  const lines: string[] = []
  const totalCreated = (Object.keys(s.created) as Target[]).reduce((n, t) => n + s.created[t].ACTIVE + s.created[t].PAUSED, 0)
  lines.push(`===== 集計（${s.dryRun ? "DRY-RUN・書いていない" : "実投入"}）=====`)
  lines.push(`対象 ${s.total} / 作成 ${totalCreated}（` + (Object.keys(s.created) as Target[]).map((t) => `${MASTER_LABEL[t]} ${s.created[t].ACTIVE + s.created[t].PAUSED}＝ACTIVE ${s.created[t].ACTIVE}・PAUSED ${s.created[t].PAUSED}`).join(" / ") + "）")
  lines.push(`スキップ a. 既存・同じコード ${s.skipped.sameCode} / b. 別マスターに同じコード ${s.skipped.codeInOtherMaster} / c. 社名が同じ既存あり・コード違い ${s.skipped.sameName}`)
  const listed = s.skips.filter((x) => x.reason !== "same-code")
  if (listed.length > 0) {
    lines.push("--- b・c の一覧（CSV の code・name → 既存の マスター・code・name）")
    for (const x of listed) {
      const why = x.reason === "code-in-other-master" ? "b 別マスターに同じコード" : "c 社名が同じ既存あり・コード違い"
      lines.push(`  [${why}] ${x.row.code} ${x.row.name}（${MASTER_LABEL[x.row.target]}）→ 既存 ${MASTER_LABEL[x.existing.master]} ${x.existing.code} ${x.existing.name}${x.existing.deleted ? "（削除済み）" : ""}`)
    }
  }
  return lines.join("\n")
}
