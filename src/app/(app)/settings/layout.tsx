import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { SettingsNav } from "./_components/settings-nav"

/**
 * B-205 PR-1（spec v1.0 §3-1・案B）: 「設定」の 1 ページ。左に目次・右に選んだ項目のカード。
 * 見出しは h1 直書き（closings/page.tsx と同じ）。外部ユーザー（EXTERNAL）はダッシュボードへ戻す。
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role === "EXTERNAL") redirect("/dashboard")

  return (
    <div className="space-y-6 p-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">設定</h1>
        <p className="text-sm text-muted-foreground">
          会社の情報とユーザーを管理します。オーナーと管理者だけが変更できます。
        </p>
      </div>
      <div className="flex flex-col gap-6 md:flex-row">
        <SettingsNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
