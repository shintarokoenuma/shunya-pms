#!/usr/bin/env tsx
/**
 * dev 用サンプルマスターデータ 一括シード — **dev 専用エントリ**
 *
 * 目的:
 *   2026-06-09 の dev DB 消失を受け、S-4b-2(WO系) 検証に必要な最低限のマスターを
 *   冪等に一括投入する。今後の dev 消失時の復旧手順としても再利用する。
 *
 * 流儀:
 *   - scripts/seed-processing-types.ts と同じホストガード様式。
 *     DATABASE_URL のホストを表示し、本番ホスト(shuttle:16099)検知または
 *     期待 dev ホスト(hopper:12921)以外なら即 exit(1)。
 *     ※ Railway の dev エンドポイントがローテした場合は ALLOW_DEV_HOST_OVERRIDE=1 で続行可
 *       （本番ホストは override 不可・常に abort）。
 *   - company は tenantType:"MASTER_ADMIN" を動的解決（既存 seed と同領分）。
 *   - 各マスターは @@unique（companyId × code 等）で「既存ならスキップ」＝冪等。
 *   - 既存 core を再利用: Color / CostCategory / TextilePatternType。
 *   - ProcessingType は投入済みのためスコープ外。company / users も既存 seed の領分で触らない。
 *
 * 使い方 (dev DB に投入する場合のみ):
 *   npx tsx scripts/seed-dev-sample-data.ts
 */
import {
  PrismaClient,
  type Company,
} from "@prisma/client"
import { seedColors } from "./seeds/colors-core"
import { seedCostCategories } from "./seeds/cost-categories-core"
import { seedTextilePatternTypes } from "./seeds/textile-pattern-types-core"

const prisma = new PrismaClient()

const EXPECTED_DEV_HOST = "hopper.proxy.rlwy.net:12921"
const KNOWN_PROD_HOSTS = ["shuttle.proxy.rlwy.net:16099"]

// ─────────────────────────────────────────────────── 集計
const stats = new Map<string, { created: number; skipped: number }>()
function bump(master: string, kind: "created" | "skipped") {
  const s = stats.get(master) ?? { created: 0, skipped: 0 }
  s[kind]++
  stats.set(master, s)
}

/**
 * 冪等な get-or-create。finder が見つければ skip、無ければ creator で作成。
 * いずれも { id } を select して返す（子マスターの FK 解決に使う）。
 */
async function getOrCreate(
  master: string,
  finder: () => Promise<{ id: string } | null>,
  creator: () => Promise<{ id: string }>,
): Promise<string> {
  const found = await finder()
  if (found) {
    bump(master, "skipped")
    return found.id
  }
  const made = await creator()
  bump(master, "created")
  return made.id
}

