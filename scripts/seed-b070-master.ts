#!/usr/bin/env tsx
/**
 * B-070 名寄せマスター（v0.3）→ 仕入先・工場・外注先 一括登録 — **dev 専用エントリ**
 *
 * - ロジックは scripts/seeds/b070-master-core.ts に共通化。本ファイルは「dev 用ガード + 呼び出し」だけ
 * - dev ガード（seed-dev-sample-data.ts と同じ）: DATABASE_URL が本番ホスト（shuttle.proxy.rlwy.net:16099）なら常に abort。
 *   期待 dev ホスト（hopper.proxy.rlwy.net:12921）以外は ALLOW_DEV_HOST_OVERRIDE=1 が無ければ abort
 *
 * 使い方（dev DB にだけ）:
 *   npx tsx scripts/seed-b070-master.ts --dry-run   # 作成予定とスキップの一覧だけ出す（DB に書かない）
 *   npx tsx scripts/seed-b070-master.ts             # 実投入（★--dry-run の出力を見てから）
 *   --file=<path> で CSV を変えられる（既定 scripts/seeds/b070-master-seed-v0_3.csv）
 */
import { PrismaClient } from "@prisma/client"
import { DEFAULT_CSV, formatSummary, seedB070Master } from "./seeds/b070-master-core"

const prisma = new PrismaClient()
const EXPECTED_DEV_HOST = "hopper.proxy.rlwy.net:12921"
const KNOWN_PROD_HOSTS = ["shuttle.proxy.rlwy.net:16099"]

function parseArgs(argv: string[]): { dryRun: boolean; file: string } {
  const opts = { dryRun: false, file: DEFAULT_CSV }
  for (const a of argv) {
    if (a === "--dry-run" || a === "--dryRun") opts.dryRun = true
    else if (a.startsWith("--file=")) opts.file = a.slice("--file=".length)
    else throw new Error(`未知のオプション: ${a}`)
  }
  return opts
}

function guardHost(): string {
  const url = process.env.DATABASE_URL ?? ""
  const host = url.match(/@([^/]+)\//)?.[1] ?? "(unknown)"
  console.log(`[seed-b070-master | dev] DB host: ${host}`)
  for (const prod of KNOWN_PROD_HOSTS) {
    if (url.includes(prod)) {
      console.error(`[FATAL] DATABASE_URL は本番ホスト(${prod})を指しています。dev 専用スクリプトのため中止します。`)
      process.exit(1)
    }
  }
  if (host !== EXPECTED_DEV_HOST && process.env.ALLOW_DEV_HOST_OVERRIDE !== "1") {
    console.error(`[FATAL] 期待する dev ホスト(${EXPECTED_DEV_HOST})と一致しません: ${host}（続行するなら ALLOW_DEV_HOST_OVERRIDE=1）`)
    process.exit(1)
  }
  return host
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  guardHost()
  const summary = await seedB070Master(prisma, opts)
  console.log(formatSummary(summary))
}

main()
  .catch((e) => {
    console.error("[seed-b070-master | dev] FATAL:", e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
