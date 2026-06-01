#!/usr/bin/env tsx
/**
 * Phase 1A-13c: 色マスター (Color) シード — **dev 専用エントリ**
 *
 * - ロジック・データ定義は `scripts/seeds/colors-core.ts` に共通化
 * - 本ファイルは「dev 用ガード + 呼び出し」だけを担う
 *
 * dev ガード:
 *   DATABASE_URL が既知の本番ホスト (shuttle.proxy.rlwy.net:16099) を含む場合は abort
 *
 * 使い方 (dev DB に投入する場合のみ):
 *   npx tsx scripts/seed-colors.ts
 *
 * 本番に投入したい場合は専用エントリ (将来追加) を使う。
 */
import { PrismaClient } from "@prisma/client"
import { seedColors } from "./seeds/colors-core"

const prisma = new PrismaClient()

// 既知の本番ホスト (誤適用ガード)
const KNOWN_PROD_HOSTS = ["shuttle.proxy.rlwy.net:16099"]

async function main() {
  const hostMatch = (process.env.DATABASE_URL ?? "").match(/@([^/]+)\//)
  const host = hostMatch?.[1] ?? "(unknown)"
  console.log(`[seed-colors | dev] DB host: ${host}`)

  for (const h of KNOWN_PROD_HOSTS) {
    if ((process.env.DATABASE_URL ?? "").includes(h)) {
      console.error(
        `[FATAL] DATABASE_URL points to a known production host (${h}). Aborting.`,
      )
      console.error(
        "        本番へ投入する場合は専用エントリ (seed-colors-prod.ts) を使用してください。",
      )
      process.exit(1)
    }
  }

  await seedColors(prisma)
}

main()
  .catch((e) => {
    console.error("[seed-colors | dev] FATAL:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
