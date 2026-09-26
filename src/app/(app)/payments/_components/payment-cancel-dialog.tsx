"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Loader2 } from "lucide-react"
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
import {
  cancelClientPayment,
  getPaymentCancelImpact,
  type PaymentCancelImpact,
} from "@/lib/actions/payments"
import { fmtYen, fmtYmd } from "../../invoices/_components/labels"

/**
 * B-225（D-3・D-4）: 入金の取消ダイアログ。
 * - 開いたときに getPaymentCancelImpact で「御入金額に入っている請求書」を取り、あれば警告（止めない）
 * - 理由は必須。取消は cancelClientPayment（status → CANCELLED・AuditLog）
 * - 成功したら router.refresh()。入れ直しは「入金を記録」から（編集は作らない・D-1）
 */
export function PaymentCancelDialog({
  paymentId,
  paymentNumber,
  lockMessage = null,
}: {
  paymentId: string
  paymentNumber: string
  /** B-109 PR-6（P6-D7・§5-3）: 締めた期間の入金は「取消」を無効にし title に文 */
  lockMessage?: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [impact, setImpact] = useState<PaymentCancelImpact | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reason, setReason] = useState("")

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setImpact(null)
      setLoadError(null)
      setReason("")
      startTransition(async () => {
        const r = await getPaymentCancelImpact(paymentId)
        if (r.ok) setImpact(r.data)
        else setLoadError(r.error)
      })
    }
  }

  const submit = () => {
    if (!reason.trim()) {
      toast.error("取消の理由を入力してください")
      return
    }
    startTransition(async () => {
      const r = await cancelClientPayment({ id: paymentId, reason })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("取消しました。正しい内容は「入金を記録」から入れ直してください。")
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={!!lockMessage} title={lockMessage ?? undefined}>
          取消
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>入金を取消</DialogTitle>
          <DialogDescription>
            {paymentNumber} を取消します。金額や日付は書き換えられません。正しい内容は「入金を記録」から入れ直してください。
          </DialogDescription>
        </DialogHeader>

        {loadError && <p className="text-sm text-destructive">{loadError}</p>}

        {impact && (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">入金番号</dt>
              <dd className="font-mono">{impact.paymentNumber}</dd>
              <dt className="text-muted-foreground">クライアント</dt>
              <dd>{impact.counterpartName}</dd>
              <dt className="text-muted-foreground">入金日</dt>
              <dd className="tabular-nums">{fmtYmd(impact.paymentDate)}</dd>
              <dt className="text-muted-foreground">金額</dt>
              <dd className="tabular-nums">{fmtYen(impact.amount)}</dd>
            </dl>

            {impact.coveringInvoices.length > 0 && (
              <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  {impact.coveringInvoices.map((inv) => (
                    <p key={inv.id}>
                      この入金は {inv.invoiceNumber} の御入金額に入っています。取消しても {inv.invoiceNumber}{" "}
                      の金額は変わりません。直すには請求書を取消して再発行してください。
                    </p>
                  ))}
                </div>
              </div>
            )}

            {!impact.canCancel && (
              <p className="text-destructive">この入金は取消できません（状態: {impact.status}）</p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor={`cancel-reason-${paymentId}`}>取消の理由（必須）</Label>
              <Textarea
                id={`cancel-reason-${paymentId}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="例: 金額の打ち間違い（正しくは 5,000 円）"
                disabled={isPending || !impact.canCancel}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            やめる
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={submit}
            disabled={isPending || !impact || !impact.canCancel}
          >
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            取消する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
