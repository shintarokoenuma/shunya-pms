import { requireAreaPage } from "@/lib/area-access"

/**
 * B-212 PR-1（P1-D3・D-8）: 仕入請求書（仕入先・工場の請求書）をまとめて止める。
 * 役割と権限で「仕入」が見えない役割は /dashboard へ（未ログインは /login）
 */
export default async function SupplierInvoicesLayout({ children }: { children: React.ReactNode }) {
  await requireAreaPage("purchases")
  return <>{children}</>
}
