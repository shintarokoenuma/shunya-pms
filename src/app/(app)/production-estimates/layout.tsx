import { requireAreaPage } from "@/lib/area-access"

/**
 * B-243 PR-2（§2-3）: 量産見積の詳細・編集・量産発注の生成をまとめて止める。
 * 役割と権限で「原価・見積」が見えない役割は /dashboard へ（未ログインは /login）
 */
export default async function ProductionEstimatesLayout({ children }: { children: React.ReactNode }) {
  await requireAreaPage("cost")
  return <>{children}</>
}
