#!/usr/bin/env tsx
/**
 * Phase 1A-13c: 色マスター (Color) シード — **本番専用エントリ**
 *
 * 三重ガード (seed-cost-categories-prod.ts と同形):
 *   1. 明示フラグ: 環境変数 CONFIRM_PROD_SEED=COLOR_51 を要求
 *   2. 本番ホスト必須: DATABASE_URL に shuttle.proxy.rlwy.net:16099 を含むこと
 *      (本番スクリプトなのに dev を指していたら止める = dev 誤爆防止)
 *   3. 対話確認: 接続先・テナント・投入予定を表示し、stdin で "yes" を待つ
 *      (非 TTY 環境では abort)
 *
 * 投入ロジック自体は scripts/seeds/colors-core.ts と共通。
 *
 * 使い方 (本番に投入する場合のみ):
 *   DATABASE_URL=<本番 URL> CONFIRM_PROD_SEED=COLOR_51 \
 *     npx tsx scripts/seed-colors-prod.ts
 */
import { createInterface } from "node:readline/promises"
import { PrismaClient } from "@prisma/client"
import { seedColors, COLORS } from "./seeds/colors-core"

const REQUIRED_PROD_HOST = "shuttle.proxy.rlwy.net:16099"
const REQUIRED_FLAG = "COLOR_51"

const prisma = new PrismaClient()

async function promptYes(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error(
      "[ABORT] 対話確認が必要ですが、非 TTY 環境です。対話端末で実行してください。",
    )
    return false
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = (await rl.question(question)).trim()
    return answer === "yes"
  } finally {
    rl.close()
  }
}

async function main() {
  // ─── ガード 1: 明示フラグ ───
  if (process.env.CONFIRM_PROD_SEED !== REQUIRED_FLAG) {
    console.error(
      `[ABORT] 本番投入には CONFIRM_PROD_SEED=${REQUIRED_FLAG} が必要です。`,
    )
    process.exit(1)
  }

  // ─── ガード 2: 本番ホスト必須 (dev 誤爆防止) ───
  const hostMatch = (process.env.DATABASE_URL ?? "").match(/@([^/]+)\//)
  const host = hostMatch?.[1] ?? "(unknown)"
  if (!(process.env.DATABASE_URL ?? "").includes(REQUIRED_PROD_HOST)) {
    console.error(
      `[ABORT] このスクリプトは本番ホスト(${REQUIRED_PROD_HOST})専用です。現在の接続先: ${host}`,
    )
    process.exit(1)
  }

  // ─── テナント情報を先読み (対話確認の表示用) ───
  const company = await prisma.company.findFirst({
    where: { tenantType: "MASTER_ADMIN" },
    select: { id: true, companyName: true },
  })
  if (!company) {
    console.error("[ABORT] MASTER_ADMIN tenant not found")
    process.exit(1)
  }

  // ─── ガード 3: 対話確認 ───
  const banner = [
    "",
    "======== 本番シード投入の確認 ========",
    `接続先 host: ${host}`,
    `テナント   : ${company.companyName} (${company.id})`,
    `投入予定   : Color ${COLORS.length} 件 (00 カラー未定 + 奇数 01〜99)`,
    `冪等       : 既存があればスキップ (companyId + colorNumber)`,
    "本当に本番へ投入しますか? (yes/no): ",
  ].join("\n")
  const ok = await promptYes(banner)
  if (!ok) {
    console.error("[ABORT] ユーザーが yes を入力しなかったため中止しました。")
    process.exit(1)
  }

  // ─── 投入実行 ───
  console.log(`\n[seed-colors | prod] 三重ガード通過。投入を開始します。`)
  await seedColors(prisma)
}

main()
  .catch((e) => {
    console.error("[seed-colors | prod] FATAL:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
