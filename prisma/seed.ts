import { PrismaClient, TenantType, UserRole, UserStatus, Language, Currency } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding database...")

  // ===== shunya マスター管理者テナント =====
  const shunyaCompany = await prisma.company.upsert({
    where: { id: "shunya-master-tenant-id" },
    update: {},
    create: {
      id: "shunya-master-tenant-id",
      companyName: "shunya",
      legalEntity: "shunya合同会社",
      tenantType: TenantType.MASTER_ADMIN,
      defaultLanguage: Language.JA,
      defaultCurrency: Currency.JPY,
      timezone: "Asia/Tokyo",
      status: "ACTIVE",
    },
  })
  console.log("✅ shunya テナント作成:", shunyaCompany.id)

  // ===== Shin (オーナーユーザー) - 必須フィールドのみ =====
  const hashedPassword = await bcrypt.hash("shunya2026!", 12)
  const shinUser = await prisma.user.upsert({
    where: { email: "shin@shunya.jp" },
    update: {},
    create: {
      companyId: shunyaCompany.id,
      email: "shin@shunya.jp",
      firstName: "慎太郎",
      lastName: "肥沼",
      displayName: "Shin",
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
      passwordHash: hashedPassword,
      language: Language.JA,
    },
  })
  console.log("✅ オーナーユーザー作成:", shinUser.email)

  // ===== 業界用語マスター =====
  const terms = [
    { termCode: "spec_sheet", termJa: "仕様書", termEn: "Specification Sheet", termZh: "规格书", termVi: "Bảng quy cách", category: "縫製", descriptionJa: "製品の詳細仕様を記載した書類", descriptionEn: "Document detailing product specifications" },
    { termCode: "moq", termJa: "最低発注ロット", termEn: "Minimum Order Quantity", termZh: "最小订单量", termVi: "Số lượng đặt hàng tối thiểu", category: "貿易", descriptionJa: "受注を受ける際の最小数量", descriptionEn: "Minimum quantity required for an order" },
    { termCode: "cmt", termJa: "CMT契約", termEn: "Cut Make Trim Contract", termZh: "来料加工合同", termVi: "Hợp đồng gia công CMT", category: "縫製", descriptionJa: "材料支給で縫製のみを発注する契約形態", descriptionEn: "Contract where materials are supplied and only sewing is outsourced" },
    { termCode: "fob", termJa: "本船渡し", termEn: "Free On Board", termZh: "船上交货", category: "貿易", descriptionJa: "輸出港の本船に積み込むまでの費用を売り手が負担するインコタームズ", descriptionEn: "Incoterm where the seller pays costs until goods are loaded on the vessel" },
    { termCode: "bom", termJa: "資材表", termEn: "Bill of Materials", termZh: "物料清单", termVi: "Danh mục vật tư", category: "縫製", descriptionJa: "製品を構成する材料・部品の一覧", descriptionEn: "List of materials and components used in a product" },
  ]

  for (const term of terms) {
    await prisma.businessTermsGlossary.upsert({
      where: { termCode: term.termCode },
      update: term,
      create: term,
    })
  }
  console.log(`✅ 業界用語マスター: ${terms.length}件作成`)

  // ===== HSコード マスター =====
  const hsCodes = [
    { hsCode: "6109.10", chapter: "61", description: "Tシャツ、シングレット及びその他の肌着（綿製）", descriptionEn: "T-shirts, singlets and other vests, knitted or crocheted, of cotton" },
    { hsCode: "6203.42", chapter: "62", description: "男子用ズボン（綿製）", descriptionEn: "Men's trousers, breeches and shorts, of cotton" },
    { hsCode: "6204.62", chapter: "62", description: "女子用ズボン（綿製）", descriptionEn: "Women's trousers, breeches and shorts, of cotton" },
    { hsCode: "5208.31", chapter: "52", description: "綿織物（無地、平織、軽量）", descriptionEn: "Woven fabrics of cotton, plain, lightweight" },
    { hsCode: "5402.20", chapter: "54", description: "ポリエステル長繊維糸", descriptionEn: "High tenacity yarn of polyesters" },
  ]

  for (const hs of hsCodes) {
    await prisma.hsCode.upsert({
      where: { hsCode: hs.hsCode },
      update: hs,
      create: hs,
    })
  }
  console.log(`✅ HSコード: ${hsCodes.length}件作成`)

  // ===== FTAルール マスター =====
  const ftaRules = [
    {
      ftaCode: "JVEPA-6109.10-VN-JP",
      ftaName: "日越EPA",
      exportingCountry: "VN",
      importingCountry: "JP",
      hsCode: "6109.10",
      originCriteria: "CTH (Change in Tariff Heading)",
      formType: "Form VJ",
      baseRate: 10.9,
      preferentialRate: 0,
      effectiveFrom: new Date("2009-10-01"),
      isActive: true,
    },
    {
      ftaCode: "RCEP-6109.10-VN-JP",
      ftaName: "RCEP",
      exportingCountry: "VN",
      importingCountry: "JP",
      hsCode: "6109.10",
      originCriteria: "CTH or RVC40",
      formType: "RCEP-CO",
      baseRate: 10.9,
      preferentialRate: 0,
      effectiveFrom: new Date("2022-01-01"),
      isActive: true,
    },
    {
      ftaCode: "ACFTA-6109.10-CN-JP",
      ftaName: "ASEAN-China FTA",
      exportingCountry: "CN",
      importingCountry: "JP",
      hsCode: "6109.10",
      originCriteria: "CTH",
      formType: "Form E",
      baseRate: 10.9,
      preferentialRate: 0,
      effectiveFrom: new Date("2010-01-01"),
      isActive: true,
    },
  ]

  for (const rule of ftaRules) {
    await prisma.ftaRule.upsert({
      where: { ftaCode: rule.ftaCode },
      update: rule,
      create: rule,
    })
  }
  console.log(`✅ FTAルール: ${ftaRules.length}件作成`)

  console.log("\n🎉 Seeding completed successfully!")
  console.log("\n📊 Created data summary:")
  console.log(`   - shunya tenant: 1 (MASTER_ADMIN)`)
  console.log(`   - Owner user: shin@shunya.jp / shunya2026!`)
  console.log(`   - Business terms: ${terms.length}`)
  console.log(`   - HS codes: ${hsCodes.length}`)
  console.log(`   - FTA rules: ${ftaRules.length}`)
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
