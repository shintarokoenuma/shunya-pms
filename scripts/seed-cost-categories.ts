#!/usr/bin/env tsx
/**
 * Phase 1A-16: 原価費目マスター (CostCategory) 標準セットの seed
 *
 * - 仕様書 v0.2 §8 のデータ (Lv1=4 / Lv2=35 / 合計 39 行)
 * - 冪等: `companyId + categoryCode` の unique を key にして "既存ならスキップ" 方式
 * - AuditLog を新規作成時のみ書き込み (B-010 教訓: シード経由でも痕跡を残す)
 * - 単一 $transaction でくくり、timeout 120s に拡張 (B-009 教訓)
 * - 安全装置: 本番ホストの DATABASE_URL では abort
 *
 * 使い方:
 *   npx tsx scripts/seed-cost-categories.ts
 */
import {
  PrismaClient,
  type ExternalCostCategory,
} from "@prisma/client"

const prisma = new PrismaClient()

// 本番ホスト (誤適用ガード)
const KNOWN_PROD_HOSTS = ["shuttle.proxy.rlwy.net:16099"]

// ─────────────────────────────────────────────────── Lv1 (予約 4 行)
type Lv1Row = {
  categoryCode: string
  categoryName: string
  categoryNameEn: string
  externalCategory: ExternalCostCategory
}

const LV1: readonly Lv1Row[] = [
  { categoryCode: "MATERIAL",   categoryName: "材料費", categoryNameEn: "Material",   externalCategory: "MATERIAL" },
  { categoryCode: "SEWING",     categoryName: "縫製費", categoryNameEn: "Sewing",     externalCategory: "SEWING" },
  { categoryCode: "PROCESSING", categoryName: "加工費", categoryNameEn: "Processing", externalCategory: "PROCESSING" },
  { categoryCode: "OVERHEAD",   categoryName: "諸経費", categoryNameEn: "Overhead",   externalCategory: "OVERHEAD" },
] as const

// ─────────────────────────────────────────────────── Lv2 (35 行)
type Lv2Row = {
  parentCode: string
  categoryCode: string
  categoryName: string
}

