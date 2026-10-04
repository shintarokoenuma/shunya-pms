import { requireAreaPage } from "@/lib/area-access"

/**
 * B-243 PR-2（§2-3）: 見積もり（概算・量産）の画面をまとめて止める。
 * 役割と権限で「原価・見積」が見えない役割は /dashboard へ（未ログインは /login）
 */
export default async function QuotationsLayout({ children }: { children: React.ReactNode }) {
  await requireAreaPage("cost")
  return <>{children}</>
}
