"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cancelSupplierInvoice } from "@/lib/actions/supplier-invoices"

/** B-212 PR-1（P1-D8）: 書類の取消（論理削除・理由必須）。金額・日付は直せない（取消して取り込み直す・B-225 と同じ考え方） */
export function SupplierInvoiceCancelDialog({ id, invoiceNumber }: { id: string; invoiceNumber: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [isPending, startTransition] = useTransition()
  const submit = () => {
    if (!reason.trim()) { toast.error("取消の理由を入力してください"); return }
    startTransition(async () => {
      const r = await cancelSupplierInvoice({ id, reason })
      if (!r.ok) { toast.error(r.error); return }
      toast.success("取消しました。正しい内容は CSV を取り込み直してください。")
      setOpen(false)
      router.push("/supplier-invoices")
      router.refresh()
    })
  }
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setReason("") }}>
      <DialogTrigger asChild><Button type="button" variant="outline" size="sm">取消</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>仕入請求書を取消</DialogTitle>
          <DialogDescription>{invoiceNumber} を取消します（一覧から消えます）。読み取った金額や日付は書き換えられません。直すときは CSV を取り込み直してください。</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={`siv-cancel-${id}`}>取消の理由（必須）</Label>
          <Textarea id={`siv-cancel-${id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} rows={2} placeholder="例: 金額の読み取り違い（取り込み直す）" disabled={isPending} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>やめる</Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={isPending}>{isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}取消する</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
