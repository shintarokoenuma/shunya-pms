"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"
import type { PaymentMethod } from "@prisma/client"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClientPayment } from "@/lib/actions/payments"
import { PAYMENT_METHOD_OPTIONS } from "../../invoices/_components/labels"

/**
 * addendum v0.9 §2-4: クライアント詳細の「入金を記録」。項目は 入金日 / 金額 / 方法 / 摘要 の4つだけ。
 * 内部では予定日＝入金日、状態＝着金確認済みで保存する（実績の記録）。請求書への紐付けはしない（D-25）。
 */
export function PaymentRecordDialog({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("BANK_TRANSFER")
  const [description, setDescription] = useState("")

  const submit = () => {
    startTransition(async () => {
      const r = await createClientPayment({ clientId, paymentDate, amount, paymentMethod, description })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`入金 ${r.data.paymentNumber} を記録しました`)
      setOpen(false)
      setAmount("")
      setDescription("")
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1 h-4 w-4" />
          入金を記録
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>入金を記録</DialogTitle>
          <DialogDescription>
            入金はクライアントごとに記録します。次の合計請求書の「御入金額」と「繰越金額」に自動で入ります。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>入金日 *</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-[180px]" />
          </div>
          <div className="space-y-2">
            <Label>金額 *</Label>
            <Input
              type="number"
              step="1"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1918400"
              className="w-[180px]"
            />
          </div>
          <div className="space-y-2">
            <Label>方法</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>摘要</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="振込" maxLength={1000} />
          </div>
          <p className="text-xs text-muted-foreground">
            入れるのはこの4つだけです。内部では予定日＝入金日、状態＝着金確認済みで保存します（実績の記録なので予定と実績が同じ）。請求書への紐付けはしません。
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            やめる
          </Button>
          <Button onClick={submit} disabled={isPending || !amount || !paymentDate}>
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            記録する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
