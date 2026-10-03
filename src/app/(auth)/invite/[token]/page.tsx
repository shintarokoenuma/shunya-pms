import { INVITE_EXPIRED_MESSAGE, INVITE_INVALID_MESSAGE, lookupInvitation } from "@/lib/actions/invitations"
import { AuthCard } from "../../_components/auth-card"
import { SetPasswordForm } from "../../_components/set-password-form"

/**
 * B-205 PR-3（§4-5・P3-D17）: 招待を受けるページ（ログイン不要・proxy で許可）。
 * 使えるなら会社名・氏名・メールを出してパスワードを決めてもらう。期限切れと「使えない」は文を出し分ける
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const found = await lookupInvitation(token)

  if (found.status !== "valid") {
    return (
      <AuthCard title="招待" footerLink={{ href: "/login", label: "ログイン画面へ" }}>
        <p className="text-sm text-slate-700">{found.status === "expired" ? INVITE_EXPIRED_MESSAGE : INVITE_INVALID_MESSAGE}</p>
      </AuthCard>
    )
  }

  return (
    <AuthCard title={`${found.companyName} への招待`}>
      <dl className="mb-6 space-y-1 text-sm">
        <div className="flex gap-3">
          <dt className="w-24 text-slate-500">会社</dt>
          <dd className="text-slate-900">{found.companyName}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 text-slate-500">お名前</dt>
          <dd className="text-slate-900">{found.name}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 text-slate-500">メール</dt>
          <dd className="text-slate-900 break-all">{found.email}</dd>
        </div>
      </dl>
      <p className="text-sm text-slate-600 mb-4">ログインに使うパスワードを決めてください。</p>
      <SetPasswordForm token={token} mode="invite" />
    </AuthCard>
  )
}
