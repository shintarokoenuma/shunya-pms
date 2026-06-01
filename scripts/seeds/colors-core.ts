/**
 * Phase 1A-13c: 色マスター (Color) シードの共通モジュール
 *
 * - 仕様書 color-master-spec-confirmation-2026-06-01.md の初期 50 色
 * - 冪等: `companyId + colorNumber` の unique を key にして「既存ならスキップ」方式
 * - AuditLog を新規作成時のみ書き込み (B-010 教訓: シード経由でも痕跡を残す)
 * - 単一 $transaction でくくり、timeout 120s に拡張 (B-009 教訓)
 *
 * このモジュールは **ホストガードを持たない**。
 * ホストガード (dev のみ通す / 本番のみ通す + 三重ガード) は呼び出し側エントリの責務。
 *
 * 呼び出し側:
 * - scripts/seed-colors.ts        (dev 専用エントリ、dev でないと abort)
 */
import { PrismaClient } from "@prisma/client"

type ColorRow = {
  colorNumber: string
  colorName: string
  cmyk: string
  hex: string
}

// ─────────────────────────────────────────────────── 初期 51 色 (00 + 奇数 01〜99)
// "00" = カラー未定 (マルチ/プリント/総柄など単色指定なし)。cmyk/hex は空文字。
export const COLORS: readonly ColorRow[] = [
  { colorNumber: "00", colorName: "カラー未定",     cmyk: "",             hex: "" },
  { colorNumber: "01", colorName: "晒し",           cmyk: "0.0.0.4",      hex: "#F4F4F2" },
  { colorNumber: "03", colorName: "オフホワイト",   cmyk: "0.2.6.5",      hex: "#E8E6DF" },
  { colorNumber: "05", colorName: "ライトグレー",   cmyk: "0.0.2.18",     hex: "#D2D2CE" },
  { colorNumber: "07", colorName: "シルバーグレー", cmyk: "0.0.3.29",     hex: "#B6B6B1" },
  { colorNumber: "09", colorName: "アッシュグレー", cmyk: "0.0.3.40",     hex: "#9A9A95" },
  { colorNumber: "11", colorName: "サーモン",       cmyk: "0.45.40.0",    hex: "#F4998A" },
  { colorNumber: "13", colorName: "コーラル",       cmyk: "0.65.55.0",    hex: "#E8645A" },
  { colorNumber: "15", colorName: "レッド",         cmyk: "0.85.80.0",    hex: "#DD3B3E" },
  { colorNumber: "17", colorName: "クリムゾン",     cmyk: "10.95.80.10",  hex: "#B0202C" },
  { colorNumber: "19", colorName: "バーガンディ",   cmyk: "20.95.70.40",  hex: "#7A1A2A" },
  { colorNumber: "21", colorName: "アプリコット",   cmyk: "0.30.45.0",    hex: "#F6C18C" },
  { colorNumber: "23", colorName: "オレンジ",       cmyk: "0.50.80.0",    hex: "#F0913C" },
  { colorNumber: "25", colorName: "パンプキン",     cmyk: "0.60.90.5",    hex: "#E5731E" },
  { colorNumber: "27", colorName: "テラコッタ",     cmyk: "10.65.85.25",  hex: "#C25A2E" },
  { colorNumber: "29", colorName: "バーントオレンジ", cmyk: "20.70.90.45",  hex: "#8F4420" },
  { colorNumber: "31", colorName: "クリーム",       cmyk: "0.5.35.2",     hex: "#F4E8B0" },
  { colorNumber: "33", colorName: "レモン",         cmyk: "0.10.75.0",    hex: "#F2DA4C" },
  { colorNumber: "35", colorName: "イエロー",       cmyk: "0.20.80.5",    hex: "#E8C53C" },
  { colorNumber: "37", colorName: "マスタード",     cmyk: "0.30.90.25",   hex: "#C99A1E" },
  { colorNumber: "39", colorName: "オーカー",       cmyk: "0.35.90.45",   hex: "#9A7A1A" },
  { colorNumber: "41", colorName: "ミント",         cmyk: "35.0.30.0",    hex: "#A8E6C0" },
  { colorNumber: "43", colorName: "グラスグリーン", cmyk: "55.0.70.0",    hex: "#6FC85A" },
  { colorNumber: "45", colorName: "グリーン",       cmyk: "70.0.75.20",   hex: "#4FA453" },
  { colorNumber: "47", colorName: "フォレスト",     cmyk: "80.20.90.45",  hex: "#2E7038" },
  { colorNumber: "49", colorName: "ボトルグリーン", cmyk: "90.30.90.65",  hex: "#1A4A28" },
  { colorNumber: "51", colorName: "サックス",       cmyk: "40.10.0.0",    hex: "#99E6FF" },
  { colorNumber: "53", colorName: "ターコイズ",     cmyk: "70.0.25.0",    hex: "#4DE6BF" },
  { colorNumber: "55", colorName: "ロイヤルブルー", cmyk: "90.65.0.0",    hex: "#1A59FF" },
  { colorNumber: "57", colorName: "ネイビー",       cmyk: "100.85.0.40",  hex: "#001799" },
  { colorNumber: "59", colorName: "ミッドナイト",   cmyk: "100.90.30.65", hex: "#00093E" },
  { colorNumber: "61", colorName: "ラベンダー",     cmyk: "20.30.0.0",    hex: "#C8B0E6" },
  { colorNumber: "63", colorName: "モーブ",         cmyk: "35.50.0.0",    hex: "#A578C8" },
  { colorNumber: "65", colorName: "パープル",       cmyk: "50.70.0.5",    hex: "#8A52BE" },
  { colorNumber: "67", colorName: "バイオレット",   cmyk: "65.85.0.20",   hex: "#6A2E96" },
  { colorNumber: "69", colorName: "プラム",         cmyk: "70.90.20.45",  hex: "#481A66" },
  { colorNumber: "71", colorName: "ベビーピンク",   cmyk: "0.35.5.0",     hex: "#F4B8D2" },
  { colorNumber: "73", colorName: "ピンク",         cmyk: "0.60.20.0",    hex: "#E87AA8" },
  { colorNumber: "75", colorName: "ローズ",         cmyk: "5.75.30.10",   hex: "#D2547F" },
  { colorNumber: "77", colorName: "マゼンタ",       cmyk: "15.90.30.20",  hex: "#B0285E" },
  { colorNumber: "79", colorName: "フューシャ",     cmyk: "25.95.40.45",  hex: "#7A1A42" },
  { colorNumber: "81", colorName: "ベージュ",       cmyk: "0.15.35.10",   hex: "#E0C8A0" },
  { colorNumber: "83", colorName: "キャメル",       cmyk: "0.30.55.25",   hex: "#C89A5E" },
  { colorNumber: "85", colorName: "ブラウン",       cmyk: "10.45.70.40",  hex: "#9A6B3C" },
  { colorNumber: "87", colorName: "チョコレート",   cmyk: "20.55.75.60",  hex: "#6E4A28" },
  { colorNumber: "89", colorName: "エスプレッソ",   cmyk: "30.60.80.75",  hex: "#4A301A" },
  { colorNumber: "91", colorName: "スチールグレー", cmyk: "0.0.0.50",     hex: "#808080" },
  { colorNumber: "93", colorName: "スレートグレー", cmyk: "5.5.0.62",     hex: "#66666B" },
  { colorNumber: "95", colorName: "ダークグレー",   cmyk: "0.0.0.70",     hex: "#4D4D4D" },
  { colorNumber: "97", colorName: "チャコール",     cmyk: "0.0.0.80",     hex: "#333336" },
  { colorNumber: "99", colorName: "ブラック",       cmyk: "0.0.0.100",    hex: "#1A1A1A" },
] as const

