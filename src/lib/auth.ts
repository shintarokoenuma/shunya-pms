import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import type { UserRole, TenantType } from "@prisma/client"

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

        if (user.status !== "ACTIVE") {
          throw new Error("Account is not active")
        }

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
          name: user.displayName,
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.companyId = (user as { companyId: string }).companyId
        token.tenantType = (user as { tenantType: TenantType }).tenantType
        token.role = (user as { role: UserRole }).role
        return token
      }
      if (!token.id) return null
      const row = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { role: true, status: true, companyId: true, deletedAt: true },
      })
      if (!row || row.deletedAt || row.status !== "ACTIVE" || row.companyId !== token.companyId) return null
      token.role = row.role
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.companyId = token.companyId as string
        session.user.tenantType = token.tenantType as TenantType
        session.user.role = token.role as UserRole
      }
      return session
    },
  },
})
