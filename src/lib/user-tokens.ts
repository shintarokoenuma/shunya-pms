import { createHash, randomBytes } from "node:crypto"
import type { UserTokenPurpose } from "@prisma/client"
import type { prisma } from "@/lib/prisma"

/**
 * B-205 PR-3（P3-D3〜P3-D5）: 招待・パスワード再設定で共用するトークン（UserToken）。
 * - 生のトークンは乱数 32 バイト（base64url）。DB には SHA-256 の16進だけを保存する（P3-D4）
 * - 新しく作るときは、同じ人・同じ用途の未使用のトークンをすべて revokedAt で無効にする（P3-D5・物理削除しない）
 * - 有効期限は作った時点の値を expiresAt に焼き込む（P3-D3）
 * ★生のトークンはメールの本文にだけ使う。ログ・AuditLog・action の戻り値に出さない
 */

/** 拡張クライアントの $transaction が渡す tx の型（users.ts と同じ取り方） */
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export function generateToken(): string {
  return randomBytes(32).toString("base64url")
}

/** SHA-256 の16進（64文字・純関数） */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex")
}

export type IssuedToken = { token: string; expiresAt: Date }

export async function issueUserToken(
  tx: TxClient,
  args: {
    companyId: string
    userId: string
    purpose: UserTokenPurpose
    ttlMs: number
    createdByUserId: string | null
  },
): Promise<IssuedToken> {
  const now = new Date()
  // 同じ人・同じ用途の未使用を無効にする（再送で古いリンクが生き残らないように）
  await tx.userToken.updateMany({
    where: { companyId: args.companyId, userId: args.userId, purpose: args.purpose, usedAt: null, revokedAt: null },
    data: { revokedAt: now },
  })
  const token = generateToken()
  const expiresAt = new Date(now.getTime() + args.ttlMs)
  await tx.userToken.create({
    data: {
      companyId: args.companyId,
      userId: args.userId,
      purpose: args.purpose,
      tokenHash: hashToken(token),
      expiresAt,
      createdByUserId: args.createdByUserId,
    },
  })
  return { token, expiresAt }
}

export type ValidTokenRow = {
  id: string
  companyId: string
  userId: string
  purpose: UserTokenPurpose
  expiresAt: Date
  createdAt: Date
}

/** 期限切れと「使えない」（使用済み・無効・見つからない）は画面の文を出し分けるため区別する */
export type FindTokenResult =
  | { status: "valid"; row: ValidTokenRow }
  | { status: "expired" }
  | { status: "invalid" }

export async function findValidToken(
  db: Pick<typeof prisma, "userToken">,
  raw: string,
  purpose: UserTokenPurpose,
  now: Date = new Date(),
): Promise<FindTokenResult> {
  const t = (raw ?? "").trim()
  if (t === "" || t.length > 200) return { status: "invalid" }
  const row = await db.userToken.findUnique({
    where: { tokenHash: hashToken(t) },
    select: { id: true, companyId: true, userId: true, purpose: true, expiresAt: true, createdAt: true, usedAt: true, revokedAt: true },
  })
  if (!row || row.purpose !== purpose || row.usedAt || row.revokedAt) return { status: "invalid" }
  if (row.expiresAt.getTime() <= now.getTime()) return { status: "expired" }
  return {
    status: "valid",
    row: { id: row.id, companyId: row.companyId, userId: row.userId, purpose: row.purpose, expiresAt: row.expiresAt, createdAt: row.createdAt },
  }
}
