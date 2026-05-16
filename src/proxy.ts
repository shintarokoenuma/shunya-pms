import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith("/login")
  const isPublicPage = req.nextUrl.pathname === "/"
  const isApiAuthRoute = req.nextUrl.pathname.startsWith("/api/auth")

  // API認証ルートは常に許可
  if (isApiAuthRoute) {
    return NextResponse.next()
  }

  // ログイン済みでログインページにアクセス → ダッシュボードへ
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  // 未ログインで保護ページにアクセス → ログインページへ
  if (!isLoggedIn && !isAuthPage && !isPublicPage) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
}
