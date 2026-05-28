#!/usr/bin/env tsx
/**
 * 標準カテゴリセット(ProductCategory + MaterialCategory)を CSV から一括投入する。
 *
 * 詳細は scripts/seeds/README.md を参照。
 */
import { PrismaClient, Prisma } from "@prisma/client"
import Papa from "papaparse"
import * as fs from "node:fs"
import * as path from "node:path"

type Target = "product" | "material"

type CategoryRow = {
  categoryCode: string
  categoryName: string
  categoryNameEn: string
  parentCategoryCode: string
  level: number
  status: string
}

type Options = {
  target: "product" | "material" | "all"
  dryRun: boolean
  file?: string
  tenant: string
}

type SeedStats = {
  created: number
  skipped: number
  errors: number
}

// ───────────────────────────────────────────────────────── ANSI

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
}
const useColor = process.stdout.isTTY
const c = (color: keyof typeof ANSI, text: string) =>
  useColor ? `${ANSI[color]}${text}${ANSI.reset}` : text

// ───────────────────────────────────────────────────────── arg parse

function parseArgs(argv: string[]): Options {
  const opts: Options = { target: "all", dryRun: false, tenant: "shunya" }
  let targetSet = false
  for (const a of argv) {
    if (a === "--dry-run" || a === "--dryRun") {
      opts.dryRun = true
    } else if (a.startsWith("--target=")) {
      const v = a.slice("--target=".length)
      if (v !== "product" && v !== "material" && v !== "all") {
        throw new Error(
          `--target は product / material / all のいずれかを指定してください (got: ${v})`,
        )
      }
      opts.target = v
      targetSet = true
    } else if (a.startsWith("--file=")) {
      opts.file = a.slice("--file=".length)
    } else if (a.startsWith("--tenant=")) {
      opts.tenant = a.slice("--tenant=".length)
    } else if (a === "-h" || a === "--help") {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`未知のオプション: ${a}`)
    }
  }
  if (!targetSet) {
    throw new Error(
      "--target=product | --target=material | --target=all を指定してください",
    )
  }
  return opts
}

function printHelp(): void {
  console.log(`使い方:
  npx tsx scripts/seed-categories.ts --target=<product|material|all> [options]

オプション:
  --target=<v>   product | material | all (必須)
  --dry-run      実投入せず ROLLBACK
  --file=<path>  CSV パス (既定: scripts/seeds/seed-<target>-categories.csv)
  --tenant=<s>   テナント解決キー (既定: shunya)
                 - UUID 形式 → Company.id
                 - 'shunya'  → tenantType=MASTER_ADMIN
                 - その他    → companyName 部分一致

環境変数:
  SEED_COMPANY_ID  companyId を直接指定 (最優先)
`)
}

// ───────────────────────────────────────────────────────── tenant

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function resolveCompanyId(
  prisma: PrismaClient,
  tenant: string,
): Promise<{ companyId: string; companyName: string }> {
  const env = process.env.SEED_COMPANY_ID?.trim()
  if (env) {
    const c = await prisma.company.findUnique({
      where: { id: env },
      select: { id: true, companyName: true },
    })
    if (!c) {
      throw new Error(
        `SEED_COMPANY_ID=${env} に対応する Company が見つかりません`,
      )
    }
    return { companyId: c.id, companyName: c.companyName }
  }

  if (UUID_RE.test(tenant)) {
    const c = await prisma.company.findUnique({
      where: { id: tenant },
      select: { id: true, companyName: true },
    })
    if (!c) {
      throw new Error(`Company.id=${tenant} に対応する会社が見つかりません`)
    }
    return { companyId: c.id, companyName: c.companyName }
  }

  if (tenant.toLowerCase() === "shunya") {
    const c = await prisma.company.findFirst({
      where: { tenantType: "MASTER_ADMIN" },
      select: { id: true, companyName: true },
    })
    if (!c) {
      throw new Error(
        "tenantType=MASTER_ADMIN の Company が見つかりません (shunya テナント未作成?)",
      )
    }
    return { companyId: c.id, companyName: c.companyName }
  }

  const c = await prisma.company.findFirst({
    where: {
      companyName: { contains: tenant, mode: "insensitive" },
    },
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
  })
  if (!c) {
    throw new Error(
      `companyName に "${tenant}" を含む Company が見つかりません`,
    )
  }
  return { companyId: c.id, companyName: c.companyName }
}

// ───────────────────────────────────────────────────────── CSV

