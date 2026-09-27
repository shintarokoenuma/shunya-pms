import { getCompanyProfile } from "@/lib/actions/company-profile"
import { BankAccountForm } from "../_components/bank-account-form"

/** B-205 PR-1（P1-D4）: /settings/bank 振込先 */
export default async function SettingsBankPage() {
  const r = await getCompanyProfile()
  if (!r.ok) {
    return <p className="text-sm text-destructive">{r.error}</p>
  }
  return <BankAccountForm bank={r.data.bank} canManage={r.data.canManage} />
}
