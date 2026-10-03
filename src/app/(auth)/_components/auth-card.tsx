import Link from "next/link"

/**
 * B-205 PR-3: ログイン画面と同じ見た目の枠（ログイン不要のページで共用）。
 * ログイン画面自体は自前のレイアウトのまま（§5・変えない）
 */
export function AuthCard({
  title,
  children,
  footerLink,
}: {
  title: string
  children: React.ReactNode
  footerLink?: { href: string; label: string }
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">P</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">PMS</h1>
          <p className="text-slate-600 mt-2">生産管理システム</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">{title}</h2>
          {children}
        </div>

        {footerLink && (
          <p className="text-center text-sm mt-6">
            <Link href={footerLink.href} className="text-slate-600 underline hover:text-slate-900">
              {footerLink.label}
            </Link>
          </p>
        )}
        <p className="text-center text-sm text-slate-500 mt-6">© 2026 shunya. All rights reserved.</p>
      </div>
    </div>
  )
}

export const authInputClass =
  "w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent transition disabled:bg-slate-50 disabled:cursor-not-allowed"
export const authButtonClass =
  "w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