const LV2: readonly Lv2Row[] = [
  // parent=MATERIAL (9)
  { parentCode: "MATERIAL", categoryCode: "MAIN_FABRIC", categoryName: "本体生地" },
  { parentCode: "MATERIAL", categoryCode: "LINING",      categoryName: "裏地" },
  { parentCode: "MATERIAL", categoryCode: "INTERLINING", categoryName: "芯地" },
  { parentCode: "MATERIAL", categoryCode: "ZIPPER",      categoryName: "ファスナー" },
  { parentCode: "MATERIAL", categoryCode: "BUTTON",      categoryName: "ボタン" },
  { parentCode: "MATERIAL", categoryCode: "THREAD",      categoryName: "糸" },
  { parentCode: "MATERIAL", categoryCode: "ACCESSORY",   categoryName: "その他副資材" },
  { parentCode: "MATERIAL", categoryCode: "LABEL",       categoryName: "ラベル・ネーム類" },
  { parentCode: "MATERIAL", categoryCode: "PACKAGING",   categoryName: "包装材" },
  // parent=SEWING (3)
  { parentCode: "SEWING", categoryCode: "REGULAR_SEWING", categoryName: "通常縫製" },
  { parentCode: "SEWING", categoryCode: "SPECIAL_SEWING", categoryName: "特殊縫製" },
  { parentCode: "SEWING", categoryCode: "FINISHING",      categoryName: "仕上げ" },
  // parent=PROCESSING (5)
  { parentCode: "PROCESSING", categoryCode: "PRINTING",           categoryName: "プリント" },
  { parentCode: "PROCESSING", categoryCode: "EMBROIDERY",         categoryName: "刺繍" },
  { parentCode: "PROCESSING", categoryCode: "WASHING",            categoryName: "洗い加工" },
  { parentCode: "PROCESSING", categoryCode: "DYEING",             categoryName: "染色" },
  { parentCode: "PROCESSING", categoryCode: "SPECIAL_PROCESSING", categoryName: "特殊加工" },
  // parent=OVERHEAD (18)
  { parentCode: "OVERHEAD", categoryCode: "PATTERN_FEE",             categoryName: "パターン代" },
  { parentCode: "OVERHEAD", categoryCode: "GRADING_FEE",             categoryName: "グレーディング代" },
  { parentCode: "OVERHEAD", categoryCode: "SAMPLE_FEE",              categoryName: "サンプル製作費" },
  { parentCode: "OVERHEAD", categoryCode: "INSPECTION_FEE",          categoryName: "検品費" },
  { parentCode: "OVERHEAD", categoryCode: "DOMESTIC_TRANSPORT",      categoryName: "国内輸送費" },
  { parentCode: "OVERHEAD", categoryCode: "INTERNATIONAL_TRANSPORT", categoryName: "国際輸送費" },
  { parentCode: "OVERHEAD", categoryCode: "CUSTOMS_FEE",             categoryName: "通関費" },
  { parentCode: "OVERHEAD", categoryCode: "TARIFF",                  categoryName: "関税" },
  { parentCode: "OVERHEAD", categoryCode: "IMPORT_TAX",              categoryName: "輸入消費税" },
  { parentCode: "OVERHEAD", categoryCode: "STORAGE_FEE",             categoryName: "保管費" },
  { parentCode: "OVERHEAD", categoryCode: "INSURANCE",               categoryName: "保険料" },
  { parentCode: "OVERHEAD", categoryCode: "REMITTANCE_FEE",          categoryName: "送金手数料" },
  { parentCode: "OVERHEAD", categoryCode: "FX_LOSS",                 categoryName: "為替差損" },
  { parentCode: "OVERHEAD", categoryCode: "ROYALTY",                 categoryName: "ロイヤリティ" },
  { parentCode: "OVERHEAD", categoryCode: "PHOTOGRAPHY_FEE",         categoryName: "撮影費" },
  { parentCode: "OVERHEAD", categoryCode: "DESIGN_FEE",              categoryName: "デザイン費" },
  { parentCode: "OVERHEAD", categoryCode: "RENTAL_FEE",              categoryName: "レンタル費" },
  { parentCode: "OVERHEAD", categoryCode: "OTHER_OVERHEAD",          categoryName: "その他諸経費" },
] as const

