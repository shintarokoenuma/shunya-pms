import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getRolePermissions } from "@/lib/settings-visibility-db"
import { visibleAreas } from "@/lib/settings-visibility"
import { Header } from "./header"
import { Sidebar } from "./sidebar"
import { PageAccentBar } from "./page-accent-bar"

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  // Company は TENANT_MODELS 対象外なので Extension の影響なし
  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { companyName: true },
  })

  // B-243 PR-1（§2-10）: 役割と権限で見える領域。サイドバー（PC）とヘッダの ☰（MobileNav）の両方に渡す
  const perms = await getRolePermissions(session.user.companyId)
  const areas = visibleAreas(perms, session.user.role)

  const user = {
    id: session.user.id,
    name: session.user.name ?? session.user.email.split("@")[0],
    email: session.user.email,
    role: session.user.role,
    tenantType: session.user.tenantType,
    companyName: company?.companyName ?? "",
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar visibleAreas={areas} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header user={user} visibleAreas={areas} />
        <PageAccentBar />
        <main className="flex-1 overflow-auto">
          {/* B-093 PR-1（D-6）: 768px 未満は余白を詰める */}
          <div className="max-w-7xl mx-auto px-4 py-4 md:px-6 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
