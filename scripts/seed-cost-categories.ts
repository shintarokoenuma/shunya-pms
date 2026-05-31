#!/usr/bin/env tsx
/**
 * Phase 1A-16 / 1A-17: 原価費目マスター (CostCategory) シード — **dev 専用エントリ**
 *
 * - ロジック・データ定義は `scripts/seeds/cost-categories-core.ts` に共通化
 * - 本ファイルは「dev 用ガード + 呼び出し」だけを担う
 *
 * dev ガード:
 *   DATABASE_URL が既知の本番ホスト (shuttle.proxy.rlwy.net:16099) を含む場合は abort
 *
 * 使い方 (dev DB に投入する場合のみ):
 *   npx tsx scripts/seed-cost-categories.ts
 *
 * 本番に投入したい場合は scripts/seed-cost-categories-prod.ts を使う。
 */
import { PrismaClient } from "@prisma/client"
import { seedCostCategories } from "./seeds/cost-categories-core"

const prisma = new PrismaClient()

// 既知の本番ホスト (誤適用ガード)
const KNOWN_PROD_HOSTS = ["shuttle.proxy.rlwy.net:16099"]

async function main() {
  const hostMatch = (process.env.DATABASE_URL ?? "").match(/@([^/]+)\//)
  const host = hostMatch?.[1] ?? "(unknown)"
  console.log(`[seed-cost-categories | dev] DB host: ${host}`)

  for (const h of KNOWN_PROD_HOSTS) {
    if ((process.env.DATABASE_URL ?? "").includes(h)) {
      console.error(
        `[FATAL] DATABASE_URL points to a known production host (${h}). Aborting.`,
      )
      console.error(
        "        本番へ投入する場合は scripts/seed-cost-categories-prod.ts を使用してください。",
      )
      process.exit(1)
    }
  }

  await seedCostCategories(prisma)
}

main()
  .catch((e) => {
    console.error("[seed-cost-categories | dev] FATAL:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
