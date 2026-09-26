"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { closePeriod, type CloseWarning } from "@/lib/actions/period-closes"
import type { PERIOD_CLOSE_COUNTERPART_VALUES } from "@/lib/validators/period-close"
import { fmtMonthPeriod } from "./labels"

/**
 * B-109 PR-6（§5-2）: 「締める」「締め直す」の確認ダイアログ（参考画面の文言）。
 * - 残っている伝票（P6-D10）があれば件数と番号を出す。残っていても締められる。
 * - 仕入先・工場・外注先は 3 行目の文言が違う（P6-D8）。
 */
export function ClosePeriodDialog({
  label,
  counterpartType,
  counterpartId,
  counterpartName,
  month,
  periodStart,
  periodEnd,
  warnings,
}: {
  label: "締める" | "締め直す"
  counterpartType: (typeof PERIOD_CLOSE_COUNTERPART_VALUES)[number]
  counterpartId: string
  counterpartName: string
  month: string
  periodStart: string
  periodEnd: string
  warnings: CloseWarning[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isClient = counterpartType === "CLIENT"

  const submit = () => {
    startTransition(async () => {
      const r = await closePeriod({ counterpartType, counterpartId, month })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`${counterpartName} の ${month} を締めました`)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant={label === "締める" ? "default" : "outline"}>
          <Lock className="mr-1 h-4 w-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {counterpartName}　{fmtMonthPeriod(month, periodStart, periodEnd)}を締めます。
          </DialogTitle>
          <DialogDescription>
            {isClient
              ? "締めた後は、この期間の日付の納品書・請求書・入金の作成・編集・状態の変更・削除ができなくなります。直すには管理者が解除します。"
              : "締めた後は、この期間に発注した PO / WO の作成・編集・削除・取消ができなくなります（進捗の状態は変えられます）。直すには管理者が解除します。"}
          </DialogDescription>
        </DialogHeader>

        {warnings.length > 0 && (
          <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p>この期間に、まだ処理が済んでいない伝票があります。</p>
              <ul className="list-none space-y-0.5">
                {warnings.map((w) => (
                  <li key={w.kind}>
                    ・{w.label}　{w.count}
                    {w.numbers.length > 0 && (
                      <span className="font-mono text-xs">
                        （{w.numbers.join("、")}
                        {w.count > w.numbers.length ? " …" : ""}）
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            やめる
          </Button>
          <Button type="button" onClick={submit} disabled={isPending}>
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            このまま締める
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
