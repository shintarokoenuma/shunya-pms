import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import NextAuthSessionProvider from "@/components/session-provider"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

// B-187: ラテンは Inter を CSS 変数で供給し、日本語は globals.css の --font-sans スタックで
// OS フォント（ヒラギノ / BIZ UDPGothic 等）へフォールバックさせる。body 直指定はしない。
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: "PMS｜生産管理システム",
  description: "アパレルOEM向け生産管理システム",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // suppressHydrationWarning: ブラウザ拡張（Feedly の data-feedly-mini など）が <html>/<body> に後から足す属性のずれだけを黙らせる。子の要素の hydration のずれは今までどおり警告される
  return (
    <html lang="ja" className={cn("font-sans", inter.variable)} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