function loadCsv(filepath: string): CategoryRow[] {
  if (!fs.existsSync(filepath)) {
    throw new Error(`CSV ファイルが見つかりません: ${filepath}`)
  }
  const content = fs.readFileSync(filepath, "utf-8").replace(/^﻿/, "")
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
  })
  if (result.errors.length > 0) {
    const first = result.errors[0]
    throw new Error(
      `CSV パース失敗: ${first.message} (row=${first.row ?? "?"})`,
    )
  }
  return result.data.map((r, idx) => {
    const levelRaw = (r.level ?? "").trim()
    const level = Number.parseInt(levelRaw, 10)
    if (!Number.isFinite(level) || level < 1 || level > 3) {
      throw new Error(
        `行 ${idx + 2}: level は 1〜3 の整数で指定してください (got: ${levelRaw})`,
      )
    }
    return {
      categoryCode: (r.categoryCode ?? "").trim(),
      categoryName: (r.categoryName ?? "").trim(),
      categoryNameEn: (r.categoryNameEn ?? "").trim(),
      parentCategoryCode: (r.parentCategoryCode ?? "").trim(),
      level,
      status: (r.status ?? "ACTIVE").trim() || "ACTIVE",
    }
  })
}

// ───────────────────────────────────────────────────────── seed core

type TxClient = Prisma.TransactionClient

async function seedCategoryTarget(
  tx: TxClient,
  companyId: string,
  target: Target,
  rows: CategoryRow[],
  dryRun: boolean,
): Promise<SeedStats> {
  const stats: SeedStats = { created: 0, skipped: 0, errors: 0 }
  const delegate = (
    target === "product" ? tx.productCategory : tx.materialCategory
  ) as {
    findFirst: (args: unknown) => Promise<{ id: string; categoryCode: string } | null>
    create: (args: unknown) => Promise<{ id: string; categoryCode: string }>
  }

  const label = target === "product" ? "ProductCategory" : "MaterialCategory"
  const tag = c("cyan", `[${label}]`)

  const lv1 = rows.filter((r) => r.level === 1)
  const lv2 = rows.filter((r) => r.level === 2)
  const lv3plus = rows.filter((r) => r.level >= 3)
  if (lv3plus.length > 0) {
    console.warn(
      c(
        "yellow",
        `  ! Lv3 以上は本スクリプトでは対象外 (${lv3plus.length} 件 skip)`,
      ),
    )
  }

  console.log(`\n${tag} ${c("bold", "Lv1")} ${lv1.length} 件処理中...`)
  const codeToId = new Map<string, string>()
  for (const row of lv1) {
    try {
      const existing = await delegate.findFirst({
        where: {
          companyId,
          categoryCode: row.categoryCode,
          deletedAt: null,
        },
        select: { id: true, categoryCode: true },
      })
      if (existing) {
        codeToId.set(row.categoryCode, existing.id)
        stats.skipped += 1
        console.log(
          `  ${c("gray", "⊘")} ${row.categoryCode} (${row.categoryName}) ${c("gray", "skip (既存)")}`,
        )
        continue
      }
      const created = await delegate.create({
        data: {
          companyId,
          categoryCode: row.categoryCode,
          categoryName: row.categoryName,
          categoryNameEn: row.categoryNameEn || null,
          parentCategoryId: null,
          level: 1,
          status: row.status,
        },
        select: { id: true, categoryCode: true },
      })
      codeToId.set(row.categoryCode, created.id)
      stats.created += 1
      console.log(
        `  ${c("green", "✓")} ${row.categoryCode} (${row.categoryName}) 作成`,
      )
    } catch (e) {
      stats.errors += 1
      console.error(
        c(
          "red",
          `  ✗ ${row.categoryCode}: ${e instanceof Error ? e.message : String(e)}`,
        ),
      )
    }
  }

  console.log(`\n${tag} ${c("bold", "Lv2")} ${lv2.length} 件処理中...`)
  for (const row of lv2) {
    try {
      let parentId = codeToId.get(row.parentCategoryCode)
      if (!parentId) {
        const parent = await delegate.findFirst({
          where: {
            companyId,
            categoryCode: row.parentCategoryCode,
            deletedAt: null,
          },
          select: { id: true, categoryCode: true },
        })
        if (parent) {
          parentId = parent.id
          codeToId.set(row.parentCategoryCode, parent.id)
        }
      }
      if (!parentId) {
        stats.errors += 1
        console.error(
          c(
            "red",
            `  ✗ ${row.categoryCode}: 親 ${row.parentCategoryCode} が CSV 内・DB のいずれにも見つかりません`,
          ),
        )
        continue
      }

      const existing = await delegate.findFirst({
        where: {
          companyId,
          categoryCode: row.categoryCode,
          deletedAt: null,
        },
        select: { id: true, categoryCode: true },
      })
      if (existing) {
        codeToId.set(row.categoryCode, existing.id)
        stats.skipped += 1
        console.log(
          `  ${c("gray", "⊘")} ${row.categoryCode} (${row.categoryName}, parent=${row.parentCategoryCode}) ${c("gray", "skip (既存)")}`,
        )
        continue
      }

      const created = await delegate.create({
        data: {
          companyId,
          categoryCode: row.categoryCode,
          categoryName: row.categoryName,
          categoryNameEn: row.categoryNameEn || null,
          parentCategoryId: parentId,
          level: 2,
          status: row.status,
        },
        select: { id: true, categoryCode: true },
      })
      codeToId.set(row.categoryCode, created.id)
      stats.created += 1
      console.log(
        `  ${c("green", "✓")} ${row.categoryCode} (${row.categoryName}, parent=${row.parentCategoryCode}) 作成`,
      )
    } catch (e) {
      stats.errors += 1
      console.error(
        c(
          "red",
          `  ✗ ${row.categoryCode}: ${e instanceof Error ? e.message : String(e)}`,
        ),
      )
    }
  }

  if (dryRun) {
    console.log(c("yellow", `\n  (dry-run: ${label} の変更は ROLLBACK される)`))
  }
  return stats
}

