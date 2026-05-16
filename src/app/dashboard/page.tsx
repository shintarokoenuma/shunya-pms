import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import LogoutButton from "./logout-button"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // テナント情報を取得
  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
  })

  // マスター情報の件数を取得（動作確認用）
  const stats = await Promise.all([
    prisma.businessTermsGlossary.count(),
    prisma.hsCode.count(),
    prisma.ftaRule.count(),
  ])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">s</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">shunya 生産管理システム</h1>
              <p className="text-xs text-slate-500">{company?.companyName} - {session.user.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{session.user.name}</p>
              <p className="text-xs text-slate-500">{session.user.email}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            👋 ようこそ、{session.user.name}さん
          </h2>
          <p className="text-slate-600">
            shunya 生産管理システムへようこそ。Phase 0 セットアップ完了！
          </p>
        </div>

        {/* システム情報カード */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200">
            <h3 className="text-sm font-medium text-slate-500 mb-2">ログイン情報</h3>
            <dl className="space-y-2">
              <div className="flex justify-between text-sm">
                <dt className="text-slate-600">User ID</dt>
                <dd className="font-mono text-xs text-slate-900">{session.user.id.substring(0, 8)}...</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-slate-600">Company ID</dt>
                <dd className="font-mono text-xs text-slate-900">{session.user.companyId.substring(0, 8)}...</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-slate-600">Tenant Type</dt>
                <dd>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                    {session.user.tenantType}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-slate-600">Role</dt>
                <dd>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    {session.user.role}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200">
            <h3 className="text-sm font-medium text-slate-500 mb-2">マスターデータ</h3>
            <dl className="space-y-3">
              <div className="flex justify-between items-center">
                <dt className="text-sm text-slate-700">業界用語</dt>
                <dd className="text-2xl font-bold text-slate-900">{stats[0]}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-sm text-slate-700">HSコード</dt>
                <dd className="text-2xl font-bold text-slate-900">{stats[1]}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-sm text-slate-700">FTAルール</dt>
                <dd className="text-2xl font-bold text-slate-900">{stats[2]}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Phase 0 達成状況 */}
        <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-2xl p-6 border border-emerald-200">
          <h3 className="text-lg font-bold text-slate-900 mb-3">🎉 Phase 0 完了！</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span> Next.js 16 + TypeScript + Tailwind CSS
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span> Prisma 6 + Railway PostgreSQL (119 models)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span> 初期データ投入完了（shunya MASTER_ADMIN）
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span> NextAuth.js v5 認証基盤
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span> マルチテナント対応（Tenant Type: {session.user.tenantType}）
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}
