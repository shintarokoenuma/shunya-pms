"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
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
import { softDeleteDeliveryNote } from "@/lib/actions/delivery-notes"

/**
 * B-108 §9: 納品書の論理削除（deletedAt）。物理削除は作らない。
 * DRAFT のときのみ表示する（発行後は CANCELLED で一覧に残す）。呼び出し側で DRAFT 判定。
 */
export function DeliveryNoteDeleteButton({
  id,
  deliveryNumber,
}: {
  id: string
  deliveryNumber: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    startTransition(async () => {
      const r = await softDeleteDeliveryNote(id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("納品書を削除しました")
      setOpen(false)
      router.push("/deliveries")
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 className="mr-1 h-4 w-4" />
          削除
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            納品書を削除
          </DialogTitle>
          <DialogDescription>
            {deliveryNumber} を削除します（論理削除・ドラフトのみ。一覧から非表示になります）。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            キャンセル
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-4 w-4" />
            )}
            削除する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
