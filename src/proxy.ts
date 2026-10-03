import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith("/login")
  const isPublicPage = req.nextUrl.pathname === "/"
  // B-205 PR-3（P3-D17）: ログインしていなくても開ける3つ（招待を受ける・再設定の受付・再設定）。ログイン中の人が開いても使える
  const isPublicAuthPage =
    req.nextUrl.pathname.startsWith("/invite/") ||
    req.nextUrl.pathname === "/forgot-password" ||
    req.nextUrl.pathname.startsWith("/reset-password/")
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
  if (!isLoggedIn && !isAuthPage && !isPublicPage && !isPublicAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
}
