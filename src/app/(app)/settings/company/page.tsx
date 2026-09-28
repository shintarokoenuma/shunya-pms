import { getCompanyProfile } from "@/lib/actions/company-profile"
import { requireSettingsSection } from "../_lib/access"
import { CompanyProfileForm } from "../_components/company-profile-form"

/** B-205（P1-D4・P2-D8）: /settings/company 自社情報。隠された役割は見える最初の項目へ */
export default async function SettingsCompanyPage() {
  await requireSettingsSection("company")
  const r = await getCompanyProfile("company")
  if (!r.ok) {
    return <p className="text-sm text-destructive">{r.error}</p>
  }
  return <CompanyProfileForm profile={r.data.profile} canManage={r.data.canManage} />
}
