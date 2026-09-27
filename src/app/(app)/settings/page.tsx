import { redirect } from "next/navigation"

/** B-205 PR-1（P1-D4）: /settings は最初の項目（自社情報）へ */
export default function SettingsIndexPage() {
  redirect("/settings/company")
}
