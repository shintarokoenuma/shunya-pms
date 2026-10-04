import { requireAreaPage } from "@/lib/area-access"

/**
 * B-243 PR-4（§2-2・D4-3）: 素材の新規を止める。
 * 役割と権限で「マスターの取引条件・編集」が見えない役割は /dashboard へ（未ログインは /login）
 */
export default async function NewMaterialsLayout({ children }: { children: React.ReactNode }) {
  await requireAreaPage("masterTerms")
  return <>{children}</>
}
