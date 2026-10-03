import Link from "next/link"
import { RESET_EXPIRED_MESSAGE, RESET_INVALID_MESSAGE, lookupPasswordResetToken } from "@/lib/actions/password-reset"
import { AuthCard } from "../../_components/auth-card"
import { SetPasswordForm } from "../../_components/set-password-form"

/**
 * B-205 PR-3（§4-6・P3-D17）: 新しいパスワードを決めるページ（ログイン不要・proxy で許可）。
 * 期限切れ・使えないときは文と /forgot-password へのリンクを出す
 */
export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const found = await lookupPasswordResetToken(token)

  if (found.status !== "valid") {
    return (
      <AuthCard title="パスワードの再設定" footerLink={{ href: "/login", label: "ログイン画面へ" }}>
        <p className="text-sm text-slate-700">{found.status === "expired" ? RESET_EXPIRED_MESSAGE : RESET_INVALID_MESSAGE}</p>
        <p className="text-sm mt-4">
          <Link href="/forgot-password" className="text-slate-900 underline">
            再設定のメールを送り直す
          </Link>
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="新しいパスワード">
      <SetPasswordForm token={token} mode="reset" />
    </AuthCard>
  )
}
