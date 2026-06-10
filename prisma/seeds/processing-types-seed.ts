/**
 * ProcessingType（加工種別・小分類）シード
 *
 * 実装ブリーフ①の小分類10件を投入する。dev / 本番の双方に流用可能（再利用前提）。
 *
 * 採番方式:
 *   src/lib/actions/processing-types.ts の computeNextProcessingTypeCode と同一アルゴリズム
 *   （PRC-{連番3桁}・companyId 単位・deletedAt 込み・code desc 先頭の連番 +1）を再現する。
 *   ※ 当該ヘルパは "use server" ファイル内の非 export 関数のため import 不可。生 INSERT で
 *     code を直書きせず、DB 状態から順次算出して付与する。
 *
 * 冪等性:
 *   同 companyId + 同 name（deletedAt=null）が既存ならスキップ（[companyId, code] が unique）。
 *
 * 実行: npx tsx prisma/seeds/processing-types-seed.ts
 *   接続先は DATABASE_URL（dev=hopper:12921 / 本番=shuttle:16099）。本番投入時は host を必ず照合。
 *   companyId は環境変数 SEED_COMPANY_ID で上書き可（既定は shunya マスターテナント）。
 */

import { PrismaClient, ProcessingTypeStatus, WorkOrderType } from "@prisma/client"

const prisma = new PrismaClient()

const COMPANY_ID = process.env.SEED_COMPANY_ID ?? "shunya-master-tenant-id"
const CODE_PREFIX = "PRC-"

/** ブリーフ①の小分類10件（sortOrder 1〜10 のこの順）。 */
const ITEMS: Array<{ sortOrder: number; name: string; workType: WorkOrderType }> = [
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
]

/** createProcessingType と同一の採番ロジック（PRC-{連番3桁}・deletedAt 込み）。 */
async function computeNextCode(companyId: string): Promise<string> {
  const last = await prisma.processingType.findFirst({
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

async function main() {
  console.log("🌱 ProcessingType seed start")
  console.log(`   companyId = ${COMPANY_ID}`)

  // company の存在確認（孤立データ防止）
  const company = await prisma.company.findUnique({
    where: { id: COMPANY_ID },
    select: { id: true, companyName: true },
  })
  if (!company) {
    throw new Error(
      `company が見つかりません: ${COMPANY_ID}（先に prisma/seed.ts で company を投入してください）`,
    )
  }

  let created = 0
  let skipped = 0

  for (const item of ITEMS) {
    const existing = await prisma.processingType.findFirst({
      where: { companyId: COMPANY_ID, name: item.name, deletedAt: null },
      select: { id: true, code: true },
    })
    if (existing) {
      skipped++
      console.log(`⏭️  skip（既存）: ${item.name}（${existing.code}）`)
      continue
    }

    const code = await computeNextCode(COMPANY_ID)
    const row = await prisma.processingType.create({
      data: {
        companyId: COMPANY_ID,
        code,
        name: item.name,
        workType: item.workType,
        sortOrder: item.sortOrder,
        status: ProcessingTypeStatus.ACTIVE,
      },
      select: { code: true, name: true, workType: true },
    })
    created++
    console.log(`✅ ${row.code}  ${row.name}（${row.workType}）`)
  }

  const total = await prisma.processingType.count({
    where: { companyId: COMPANY_ID, deletedAt: null },
  })
  console.log(`\n🎉 done: created=${created} / skipped=${skipped} / total(company)=${total}`)
}

main()
  .catch((e) => {
    console.error("❌ ProcessingType seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
