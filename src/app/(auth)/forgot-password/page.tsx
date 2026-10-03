import { AuthCard } from "../_components/auth-card"
import { ForgotPasswordForm } from "./forgot-password-form"

/**
 * B-205 PR-3（§4-6・P3-D17）: パスワード再設定の受付（ログイン不要・proxy で許可）
 */
export default function ForgotPasswordPage() {
  return (
    <AuthCard title="パスワードの再設定" footerLink={{ href: "/login", label: "ログイン画面へ戻る" }}>
      <ForgotPasswordForm />
    </AuthCard>
  )
}
