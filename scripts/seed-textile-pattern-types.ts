#!/usr/bin/env tsx
/**
 * Phase 1A-13d: 柄種別マスター (TextilePatternType) シード — **dev 専用エントリ**
 *
 * - ロジック・データ定義は `scripts/seeds/textile-pattern-types-core.ts` に共通化
 * - 本ファイルは「dev 用ガード + 呼び出し」だけを担う
 *
 * dev ガード:
 *   DATABASE_URL が既知の本番ホスト (shuttle.proxy.rlwy.net:16099) を含む場合は abort
 *
 * 使い方 (dev DB に投入する場合のみ):
 *   npx tsx scripts/seed-textile-pattern-types.ts
 *
 * 本番に投入したい場合は専用エントリ (seed-textile-pattern-types-prod.ts、PR-3 で追加) を使う。
 */
import { PrismaClient } from "@prisma/client"
import { seedTextilePatternTypes } from "./seeds/textile-pattern-types-core"

const prisma = new PrismaClient()

// 既知の本番ホスト (誤適用ガード)
const KNOWN_PROD_HOSTS = ["shuttle.proxy.rlwy.net:16099"]

async function main() {
  const hostMatch = (process.env.DATABASE_URL ?? "").match(/@([^/]+)\//)
  const host = hostMatch?.[1] ?? "(unknown)"
  console.log(`[seed-textile-pattern-types | dev] DB host: ${host}`)

  for (const h of KNOWN_PROD_HOSTS) {
    if ((process.env.DATABASE_URL ?? "").includes(h)) {
      console.error(
        `[FATAL] DATABASE_URL points to a known production host (${h}). Aborting.`,
      )
      console.error(
        "        本番へ投入する場合は専用エントリ (seed-textile-pattern-types-prod.ts) を使用してください。",
      )
      process.exit(1)
    }
  }

  await seedTextilePatternTypes(prisma)
}

main()
  .catch((e) => {
    console.error("[seed-textile-pattern-types | dev] FATAL:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
