import { getCompanyProfile } from "@/lib/actions/company-profile"
import { CompanyProfileForm } from "../_components/company-profile-form"

/** B-205 PR-1（P1-D4）: /settings/company 自社情報 */
export default async function SettingsCompanyPage() {
  const r = await getCompanyProfile()
  if (!r.ok) {
    return <p className="text-sm text-destructive">{r.error}</p>
  }
  return <CompanyProfileForm profile={r.data.profile} canManage={r.data.canManage} />
}
