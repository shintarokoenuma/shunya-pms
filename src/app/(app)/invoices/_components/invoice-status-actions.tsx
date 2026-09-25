"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Loader2, RotateCcw, Send, XCircle } from "lucide-react"
import type { InvoiceStatus } from "@prisma/client"
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
import { updateInvoiceStatus } from "@/lib/actions/invoices"

/**
 * addendum v0.9 §2-3: ボタンは `取消` / `再発行`。PDF は詳細ページ側の OrderPdfPreviewButton（B-109 PR-4）。
 * - DRAFT: 送付済みにする / 取消
 * - SENT: 取消（送付済みにしたら書き換えません。誤りは取消 → 再発行）
 * - CANCELLED: 再発行（取消した請求書の明細は候補に戻っているので、新規作成をその内容で開く）
 */
export function InvoiceStatusActions({
  id,
  invoiceNumber,
  status,
  replacedByInvoiceId,
}: {
  id: string
  invoiceNumber: string
  status: InvoiceStatus
  replacedByInvoiceId: string | null
}) {
  const router = useRouter()
  const [openSend, setOpenSend] = useState(false)
  const [openCancel, setOpenCancel] = useState(false)
  const [isPending, startTransition] = useTransition()

  const change = (next: InvoiceStatus, doneMessage: string) => {
    startTransition(async () => {
      const r = await updateInvoiceStatus(id, next)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(doneMessage)
      setOpenSend(false)
      setOpenCancel(false)
      router.refresh()
    })
  }

  if (status === "CANCELLED") {
    return replacedByInvoiceId ? (
      <Button asChild variant="outline" size="sm">
        <Link href={`/invoices/${replacedByInvoiceId}`}>再発行先を見る</Link>
      </Button>
    ) : (
      <Button asChild size="sm">
        <Link href={`/invoices/new?replaces=${id}`}>
          <RotateCcw className="mr-1 h-4 w-4" />
          再発行
        </Link>
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {status === "DRAFT" && (
        <Dialog open={openSend} onOpenChange={setOpenSend}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Send className="mr-1 h-4 w-4" />
              送付済みにする
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{invoiceNumber} を送付済みにする</DialogTitle>
              <DialogDescription>
                送付済みにしたら書き換えません。誤りは取消 → 新しい番号で再発行します。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenSend(false)} disabled={isPending}>
                やめる
              </Button>
              <Button onClick={() => change("SENT", "送付済みにしました")} disabled={isPending}>
                {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                送付済みにする
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <Dialog open={openCancel} onOpenChange={setOpenCancel}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <XCircle className="mr-1 h-4 w-4" />
            取消
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {invoiceNumber} を取消
            </DialogTitle>
            <DialogDescription>
              取消すと、この請求書に載っていた明細は次の請求書の候補に戻ります。取消した請求書は一覧に「取消」として残ります。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCancel(false)} disabled={isPending}>
              やめる
            </Button>
            <Button
              variant="destructive"
              onClick={() => change("CANCELLED", "取消しました")}
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              取消する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
