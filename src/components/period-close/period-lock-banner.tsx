import { Lock } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { periodLockBannerMessage, type ClosedPeriod } from "@/lib/period-close/lock"

/**
 * B-109 PR-6（§5-3）: 締めた期間の伝票の詳細画面の上に出す帯（server component から使う）。
 * 判定は呼び出し側が checkPeriodLock（src/lib/period-close/lock.ts）で行い、締め中の期間を渡す。
 */
export function PeriodLockBanner({ period }: { period: ClosedPeriod | null }) {
  if (!period) return null
  return (
    <Alert className="border-amber-300 bg-amber-50 text-amber-900">
      <Lock />
      <AlertDescription className="text-amber-900">{periodLockBannerMessage(period)}</AlertDescription>
    </Alert>
  )
}
