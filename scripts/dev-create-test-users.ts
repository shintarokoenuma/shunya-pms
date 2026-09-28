#!/usr/bin/env tsx
/**
 * B-205 PR-2（P2-D13・§4-8）: dev の確認用ユーザーを作る（★dev 専用・本番には流さない）。
 *
 * 使い方: DEV_TEST_USER_PASSWORD='…' npx tsx scripts/dev-create-test-users.ts
 * - DATABASE_URL のホスト:ポートが hopper.proxy.rlwy.net:12921（dev）でなければ、何も書かずに exit 1
 * - パスワードは環境変数 DEV_TEST_USER_PASSWORD から取る。無ければ exit 1（コードには書かない）
 * - 会社 shunya-master-tenant-id に、email で upsert する（何度流しても同じ・人数は増えない）
 * - 作った・更新した行を 1 行ずつ表示する
 */
import "dotenv/config"
import { PrismaClient, UserRole, UserStatus, Language } from "@prisma/client"
import bcrypt from "bcryptjs"

const EXPECTED_DEV_HOST = "hopper.proxy.rlwy.net:12921"
const COMPANY_ID = "shunya-master-tenant-id"

const TEST_USERS: { email: string; role: UserRole; displayName: string; lastName: string; firstName: string }[] = [
  { email: "dev-admin@example.test", role: UserRole.ADMIN, displayName: "確認用 管理者", lastName: "確認用", firstName: "管理者" },
  { email: "dev-production@example.test", role: UserRole.PRODUCTION, displayName: "確認用 生産管理", lastName: "確認用", firstName: "生産管理" },
  { email: "dev-staff@example.test", role: UserRole.STAFF, displayName: "確認用 一般スタッフ", lastName: "確認用", firstName: "一般スタッフ" },
  { email: "dev-owner2@example.test", role: UserRole.OWNER, displayName: "確認用 オーナー2", lastName: "確認用", firstName: "オーナー2" },
]

async function main() {
  const url = process.env.DATABASE_URL ?? ""
  const host = url.replace(/^.*@/, "").replace(/\/.*$/, "")
  if (host !== EXPECTED_DEV_HOST) {
    console.error(`STOP: DATABASE_URL の接続先が dev（${EXPECTED_DEV_HOST}）ではありません: ${host || "(不明)"}`)
    process.exit(1)
  }
  const password = process.env.DEV_TEST_USER_PASSWORD
  if (!password) {
    console.error("STOP: 環境変数 DEV_TEST_USER_PASSWORD を指定してください")
    process.exit(1)
  }

  const prisma = new PrismaClient()
  try {
    const company = await prisma.company.findUnique({ where: { id: COMPANY_ID }, select: { id: true, companyName: true } })
    if (!company) {
      console.error(`STOP: 会社 ${COMPANY_ID} が見つかりません`)
      process.exit(1)
    }
    const passwordHash = await bcrypt.hash(password, 12)
    console.log(`会社: ${company.companyName}（${company.id}）・host: ${host}`)
    for (const u of TEST_USERS) {
      const before = await prisma.user.findUnique({ where: { email: u.email }, select: { id: true } })
      const row = await prisma.user.upsert({
        where: { email: u.email },
        update: {
          companyId: company.id,
          role: u.role,
          status: UserStatus.ACTIVE,
          displayName: u.displayName,
          lastName: u.lastName,
          firstName: u.firstName,
          passwordHash,
          isExternalUser: false,
          deletedAt: null,
        },
        create: {
          companyId: company.id,
          email: u.email,
          role: u.role,
          status: UserStatus.ACTIVE,
          displayName: u.displayName,
          lastName: u.lastName,
          firstName: u.firstName,
          passwordHash,
          isExternalUser: false,
          language: Language.JA,
        },
        select: { id: true, email: true, role: true, status: true, displayName: true },
      })
      console.log(`  ${before ? "update" : "create"}  ${row.email.padEnd(30)} ${row.role.padEnd(11)} ${row.status.padEnd(8)} ${row.displayName ?? ""}  (${row.id})`)
    }
    const count = await prisma.user.count({ where: { companyId: company.id, deletedAt: null } })
    console.log(`会社のユーザー数（deletedAt なし）: ${count}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
