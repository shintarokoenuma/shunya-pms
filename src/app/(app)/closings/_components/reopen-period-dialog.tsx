"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Unlock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { reopenPeriod } from "@/lib/actions/period-closes"
import { fmtMonthPeriod } from "./labels"

/**
 * B-109 PR-6（§5-2・P6-D9）: 「解除する」のダイアログ。OWNER / ADMIN にだけ出す（呼び出し側で判定）。
 * 理由は必須（空白だけも不可）。サーバ側でも role と理由を判定する。
 */
export function ReopenPeriodDialog({
  closeId,
  counterpartName,
  month,
  periodStart,
  periodEnd,
}: {
  closeId: string
  counterpartName: string
  month: string
  periodStart: string
  periodEnd: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [isPending, startTransition] = useTransition()

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) setReason("")
  }

  const submit = () => {
    if (!reason.trim()) {
      toast.error("解除の理由を入力してください")
      return
    }
    startTransition(async () => {
      const r = await reopenPeriod({ id: closeId, reason })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`${counterpartName} の ${month} の締めを解除しました`)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Unlock className="mr-1 h-4 w-4" />
          解除する
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {counterpartName}　{fmtMonthPeriod(month, periodStart, periodEnd)}の締めを解除します。
          </DialogTitle>
          <DialogDescription>
            解除した人・日時・理由を残します。解除している間の変更は、この記録と並べて見られます。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={`reopen-reason-${closeId}`}>解除の理由（必須）</Label>
          <Textarea
            id={`reopen-reason-${closeId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="例: 納品書の数量を直すため"
            disabled={isPending}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            やめる
          </Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={isPending || !reason.trim()}>
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            解除する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
