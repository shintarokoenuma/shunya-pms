"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createDepositRequest } from "@/lib/actions/delivery-notes"

/**
 * B-109 PR-3（P3-D6）: 受注から「前受金を請求」。
 * 金額の初期値は 受注の税抜額 × 前受金%（円未満切り捨て・ADVANCE_PAYMENT は 100%）を呼び出し側（サーバ）で計算して渡す。
 * 保存すると、前受金の行 1 つを持つ納品書が納品完了（DELIVERED）で 1 枚できる。
 */
export function DepositRequestDialog({
  soId,
  soNumber,
  defaultAmount,
  depositLabel,
}: {
  soId: string
  soNumber: string
  defaultAmount: number
  /** 例: 「40%」「100%（前払い）」 */
  depositLabel: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [amount, setAmount] = useState(String(defaultAmount))
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10))

  const submit = () => {
    startTransition(async () => {
      const r = await createDepositRequest({ soId, amount, deliveryDate })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`前受金の伝票 ${r.data.deliveryNumber} を作りました（納品完了）。請求書の候補に出ます。`)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          前受金を請求
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>前受金を請求</DialogTitle>
          <DialogDescription>
            {soNumber} の前受金（{depositLabel}）を、納品完了の伝票として 1 枚作ります。次の合計請求書の候補に「前受金（{soNumber}）」として出ます。消費税は請求書で計算します。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="deposit-amount">金額（税抜・円）</Label>
            <Input
              id="deposit-amount"
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deposit-date">日付（伝票の納品日）</Label>
            <Input
              id="deposit-date"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              disabled={isPending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            やめる
          </Button>
          <Button type="button" onClick={submit} disabled={isPending}>
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            前受金を請求する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
