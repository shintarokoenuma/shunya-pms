import { redirect } from "next/navigation"
import { getSettingsAccess } from "./_lib/access"

/** B-205（P1-D4・P2-D8）: /settings は、その役割に見える最初の項目へ */
export default async function SettingsIndexPage() {
  const access = await getSettingsAccess()
  redirect(access.firstPath)
}