async function main() {
  const hostMatch = (process.env.DATABASE_URL ?? "").match(/@([^/]+)\//)
  const host = hostMatch?.[1] ?? "(unknown)"
  console.log(`[seed-cost-categories] DB host: ${host}`)

  for (const h of KNOWN_PROD_HOSTS) {
    if ((process.env.DATABASE_URL ?? "").includes(h)) {
      console.error(
        `[FATAL] DATABASE_URL points to a known production host (${h}). Aborting.`,
      )
      process.exit(1)
    }
  }

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
  const codeToId = new Map<string, string>()

  await prisma.$transaction(
    async (tx) => {
      // ── Lv1 (予約 4 行) ──
      console.log(`\n[Lv1] processing ${LV1.length} rows`)
      for (const row of LV1) {
        const existing = await tx.costCategory.findUnique({
          where: {
            companyId_categoryCode: {
              companyId: company.id,
              categoryCode: row.categoryCode,
            },
          },
          select: { id: true },
        })
        if (existing) {
          codeToId.set(row.categoryCode, existing.id)
          skipped++
          console.log(`  ⊘ ${row.categoryCode.padEnd(28)} (${row.categoryName}) skip`)
          continue
        }
        const c = await tx.costCategory.create({
          data: {
            companyId: company.id,
            categoryCode: row.categoryCode,
            categoryName: row.categoryName,
            categoryNameEn: row.categoryNameEn,
            parentCategoryId: null,
            level: 1,
            externalCategory: row.externalCategory,
            isSystemReserved: true,
          },
          select: {
            id: true,
            categoryCode: true,
            categoryName: true,
            level: true,
            externalCategory: true,
          },
        })
        codeToId.set(row.categoryCode, c.id)
        await tx.auditLog.create({
          data: {
            companyId: company.id,
            userId: seedUserId,
            action: "CREATE",
            entityType: "CostCategory",
            entityId: c.id,
            afterData: {
              categoryCode: c.categoryCode,
              categoryName: c.categoryName,
              level: c.level,
              externalCategory: c.externalCategory,
              isSystemReserved: true,
              seedScript: "seed-cost-categories.ts",
            },
          },
        })
        created++
        console.log(`  ✓ ${row.categoryCode.padEnd(28)} (${row.categoryName}) created`)
      }

      // ── Lv2 (35 行) ──
      console.log(`\n[Lv2] processing ${LV2.length} rows`)
      for (const row of LV2) {
        const parentId = codeToId.get(row.parentCode)
        if (!parentId) {
          throw new Error(
            `Lv1 parent "${row.parentCode}" not found for ${row.categoryCode}`,
          )
        }
        const parent = LV1.find((p) => p.categoryCode === row.parentCode)
        if (!parent) {
          throw new Error(`Lv1 metadata for "${row.parentCode}" not found`)
        }
        const existing = await tx.costCategory.findUnique({
          where: {
            companyId_categoryCode: {
              companyId: company.id,
              categoryCode: row.categoryCode,
            },
          },
          select: { id: true },
        })
        if (existing) {
          skipped++
          console.log(
            `  ⊘ ${row.categoryCode.padEnd(28)} (${row.categoryName}, parent=${row.parentCode}) skip`,
          )
          continue
        }
        const c = await tx.costCategory.create({
          data: {
            companyId: company.id,
            categoryCode: row.categoryCode,
            categoryName: row.categoryName,
            categoryNameEn: null,
            parentCategoryId: parentId,
            level: 2,
            externalCategory: parent.externalCategory,
            isSystemReserved: false,
          },
          select: {
            id: true,
            categoryCode: true,
            categoryName: true,
            level: true,
            externalCategory: true,
          },
        })
        await tx.auditLog.create({
          data: {
            companyId: company.id,
            userId: seedUserId,
            action: "CREATE",
            entityType: "CostCategory",
            entityId: c.id,
            afterData: {
              categoryCode: c.categoryCode,
              categoryName: c.categoryName,
              level: c.level,
              externalCategory: c.externalCategory,
              parentCategoryId: parentId,
              seedScript: "seed-cost-categories.ts",
            },
          },
        })
        created++
        console.log(
          `  ✓ ${row.categoryCode.padEnd(28)} (${row.categoryName}, parent=${row.parentCode}) created`,
        )
      }
    },
    { maxWait: 15_000, timeout: 120_000 },
  )

  console.log(`\n[結果] 作成: ${created} 件 / skip: ${skipped} 件`)

  // 最終検証
  const [total, lv1Count, lv2Count] = await Promise.all([
    prisma.costCategory.count({
      where: { companyId: company.id, deletedAt: null },
    }),
    prisma.costCategory.count({
      where: { companyId: company.id, deletedAt: null, level: 1 },
    }),
    prisma.costCategory.count({
      where: { companyId: company.id, deletedAt: null, level: 2 },
    }),
  ])
  console.log(
    `[検証] total=${total}  Lv1=${lv1Count}  Lv2=${lv2Count}  (期待: 39 / 4 / 35)`,
  )

  if (total === 39 && lv1Count === 4 && lv2Count === 35) {
    console.log("✓ seed 完了 — 件数すべて期待値通り")
  } else {
    console.warn(
      "[WARN] 件数が期待値と異なります。冪等チェックでスキップされた行が想定外の状態かも",
    )
  }
}

main()
  .catch((e) => {
    console.error("[seed-cost-categories] FATAL:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
