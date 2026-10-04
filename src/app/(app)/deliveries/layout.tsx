import { requireAreaPage } from "@/lib/area-access"

/**
 * B-243 PR-3（§2-3）: 納品書の一覧・詳細・新規・編集をまとめて止める。
 * 役割と権限で「納品」が見えない役割は /dashboard へ（未ログインは /login）
 */
export default async function DeliveriesLayout({ children }: { children: React.ReactNode }) {
  await requireAreaPage("delivery")
  return <>{children}</>
}
