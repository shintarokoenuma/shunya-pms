import { requireAreaPage } from "@/lib/area-access"

/**
 * B-243 PR-2（§2-3・D2-5）: 受注の一覧・詳細・新規・編集をまとめて止める。
 * 役割と権限で「受注」が見えない役割は /dashboard へ（未ログインは /login）
 */
export default async function SalesOrdersLayout({ children }: { children: React.ReactNode }) {
  await requireAreaPage("sales")
  return <>{children}</>
}
