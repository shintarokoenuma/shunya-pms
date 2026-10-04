import { requireAreaPage } from "@/lib/area-access"

/**
 * B-243 PR-3（§2-3）: 締めをまとめて止める。
 * 役割と権限で「経理」が見えない役割は /dashboard へ（未ログインは /login）
 */
export default async function ClosingsLayout({ children }: { children: React.ReactNode }) {
  await requireAreaPage("accounting")
  return <>{children}</>
}
