import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Header } from "./header"
import { Sidebar } from "./sidebar"

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

  const user = {
    id: session.user.id,
    name: session.user.name ?? session.user.email.split("@")[0],
    email: session.user.email,
    role: session.user.role,
    tenantType: session.user.tenantType,
    companyName: company?.companyName ?? "shunya",
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header user={user} />
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
