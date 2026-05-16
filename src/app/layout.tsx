import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import NextAuthSessionProvider from "@/components/session-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "shunya 生産管理システム",
  description: "アパレルOEM向け生産管理システム",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
      </body>
    </html>
  )
}
