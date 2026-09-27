import { getMemoUiPreferences } from "@/lib/actions/company-settings"
import { requireSettingsSection } from "../_lib/access"
import { DisplayPrefsForm } from "../_components/display-prefs-form"

/**
 * B-205（P1-D4・D-10・P2-D8）: /settings/display 表示設定（品番カルテのメモ・歯車と同じ設定）。
 * 隠された役割は見える最初の項目へ。★getMemoUiPreferences 自体は止めない（品番カルテでも使う）
 */
export default async function SettingsDisplayPage() {
  await requireSettingsSection("display")
  const r = await getMemoUiPreferences()
  if (!r.ok) {
    return <p className="text-sm text-destructive">{r.error}</p>
  }
  return <DisplayPrefsForm prefs={r.data.prefs} canManage={r.data.canManage} />
}
