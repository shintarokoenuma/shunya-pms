import { getCompanyProfile } from "@/lib/actions/company-profile"
import { requireSettingsSection } from "../_lib/access"
import { BankAccountForm } from "../_components/bank-account-form"

/** B-205（P1-D4・P2-D8）: /settings/bank 振込先。隠された役割は見える最初の項目へ */
export default async function SettingsBankPage() {
  await requireSettingsSection("bank")
  const r = await getCompanyProfile("bank")
  if (!r.ok) {
    return <p className="text-sm text-destructive">{r.error}</p>
  }
  return <BankAccountForm bank={r.data.bank} canManage={r.data.canManage} />
}
