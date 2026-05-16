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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.companyId = (user as { companyId: string }).companyId
        token.tenantType = (user as { tenantType: TenantType }).tenantType
        token.role = (user as { role: UserRole }).role
      }
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
