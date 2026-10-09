#!/usr/bin/env tsx
/**
 * B-070 名寄せマスター（v0.3）→ 仕入先・工場・外注先 一括登録 — **本番専用エントリ**
 *
 * 三重ガード（seed-colors-prod.ts / seed-cost-categories-prod.ts と同形）:
 *   1. 明示フラグ: 環境変数 CONFIRM_PROD_SEED=B070_MASTER_541 を要求
 *   2. 本番ホスト必須: DATABASE_URL に shuttle.proxy.rlwy.net:16099 を含むこと（dev を指していたら止める）
 *   3. 対話確認: 接続先・テナント・CSV・dry-run の集計を表示し、stdin で "yes" を待つ（非 TTY 環境では abort）
 *
 * ★--dry-run を先に流し、「c. 社名が同じ既存あり・コード違い」の一覧を見てから実投入する（本番には手で登録した会社があるため）。
 * ★この PR の merge とは別の操作。merge しても本番には何も入らない。
 *
 * 使い方（本番に投入する場合のみ・慎太郎さんが実行）:
 *   DATABASE_URL=<本番 URL> CONFIRM_PROD_SEED=B070_MASTER_541 npx tsx scripts/seed-b070-master-prod.ts --dry-run
 *   DATABASE_URL=<本番 URL> CONFIRM_PROD_SEED=B070_MASTER_541 npx tsx scripts/seed-b070-master-prod.ts
 */
import { createInterface } from "node:readline/promises"
import { PrismaClient } from "@prisma/client"
import { DEFAULT_CSV, formatSummary, seedB070Master } from "./seeds/b070-master-core"

const REQUIRED_PROD_HOST = "shuttle.proxy.rlwy.net:16099"
const REQUIRED_FLAG = "B070_MASTER_541"

const prisma = new PrismaClient()

function parseArgs(argv: string[]): { dryRun: boolean; file: string } {
  const opts = { dryRun: false, file: DEFAULT_CSV }
  for (const a of argv) {
    if (a === "--dry-run" || a === "--dryRun") opts.dryRun = true
    else if (a.startsWith("--file=")) opts.file = a.slice("--file=".length)
    else throw new Error(`未知のオプション: ${a}`)
  }
  return opts
}

async function promptYes(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error("[ABORT] 対話確認が必要ですが、非 TTY 環境です。対話端末で実行してください。")
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
  const opts = parseArgs(process.argv.slice(2))

  // ─── ガード 1: 明示フラグ ───
  if (process.env.CONFIRM_PROD_SEED !== REQUIRED_FLAG) {
    console.error(`[ABORT] 本番投入には CONFIRM_PROD_SEED=${REQUIRED_FLAG} が必要です。`)
    process.exit(1)
  }
  // ─── ガード 2: 本番ホスト必須（dev 誤爆防止）───
  const host = (process.env.DATABASE_URL ?? "").match(/@([^/]+)\//)?.[1] ?? "(unknown)"
  if (!(process.env.DATABASE_URL ?? "").includes(REQUIRED_PROD_HOST)) {
    console.error(`[ABORT] このスクリプトは本番ホスト(${REQUIRED_PROD_HOST})専用です。現在の接続先: ${host}`)
    process.exit(1)
  }
  const company = await prisma.company.findFirst({ where: { tenantType: "MASTER_ADMIN" }, select: { id: true, companyName: true } })
  if (!company) {
    console.error("[ABORT] MASTER_ADMIN tenant not found")
    process.exit(1)
  }

  // dry-run はガード 3 を通らずに読み取りだけ（何も書かない）
  if (opts.dryRun) {
    console.log(`[seed-b070-master | prod] DRY-RUN（読み取りのみ）host: ${host}`)
    const summary = await seedB070Master(prisma, { ...opts, dryRun: true })
    console.log(formatSummary(summary))
    return
  }

  // ─── ガード 3: 対話確認（実投入の前に dry-run の集計を見せる）───
  const preview = await seedB070Master(prisma, { ...opts, dryRun: true, log: () => {} })
  const banner = [
    "",
    "======== 本番シード投入の確認 ========",
    `接続先 host: ${host}`,
    `テナント   : ${company.companyName} (${company.id})`,
    `CSV        : ${opts.file}`,
    formatSummary(preview),
    `冪等       : 既存があればスキップ（companyId + code・社名が同じ既存も作らない）`,
    "本当に本番へ投入しますか? (yes/no): ",
  ].join("\n")
  const ok = await promptYes(banner)
  if (!ok) {
    console.error("[ABORT] ユーザーが yes を入力しなかったため中止しました。")
    process.exit(1)
  }
  console.log(`\n[seed-b070-master | prod] 三重ガード通過。投入を開始します。`)
  const summary = await seedB070Master(prisma, { ...opts, dryRun: false })
  console.log(formatSummary(summary))
}

main()
  .catch((e) => {
    console.error("[seed-b070-master | prod] FATAL:", e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
