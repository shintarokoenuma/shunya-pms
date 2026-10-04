import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getMyProfile } from "@/lib/actions/profile"
import { ROLE_LABELS } from "@/lib/constants/user-roles"
import { ProfileNameForm } from "./_components/profile-name-form"
import { ChangePasswordForm } from "./_components/change-password-form"

/**
 * B-244（D-1）: /profile 自分のプロフィール。ログインしている人なら誰でも開ける（役割と権限の対象外）。
 * 「設定」の下には置かない（設定は「オーナーと管理者だけが変更できます」の画面のため）。カードは「名前」「パスワード」の2枚
 */
export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const r = await getMyProfile()
  if (!r.ok) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{r.error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">プロフィール</h1>
        <p className="text-sm text-muted-foreground">自分の名前とパスワードを変えられます。</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ProfileNameForm profile={r.data} roleLabel={ROLE_LABELS[r.data.role]} />
        <ChangePasswordForm />
      </div>
    </div>
  )
}