// ───────────────────────────────────────────────────────── runner

async function runOneTarget(
  prisma: PrismaClient,
  companyId: string,
  target: Target,
  opts: Options,
): Promise<SeedStats> {
  const defaultFile = `scripts/seeds/seed-${target}-categories.csv`
  const filepath = path.resolve(opts.file ?? defaultFile)
  const rows = loadCsv(filepath)
  console.log(
    `\n${c("cyan", "[seed-categories]")} CSV 読み込み: ${path.relative(process.cwd(), filepath)} (${rows.length} 件)`,
  )

  let stats: SeedStats = { created: 0, skipped: 0, errors: 0 }

  // Prisma の interactive transaction は既定 5 秒で expire するため、
  // 数十件のシーケンシャル投入に耐えられるよう余裕を持たせる。
  const txOptions = { maxWait: 15_000, timeout: 120_000 }

  if (opts.dryRun) {
    try {
      await prisma.$transaction(async (tx) => {
        stats = await seedCategoryTarget(tx, companyId, target, rows, true)
        throw new DryRunRollback()
      }, txOptions)
    } catch (e) {
      if (!(e instanceof DryRunRollback)) throw e
    }
  } else {
    await prisma.$transaction(async (tx) => {
      stats = await seedCategoryTarget(tx, companyId, target, rows, false)
    }, txOptions)
  }

  return stats
}

class DryRunRollback extends Error {
  constructor() {
    super("__DRY_RUN_ROLLBACK__")
    this.name = "DryRunRollback"
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))
  console.log(
    `${c("bold", "[seed-categories]")} target=${opts.target}, dryRun=${opts.dryRun}, tenant=${opts.tenant}`,
  )

  const prisma = new PrismaClient()
  try {
    const tenant = await resolveCompanyId(prisma, opts.tenant)
    console.log(
      `${c("cyan", "[seed-categories]")} テナント: ${tenant.companyName} (companyId=${tenant.companyId})`,
    )

    const totals: SeedStats = { created: 0, skipped: 0, errors: 0 }
    const targets: Target[] =
      opts.target === "all" ? ["product", "material"] : [opts.target]
    for (const t of targets) {
      const s = await runOneTarget(prisma, tenant.companyId, t, opts)
      totals.created += s.created
      totals.skipped += s.skipped
      totals.errors += s.errors
    }

    console.log(`\n${c("bold", "[結果]")}`)
    console.log(`  ${c("green", "作成成功")}: ${totals.created} 件`)
    console.log(`  ${c("gray", "skip (既存)")}: ${totals.skipped} 件`)
    console.log(
      `  ${totals.errors > 0 ? c("red", "エラー") : "エラー"}: ${totals.errors} 件`,
    )

    if (opts.dryRun) {
      console.log(
        c(
          "yellow",
          "\n✓ dry-run 完了。実投入は --dry-run を外して再実行してください。",
        ),
      )
    } else if (totals.errors > 0) {
      console.log(c("red", "\n✗ 完了 (エラーあり)"))
      process.exit(1)
    } else {
      console.log(c("green", "\n✓ 投入完了"))
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(c("red", `\n[seed-categories] FATAL: ${err instanceof Error ? err.message : String(err)}`))
  if (err instanceof Error && err.stack) console.error(c("gray", err.stack))
  process.exit(1)
})
