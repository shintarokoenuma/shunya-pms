/**
 * Phase 1A-13d: 柄種別マスター (TextilePatternType) シードの共通モジュール
 *
 * - 確定仕様 textile-pattern-master-spec-confirmation-v0_2-2026-06-01.md の 9 種別
 * - 冪等: `companyId + typeCode` の unique を key にして「既存ならスキップ」方式
 * - AuditLog を新規作成時のみ書き込み (B-010 教訓: シード経由でも痕跡を残す)
 * - 単一 $transaction でくくり、timeout 120s に拡張 (B-009 教訓)
 *
 * このモジュールは **ホストガードを持たない**。
 * ホストガード (dev のみ通す / 本番のみ通す + 三重ガード) は呼び出し側エントリの責務。
 *
 * 呼び出し側:
 * - scripts/seed-textile-pattern-types.ts  (dev 専用エントリ、dev でないと abort)
 */
import { PrismaClient } from "@prisma/client"

type PatternTypeRow = {
  typeCode: string
  typeName: string
  description: string
}

// ─────────────────────────────────────────────────── 種別 7 種
// B-066(2026-06-17): DT(ドット)→PR内包・SOLID(無地)→カラー対応 として種別から除外。
//   既存 dev/本番の DT/SOLID 行は UI から ARCHIVED 化済み（再 seed で復活させないため定義からも削除）。
// sortOrder は配列順で 10 刻み採番 (将来の挿入余地を残す)
export const PATTERN_TYPES: readonly PatternTypeRow[] = [
  { typeCode: "BD", typeName: "ボーダー",   description: "横縞" },
  { typeCode: "ST", typeName: "ストライプ", description: "縦縞" },
  { typeCode: "CK", typeName: "チェック",   description: "格子（ギンガム/タータン等を内包）" },
  { typeCode: "PR", typeName: "プリント",   description: "図案・グラフィックプリント（ドット内包）" },
  { typeCode: "AO", typeName: "総柄",       description: "オールオーバー（全面反復柄）" },
  { typeCode: "ML", typeName: "マルチ",     description: "多色・配色指定なしの混在" },
  { typeCode: "OT", typeName: "その他",     description: "上記に当てはまらない柄" },
] as const

/**
 * 共通シード関数。
 * テナント (MASTER_ADMIN) と AuditLog 用ユーザーを解決し、
 * 9 種別を冪等に投入する。
 *
 * 戻り値: `{ created, skipped }`
 */
export async function seedTextilePatternTypes(
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
      console.log(`\n[PatternTypes] processing ${PATTERN_TYPES.length} rows`)
      for (let i = 0; i < PATTERN_TYPES.length; i++) {
        const row = PATTERN_TYPES[i]
        const sortOrder = (i + 1) * 10

        const existing = await tx.textilePatternType.findUnique({
          where: {
            companyId_typeCode: {
              companyId: company.id,
              typeCode: row.typeCode,
            },
          },
          select: { id: true },
        })
        if (existing) {
          skipped++
          console.log(
            `  ⊘ ${row.typeCode.padEnd(6)} ${row.typeName.padEnd(10)} skip`,
          )
          continue
        }
        const c = await tx.textilePatternType.create({
          data: {
            companyId: company.id,
            typeCode: row.typeCode,
            typeName: row.typeName,
            description: row.description,
            sortOrder,
            status: "ACTIVE",
          },
          select: {
            id: true,
            typeCode: true,
            typeName: true,
            sortOrder: true,
          },
        })
        await tx.auditLog.create({
          data: {
            companyId: company.id,
            userId: seedUserId,
            action: "CREATE",
            entityType: "TextilePatternType",
            entityId: c.id,
            afterData: {
              typeCode: c.typeCode,
              typeName: c.typeName,
              description: row.description,
              sortOrder: c.sortOrder,
              status: "ACTIVE",
              seedScript: "seeds/textile-pattern-types-core.ts",
            },
          },
        })
        created++
        console.log(
          `  ✓ ${row.typeCode.padEnd(6)} ${row.typeName.padEnd(10)} created`,
        )
      }
    },
    { maxWait: 15_000, timeout: 120_000 },
  )

  console.log(`\n[結果] 作成: ${created} 件 / skip: ${skipped} 件`)

  // 最終検証 (logging のみ)
  const total = await prisma.textilePatternType.count({
    where: { companyId: company.id, deletedAt: null },
  })
  console.log(`[検証] total=${total}  (期待: ${PATTERN_TYPES.length})`)

  if (total === PATTERN_TYPES.length) {
    console.log("✓ seed 完了 — 件数すべて期待値通り")
  } else {
    console.warn(
      "[WARN] 件数が期待値と異なります。冪等チェックでスキップされた行が想定外の状態かも",
    )
  }

  return { created, skipped }
}
