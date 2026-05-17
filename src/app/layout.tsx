import type { Metadata } from "next"
import { Inter, Geist } from "next/font/google"
import "./globals.css"
import NextAuthSessionProvider from "@/components/session-provider"
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="ja" className={cn("font-sans", geist.variable)}>
      <body className={inter.className}>
        <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
      </body>
    </html>
  )
}
