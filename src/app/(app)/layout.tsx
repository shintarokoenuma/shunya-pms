// (app) Route Group: 認証必須エリア（AppShell を適用）
import { AppShell } from "@/components/app-shell/app-shell"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
