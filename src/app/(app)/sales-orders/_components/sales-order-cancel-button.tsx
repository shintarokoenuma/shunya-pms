"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Loader2, Ban } from "lucide-react"
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
import { cancelSalesOrder } from "@/lib/actions/sales-orders"

/**
 * 受注のキャンセル（status = CANCELLED）。物理削除も soft delete もしない（R-9/§4-1）。
 * キャンセルすると Sku.orderedQuantity の集計対象から外れ、受注数が差し引かれる（D-4）。
 */
export function SalesOrderCancelButton({
  id,
  soNumber,
}: {
  id: string
  soNumber: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleCancel = () => {
    startTransition(async () => {
      const r = await cancelSalesOrder(id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("受注をキャンセルしました")
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Ban className="mr-1 h-4 w-4" />
          キャンセル
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            受注をキャンセル
          </DialogTitle>
          <DialogDescription>
            {soNumber} をキャンセルします。受注数の集計から外れます（レコードは残ります）。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            戻る
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Ban className="mr-1 h-4 w-4" />
            )}
            キャンセルする
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