// ─────────────────────────────────────────────────── ホストガード
function guardHost(): string {
  const url = process.env.DATABASE_URL ?? ""
  const host = url.match(/@([^/]+)\//)?.[1] ?? "(unknown)"
  console.log(`[seed-dev-sample-data] DB host: ${host}`)

  for (const prod of KNOWN_PROD_HOSTS) {
    if (url.includes(prod)) {
      console.error(
        `[FATAL] DATABASE_URL は本番ホスト(${prod})を指しています。dev 専用スクリプトのため中止します。`,
      )
      process.exit(1)
    }
  }
  if (host !== EXPECTED_DEV_HOST && process.env.ALLOW_DEV_HOST_OVERRIDE !== "1") {
    console.error(
      `[FATAL] 期待する dev ホスト(${EXPECTED_DEV_HOST})と一致しません: ${host}`,
    )
    console.error(
      "        dev エンドポイントがローテした場合は ALLOW_DEV_HOST_OVERRIDE=1 を付けて再実行してください。",
    )
    process.exit(1)
  }
  return host
}

// ─────────────────────────────────────────────────── 個別マスター投入
async function seedSimpleMasters(company: Company) {
  const companyId = company.id

  // --- ProductCategory（2件・親なし Lv1）---
  for (const r of [
    { categoryCode: "CUT_SEWN", categoryName: "カットソー", categoryNameEn: "Cut & Sewn" },
    { categoryCode: "WOVEN", categoryName: "布帛", categoryNameEn: "Woven" },
  ]) {
    await getOrCreate(
      "ProductCategory",
      () =>
        prisma.productCategory.findFirst({
          where: { companyId, categoryCode: r.categoryCode, deletedAt: null },
          select: { id: true },
        }),
      () =>
        prisma.productCategory.create({
          data: {
            companyId,
            categoryCode: r.categoryCode,
            categoryName: r.categoryName,
            categoryNameEn: r.categoryNameEn,
          },
          select: { id: true },
        }),
    )
  }

  // --- MaterialCategory（2件・親なし）---
  for (const r of [
    { categoryCode: "FABRIC", categoryName: "生地" },
    { categoryCode: "TRIM", categoryName: "付属" },
  ]) {
    await getOrCreate(
      "MaterialCategory",
      () =>
        prisma.materialCategory.findFirst({
          where: { companyId, categoryCode: r.categoryCode, deletedAt: null },
          select: { id: true },
        }),
      () =>
        prisma.materialCategory.create({
          data: {
            companyId,
            categoryCode: r.categoryCode,
            categoryName: r.categoryName,
          },
          select: { id: true },
        }),
    )
  }

  // --- Client（2件）---
  const clientIds: Record<string, string> = {}
  for (const r of [
    { clientCode: "CL-001", companyName: "葵アパレル[ダミー]", businessType: "APPAREL_BRAND" as const },
    { clientCode: "CL-002", companyName: "なんば商店[ダミー]", businessType: "SELECT_SHOP" as const },
  ]) {
    clientIds[r.clientCode] = await getOrCreate(
      "Client",
      () =>
        prisma.client.findFirst({
          where: { companyId, clientCode: r.clientCode, deletedAt: null },
          select: { id: true },
        }),
      () =>
        prisma.client.create({
          data: {
            companyId,
            clientCode: r.clientCode,
            companyName: r.companyName,
            businessType: r.businessType,
          },
          select: { id: true },
        }),
    )
  }

  // --- Brand（2件・Client FK 必須。code は ModelCode 採番略号に使える短縮）---
  const brandIds: Record<string, string> = {}
  for (const r of [
    { brandCode: "AOI", brandName: "AOI", clientCode: "CL-001" },
    { brandCode: "NMB", brandName: "NAMBA", clientCode: "CL-002" },
  ]) {
    brandIds[r.brandCode] = await getOrCreate(
      "Brand",
      () =>
        prisma.brand.findFirst({
          where: { companyId, brandCode: r.brandCode, deletedAt: null },
          select: { id: true },
        }),
      () =>
        prisma.brand.create({
          data: {
            companyId,
            clientId: clientIds[r.clientCode],
            brandCode: r.brandCode,
            brandName: r.brandName,
          },
          select: { id: true },
        }),
    )
  }

  // --- Supplier（生地系1・付属系1）---
  const supplierIds: Record<string, string> = {}
  for (const r of [
    { supplierCode: "SP-001", companyName: "藤崎テキスタイル[ダミー]", supplierType: ["FABRIC"] },
    { supplierCode: "SP-002", companyName: "丸東[ダミー]", supplierType: ["TRIM", "ACCESSORY"] },
  ]) {
    supplierIds[r.supplierCode] = await getOrCreate(
      "Supplier",
      () =>
        prisma.supplier.findFirst({
          where: { companyId, supplierCode: r.supplierCode, deletedAt: null },
          select: { id: true },
        }),
      () =>
        prisma.supplier.create({
          data: {
            companyId,
            supplierCode: r.supplierCode,
            companyName: r.companyName,
            supplierType: r.supplierType as never,
          },
          select: { id: true },
        }),
    )
  }

  // --- Factory（縫製1・加工1。PROCESSING 起点 WO の発注先候補）---
  for (const r of [
    {
      factoryCode: "FC-001",
      factoryName: "ベトナム第一縫製[ダミー]",
      factoryTypes: ["SEWING"],
      contractTypes: ["CMT", "FULL_PACKAGE"],
    },
    {
      factoryCode: "FC-002",
      factoryName: "大阪加工センター[ダミー]",
      factoryTypes: ["WASHING", "DYEING", "FINISHING"],
      contractTypes: ["PROCESSING_ONLY"],
    },
  ]) {
    await getOrCreate(
      "Factory",
      () =>
        prisma.factory.findFirst({
          where: { companyId, factoryCode: r.factoryCode, deletedAt: null },
          select: { id: true },
        }),
      () =>
        prisma.factory.create({
          data: {
            companyId,
            factoryCode: r.factoryCode,
            factoryName: r.factoryName,
            factoryTypes: r.factoryTypes as never,
            contractTypes: r.contractTypes as never,
          },
          select: { id: true },
        }),
    )
  }

  // --- Contractor（パタンナー1・グレーダー1。PATTERN 起点 WO の発注先候補）---
  for (const r of [
    {
      contractorCode: "CT-001",
      contractorName: "山本パターン工房[ダミー]",
      contractType: "PER_TASK" as const,
      specialties: ["PATTERN_MAKING", "SAMPLE_MAKING"],
    },
    {
      contractorCode: "CT-002",
      contractorName: "グレーディング佐藤[ダミー]",
      contractType: "PER_TASK" as const,
      specialties: ["GRADING"],
    },
  ]) {
    await getOrCreate(
      "Contractor",
      () =>
        prisma.contractor.findFirst({
          where: { companyId, contractorCode: r.contractorCode, deletedAt: null },
          select: { id: true },
        }),
      () =>
        prisma.contractor.create({
          data: {
            companyId,
            contractorCode: r.contractorCode,
            contractorName: r.contractorName,
            contractType: r.contractType,
            specialties: r.specialties as never,
          },
          select: { id: true },
        }),
    )
  }

  // --- Buyer（1件）---
  const buyerIds: Record<string, string> = {}
  for (const r of [
    { buyerCode: "BY-001", buyerName: "葵アパレル 本部仕入[ダミー]", clientCode: "CL-001" },
  ]) {
    buyerIds[r.buyerCode] = await getOrCreate(
      "Buyer",
      () =>
        prisma.buyer.findFirst({
          where: { companyId, buyerCode: r.buyerCode, deletedAt: null },
          select: { id: true },
        }),
      () =>
        prisma.buyer.create({
          data: {
            companyId,
            buyerCode: r.buyerCode,
            buyerName: r.buyerName,
            clientId: clientIds[r.clientCode],
          },
          select: { id: true },
        }),
    )
  }

  // --- DeliveryDestination（1件・Buyer FK 必須）---
  for (const r of [
    { destinationCode: "DD-001", destinationName: "葵アパレル 物流センター[ダミー]", buyerCode: "BY-001" },
  ]) {
    await getOrCreate(
      "DeliveryDestination",
      () =>
        prisma.deliveryDestination.findFirst({
          where: { companyId, destinationCode: r.destinationCode, deletedAt: null },
          select: { id: true },
        }),
      () =>
        prisma.deliveryDestination.create({
          data: {
            companyId,
            destinationCode: r.destinationCode,
            destinationName: r.destinationName,
            buyerId: buyerIds[r.buyerCode],
          },
          select: { id: true },
        }),
    )
  }

  // --- Material（表地1・ボタン1・ファスナー1。Supplier FK 必須）---
  for (const r of [
    {
      materialCode: "MT-001",
      materialName: "コットンブロード 110/2[ダミー]",
      materialType: "FABRIC" as const,
      supplierCode: "SP-001",
      unit: "m",
    },
    {
      materialCode: "MT-002",
      materialName: "ナットボタン 18mm[ダミー]",
      materialType: "BUTTON" as const,
      supplierCode: "SP-002",
      unit: "個",
    },
    {
      materialCode: "MT-003",
      materialName: "コイルファスナー 56cm[ダミー]",
      materialType: "ZIPPER" as const,
      supplierCode: "SP-002",
      unit: "本",
    },
  ]) {
    await getOrCreate(
      "Material",
      () =>
        prisma.material.findFirst({
          where: {
            companyId,
            primarySupplierId: supplierIds[r.supplierCode],
            materialCode: r.materialCode,
            deletedAt: null,
          },
          select: { id: true },
        }),
      () =>
        prisma.material.create({
          data: {
            companyId,
            materialCode: r.materialCode,
            materialName: r.materialName,
            materialType: r.materialType,
            primarySupplierId: supplierIds[r.supplierCode],
            unit: r.unit,
          },
          select: { id: true },
        }),
    )
  }

  // --- ModelCode（2件・Brand FK 必須。@relation 無し＝scalar brandId 直指定）---
  for (const r of [
    { modelCode: "AOI-26AW-001", modelName: "26AW テーラードJK[ダミー]", brandCode: "AOI" },
    { modelCode: "NMB-26AW-001", modelName: "26AW ワイドパンツ[ダミー]", brandCode: "NMB" },
  ]) {
    await getOrCreate(
      "ModelCode",
      () =>
        prisma.modelCode.findFirst({
          where: { companyId, modelCode: r.modelCode, deletedAt: null },
          select: { id: true },
        }),
      () =>
        prisma.modelCode.create({
          data: {
            companyId,
            modelCode: r.modelCode,
            modelName: r.modelName,
            brandId: brandIds[r.brandCode],
          },
          select: { id: true },
        }),
    )
  }
}

async function main() {
  guardHost()

  const company = await prisma.company.findFirst({
    where: { tenantType: "MASTER_ADMIN" },
  })
  if (!company) {
    throw new Error(
      "MASTER_ADMIN tenant not found（先に prisma/seed.ts で company/user を投入してください）",
    )
  }
  console.log(`Tenant: ${company.companyName} (${company.id})\n`)

  // --- 既存 core を再利用（各自 company を解決・冪等・AuditLog 記録）---
  console.log("=== Color / CostCategory / TextilePatternType（既存 core 再利用）===")
  const color = await seedColors(prisma)
  stats.set("Color", { created: color.created, skipped: color.skipped })
  const cost = await seedCostCategories(prisma)
  stats.set("CostCategory", { created: cost.created, skipped: cost.skipped })
  const tpt = await seedTextilePatternTypes(prisma)
  stats.set("TextilePatternType", { created: tpt.created, skipped: tpt.skipped })

  // --- 個別マスター（FK 依存順）---
  console.log("\n=== 取引先 / 仕入先 / 工場 / 外注 / 素材 等 ===")
  await seedSimpleMasters(company)

  // --- サマリ ---
  console.log("\n======== 投入結果サマリ ========")
  const masters = [...stats.keys()].sort()
  for (const m of masters) {
    const s = stats.get(m)!
    console.log(
      `${m.padEnd(22)} created=${String(s.created).padStart(3)}  skipped=${String(s.skipped).padStart(3)}  total=${s.created + s.skipped}`,
    )
  }
  const totalCreated = masters.reduce((a, m) => a + stats.get(m)!.created, 0)
  const totalSkipped = masters.reduce((a, m) => a + stats.get(m)!.skipped, 0)
  console.log(
    `${"—".repeat(22)} created=${String(totalCreated).padStart(3)}  skipped=${String(totalSkipped).padStart(3)}`,
  )
  console.log("\n🎉 dev サンプルマスター投入 完了")
}

main()
  .catch((e) => {
    console.error("[seed-dev-sample-data] FATAL:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
