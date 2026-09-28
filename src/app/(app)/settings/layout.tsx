import {
  ROLES_SECTION_PATH,
  SETTINGS_SECTION_HINTS,
  SETTINGS_SECTION_LABELS,
  settingsSectionPath,
} from "@/lib/settings-visibility"
import { getSettingsAccess } from "./_lib/access"
import { SettingsNav, type SettingsNavItem } from "./_components/settings-nav"

/**
 * B-205（spec v1.0 §3-1・案B）: 「設定」の 1 ページ。左に目次・右に選んだ項目のカード。
 * 見出しは h1 直書き（closings/page.tsx と同じ）。
 * PR-2（P2-D8・P2-D9）: 目次は役割と「役割と権限」で決める。「役割と権限」は誰にでも出す。
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const access = await getSettingsAccess()
  const items: SettingsNavItem[] = [
    ...access.visible.map((s) => ({
      href: settingsSectionPath(s),
      label: SETTINGS_SECTION_LABELS[s],
      hint: SETTINGS_SECTION_HINTS[s],
    })),
    { href: ROLES_SECTION_PATH, label: "役割と権限", hint: "役割ごとに見せる・隠す" },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">設定</h1>
        <p className="text-sm text-muted-foreground">
          会社の情報とユーザーを管理します。オーナーと管理者だけが変更できます。
        </p>
      </div>
      <div className="flex flex-col gap-6 md:flex-row">
        <SettingsNav items={items} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
