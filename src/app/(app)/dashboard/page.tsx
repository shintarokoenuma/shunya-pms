import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const stats = await Promise.all([
    prisma.businessTermsGlossary.count(),
    prisma.hsCode.count(),
    prisma.ftaRule.count(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-1">
          👋 ようこそ、{session.user.name}さん
        </h2>
        <p className="text-muted-foreground text-sm">
          shunya 生産管理システムへようこそ。Phase 0 セットアップ完了！
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ログイン情報
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">User ID</dt>
                <dd className="font-mono text-xs">
                  {session.user.id.substring(0, 8)}...
                </dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Company ID</dt>
                <dd className="font-mono text-xs">
                  {session.user.companyId.substring(0, 8)}...
                </dd>
              </div>
              <div className="flex justify-between text-sm items-center">
                <dt className="text-muted-foreground">Tenant Type</dt>
                <dd>
                  <Badge variant="secondary">{session.user.tenantType}</Badge>
                </dd>
              </div>
              <div className="flex justify-between text-sm items-center">
                <dt className="text-muted-foreground">Role</dt>
                <dd>
                  <Badge variant="outline">{session.user.role}</Badge>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              マスターデータ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between items-center">
                <dt className="text-sm">業界用語</dt>
                <dd className="text-2xl font-bold">{stats[0]}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-sm">HSコード</dt>
                <dd className="text-2xl font-bold">{stats[1]}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-sm">FTAルール</dt>
                <dd className="text-2xl font-bold">{stats[2]}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🎉 Phase 0 完了！</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span>
              <span>Next.js 16 + TypeScript + Tailwind CSS</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span>
              <span>Prisma 6 + Railway PostgreSQL (119 models)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span>
              <span>初期データ投入完了（shunya MASTER_ADMIN）</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span>
              <span>NextAuth.js v5 認証基盤</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span>
              <span>
                マルチテナント対応（Tenant Type: {session.user.tenantType}）
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span>
              <span>
                Prisma Extension（companyId 自動付与・論理削除・監査ログ）
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span>
              <span>shadcn/ui 共通コンポーネント</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-600">✓</span>
              <span>AppShell（サイドバー + ヘッダー）</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
