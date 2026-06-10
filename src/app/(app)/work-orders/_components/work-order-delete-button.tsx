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
import { deleteWorkOrder } from "@/lib/actions/work-orders"

/** WO の soft-delete（deletedAt セット）。 */
export function WorkOrderDeleteButton({
  id,
  woNumber,
}: {
  id: string
  woNumber: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    startTransition(async () => {
      const r = await deleteWorkOrder(id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("作業発注を削除しました")
      setOpen(false)
      router.push("/work-orders")
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            作業発注を削除
          </DialogTitle>
          <DialogDescription>
            {woNumber} を削除します（論理削除。一覧から非表示になります）。
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