/**
 * 共通シード関数。
 * テナント (MASTER_ADMIN) と AuditLog 用ユーザーを解決し、
 * 50 色を冪等に投入する。
 *
 * 戻り値: `{ created, skipped }` (合計 50 行に対する内訳)
 */
export async function seedColors(
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
      console.log(`\n[Colors] processing ${COLORS.length} rows`)
      for (const row of COLORS) {
        const hueGroup = parseInt(row.colorNumber[0], 10)
        const toneStep = parseInt(row.colorNumber[1], 10)
        const sortOrder = parseInt(row.colorNumber, 10)
        if (
          !Number.isInteger(hueGroup) ||
          !Number.isInteger(toneStep) ||
          !Number.isInteger(sortOrder)
        ) {
          throw new Error(
            `Invalid colorNumber "${row.colorNumber}" — must be 2-digit numeric`,
          )
        }

        const existing = await tx.color.findUnique({
          where: {
            companyId_colorNumber: {
              companyId: company.id,
              colorNumber: row.colorNumber,
            },
          },
          select: { id: true },
        })
        if (existing) {
          skipped++
          console.log(
            `  ⊘ ${row.colorNumber} ${row.colorName.padEnd(16)} skip`,
          )
          continue
        }
        const c = await tx.color.create({
          data: {
            companyId: company.id,
            colorNumber: row.colorNumber,
            colorName: row.colorName,
            hueGroup,
            toneStep,
            cmyk: row.cmyk,
            hex: row.hex,
            impression: null,
            sortOrder,
            status: "ACTIVE",
          },
          select: {
            id: true,
            colorNumber: true,
            colorName: true,
            hueGroup: true,
            toneStep: true,
          },
        })
        await tx.auditLog.create({
          data: {
            companyId: company.id,
            userId: seedUserId,
            action: "CREATE",
            entityType: "Color",
            entityId: c.id,
            afterData: {
              colorNumber: c.colorNumber,
              colorName: c.colorName,
              hueGroup: c.hueGroup,
              toneStep: c.toneStep,
              cmyk: row.cmyk,
              hex: row.hex,
              seedScript: "seeds/colors-core.ts",
            },
          },
        })
        created++
        console.log(
          `  ✓ ${row.colorNumber} ${row.colorName.padEnd(16)} created`,
        )
      }
    },
    { maxWait: 15_000, timeout: 120_000 },
  )

  console.log(`\n[結果] 作成: ${created} 件 / skip: ${skipped} 件`)

  // 最終検証 (logging のみ)
  const total = await prisma.color.count({
    where: { companyId: company.id, deletedAt: null },
  })
  console.log(`[検証] total=${total}  (期待: ${COLORS.length})`)

  if (total === COLORS.length) {
    console.log("✓ seed 完了 — 件数すべて期待値通り")
  } else {
    console.warn(
      "[WARN] 件数が期待値と異なります。冪等チェックでスキップされた行が想定外の状態かも",
    )
  }

  return { created, skipped }
}
