import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { isSessionStale } from "@/lib/session-validity"
import type { UserRole, TenantType } from "@prisma/client"
// B-244: "next-auth/jwt" の JWT 型を拡張するには先にモジュールを読み込む必要がある（副作用だけの import）
import "next-auth/jwt"

// NextAuth.js 用の型拡張
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string | null
      companyId: string
      tenantType: TenantType
      role: UserRole
    }
  }

  interface User {
    companyId: string
    tenantType: TenantType
    role: UserRole
  }
}

// B-244（D-5）: その端末でログインした時刻（ms）。passwordChangedAt がこれより後なら切る
declare module "next-auth/jwt" {
  interface JWT {
    loginAt?: number
  }
}

/**
 * B-205 PR-2（慎太郎さん 2026-09-28）: 停止・アーカイブ・削除済みの人が正しいパスワードでログインしたとき、
 * ログイン画面に「停止されています」と出すための code 付きエラー。
 * ★パスワードが違うときは投げない（メールだけで在籍や停止が他人に分からないように・null のまま）。
 */
class AccountSuspendedError extends CredentialsSignin {
  code = "account_suspended"
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { company: true },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        // 順番は「パスワード照合 → 状態の確認」。パスワードが違えば状態に関わらず null（失敗回数+1 も今までどおり）
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!isValid) {
          // ログイン失敗カウントを増やす
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: { increment: 1 } },
          })
          return null
        }

        // パスワードは正しいが、停止・アーカイブ・削除済み → code 付きで止める（成功扱いにしない）
        if (user.deletedAt || user.status !== "ACTIVE") {
          throw new AccountSuspendedError()
        }

        // ログイン成功：失敗カウントをリセット、最終ログイン更新
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lastLoginAt: new Date(),
          },
        })

        return {
          id: user.id,
          email: user.email,
          // B-244（D-3）: 表示名が無ければ「姓 名」（ログイン直後から出る）
          name: user.displayName ?? `${user.lastName} ${user.firstName}`,
          companyId: user.companyId,
          tenantType: user.company.tenantType,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    // B-205 PR-2（spec v1.0 D-6・P2-D1）: 役割と状態は画面を開くたびに User の行で読み直す。
    // ログイン直後（user がある時）は authorize の値を焼く。それ以外の呼び出しでは主キーで 1 行読み、
    // 行が無い・deletedAt がある・ACTIVE でない・companyId が違う、のどれかなら null（＝ログアウト）。
    // ★1 回の画面表示で auth() は proxy・layout・page・action から複数回呼ばれ、そのたびに 1 行読む（人数が増えたら見直す・§9）
    // B-244（D-3・D-5）: 名前（displayName ?? "姓 名"）も読み直して token.name に入れる（変えたらすぐ右上に出る）。
    // ログイン直後に token.loginAt（ms）を持ち、passwordChangedAt がそれより後なら null（＝ほかの端末も切れる）。
    // loginAt の無い token（このデプロイ前からのログイン）は、その場の時刻として扱い締め出さない
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.companyId = (user as { companyId: string }).companyId
        token.tenantType = (user as { tenantType: TenantType }).tenantType
        token.role = (user as { role: UserRole }).role
        token.name = user.name ?? null
        token.loginAt = Date.now()
        return token
      }
      if (!token.id) return null
      if (typeof token.loginAt !== "number") token.loginAt = Date.now()
      const row = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: {
          role: true,
          status: true,
          companyId: true,
          deletedAt: true,
          displayName: true,
          lastName: true,
          firstName: true,
          passwordChangedAt: true,
        },
      })
      if (!row || row.deletedAt || row.status !== "ACTIVE" || row.companyId !== token.companyId) return null
      if (isSessionStale(row.passwordChangedAt, token.loginAt)) return null
      token.role = row.role
      token.name = row.displayName ?? `${row.lastName} ${row.firstName}`
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.companyId = token.companyId as string
        session.user.tenantType = token.tenantType as TenantType
        session.user.role = token.role as UserRole
        session.user.name = (token.name as string | null | undefined) ?? null
      }
      return session
    },
  },
})
