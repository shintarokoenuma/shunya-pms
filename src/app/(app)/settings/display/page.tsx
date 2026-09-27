import { getMemoUiPreferences } from "@/lib/actions/company-settings"
import { DisplayPrefsForm } from "../_components/display-prefs-form"

/** B-205 PR-1（P1-D4・D-10）: /settings/display 表示設定（品番カルテのメモ・歯車と同じ設定） */
export default async function SettingsDisplayPage() {
  const r = await getMemoUiPreferences()
  if (!r.ok) {
    return <p className="text-sm text-destructive">{r.error}</p>
  }
  return <DisplayPrefsForm prefs={r.data.prefs} canManage={r.data.canManage} />
}
