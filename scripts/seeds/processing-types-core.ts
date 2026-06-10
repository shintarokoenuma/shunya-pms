/**
 * ProcessingType（加工種別・小分類）シードの共通モジュール
 *
 * - 実装ブリーフ①の小分類10件（PRINTING / EMBROIDERY / WASHING / DYEING）
 * - 採番: src/lib/actions/processing-types.ts の computeNextProcessingTypeCode と同一アルゴリズム
 *   （PRC-{連番3桁}・companyId 単位・deletedAt 込み・code desc 先頭の連番 +1）を再現。
 *   生 INSERT で code を直書きせず、DB 状態から順次算出して付与する。
 * - 冪等: `companyId + name`（deletedAt=null）を key に「既存ならスキップ」方式
 * - AuditLog を新規作成時のみ書き込み（B-010 教訓: シード経由でも痕跡を残す）
 * - 単一 $transaction でくくり、timeout 120s に拡張（B-009 教訓）
 *
 * このモジュールは **ホストガードを持たない**。
 * ホストガード（dev のみ通す / 本番のみ通す + 三重ガード）は呼び出し側エントリの責務。
 *
 * 呼び出し側:
 * - scripts/seed-processing-types.ts        (dev 専用エントリ、dev でないと abort)
 * - scripts/seed-processing-types-prod.ts   (本番専用エントリ、三重ガード)
 */
import {
  PrismaClient,
  ProcessingTypeStatus,
  WorkOrderType,
  type Prisma,
} from "@prisma/client"

type ProcessingTypeRow = {
  sortOrder: number
  name: string
  workType: WorkOrderType
}

const CODE_PREFIX = "PRC-"

// ─────────────────────────────────────────────────── 小分類 10 件（sortOrder 1〜10 のこの順）
export const PROCESSING_TYPES: readonly ProcessingTypeRow[] = [
  { sortOrder: 1, name: "インクジェット", workType: WorkOrderType.PRINTING },
  { sortOrder: 2, name: "シルクスクリーンプリント", workType: WorkOrderType.PRINTING },
  { sortOrder: 3, name: "昇華転写プリント", workType: WorkOrderType.PRINTING },
  { sortOrder: 4, name: "手刺繍", workType: WorkOrderType.EMBROIDERY },
  { sortOrder: 5, name: "平刺繍", workType: WorkOrderType.EMBROIDERY },
  { sortOrder: 6, name: "サガラ刺繍", workType: WorkOrderType.EMBROIDERY },
  { sortOrder: 7, name: "ストーンバイオ", workType: WorkOrderType.WASHING },
  { sortOrder: 8, name: "ボールバイオ", workType: WorkOrderType.WASHING },
  { sortOrder: 9, name: "ダメージ加工", workType: WorkOrderType.WASHING },
  { sortOrder: 10, name: "タイダイ", workType: WorkOrderType.DYEING },
] as const

/** createProcessingType と同一の採番ロジック（PRC-{連番3桁}・deletedAt 込み）。 */
async function computeNextCode(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<string> {
  const last = await tx.processingType.findFirst({
    where: { companyId, code: { startsWith: CODE_PREFIX } },
    orderBy: { code: "desc" },
    select: { code: true },
  })
  let nextNum = 1
  if (last) {
    const match = last.code.match(/-(\d+)$/)
    if (match) nextNum = parseInt(match[1], 10) + 1
  }
  return `${CODE_PREFIX}${String(nextNum).padStart(3, "0")}`
}

/**
 * 共通シード関数。
 * テナント (MASTER_ADMIN) と AuditLog 用ユーザーを解決し、
 * 10 件を冪等に投入する。
 *
 * 戻り値: `{ created, skipped }`
 */
export async function seedProcessingTypes(
  prisma: PrismaClient,
): Promise<{ created: number; skipped: number }> {
  // テナント (shunya = MASTER_ADMIN)
  const company = await prisma.company.findFirst({
    where: { tenantType: "MASTER_ADMIN" },
    select: { id: true, companyName: true },
  })
  if (!company) {
    throw new Error("MASTER_ADMIN tenant not found")
  }
  console.log(`Tenant: ${company.companyName} (${company.id})`)

  // AuditLog の userId 用にテナント内の最初のユーザーを拾う
  const user = await prisma.user.findFirst({
    where: { companyId: company.id, deletedAt: null },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  })
  if (!user) {
    throw new Error(`No user found in tenant ${company.id}`)
  }
  const seedUserId = user.id
  console.log(`AuditLog userId: ${seedUserId} (${user.email})`)

  let created = 0
  let skipped = 0

  await prisma.$transaction(
    async (tx) => {
      console.log(`\n[ProcessingTypes] processing ${PROCESSING_TYPES.length} rows`)
      for (const row of PROCESSING_TYPES) {
        const existing = await tx.processingType.findFirst({
          where: { companyId: company.id, name: row.name, deletedAt: null },
          select: { id: true, code: true },
        })
        if (existing) {
          skipped++
          console.log(`  ⊘ ${row.name.padEnd(16)} skip（${existing.code}）`)
          continue
        }

        const code = await computeNextCode(tx, company.id)
        const pt = await tx.processingType.create({
          data: {
            companyId: company.id,
            code,
            name: row.name,
            workType: row.workType,
            sortOrder: row.sortOrder,
            status: ProcessingTypeStatus.ACTIVE,
          },
          select: { id: true, code: true, name: true, workType: true },
        })
        await tx.auditLog.create({
          data: {
            companyId: company.id,
            userId: seedUserId,
            action: "CREATE",
            entityType: "ProcessingType",
            entityId: pt.id,
            afterData: {
              code: pt.code,
              name: pt.name,
              workType: pt.workType,
              sortOrder: row.sortOrder,
              status: ProcessingTypeStatus.ACTIVE,
              seedScript: "seeds/processing-types-core.ts",
            },
          },
        })
        created++
        console.log(`  ✓ ${pt.code} ${pt.name.padEnd(16)} created（${pt.workType}）`)
      }
    },
    { maxWait: 15_000, timeout: 120_000 },
  )

  console.log(`\n[結果] 作成: ${created} 件 / skip: ${skipped} 件`)

  // 最終検証 (logging のみ)
  const total = await prisma.processingType.count({
    where: { companyId: company.id, deletedAt: null },
  })
  console.log(`[検証] total=${total}  (期待: ${PROCESSING_TYPES.length} 以上)`)

  if (total >= PROCESSING_TYPES.length) {
    console.log("✓ seed 完了 — 10 件すべて存在")
  } else {
    console.warn(
      "[WARN] 件数が期待値に満たない。冪等チェックでスキップされた行が想定外の状態かも",
    )
  }

  return { created, skipped }
}
