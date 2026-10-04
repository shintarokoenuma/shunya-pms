import { requireAreaPage } from "@/lib/area-access"

/**
 * B-243 PR-1（§2-3・C-D4）: 発注（仕入 PO）の一覧・詳細・新規・編集をまとめて止める。
 * 役割と権限で「発注」が見えない役割は /dashboard へ（未ログインは /login）
 */
export default async function PurchaseOrdersLayout({ children }: { children: React.ReactNode }) {
  await requireAreaPage("orders")
  return <>{children}</>
}
