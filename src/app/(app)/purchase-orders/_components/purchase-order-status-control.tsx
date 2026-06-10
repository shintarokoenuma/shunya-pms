"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { PurchaseOrderStatus } from "@prisma/client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updatePurchaseOrderStatus } from "@/lib/actions/purchase-orders"
import { PURCHASE_ORDER_STATUS_OPTIONS } from "./labels"

export function PurchaseOrderStatusControl({
  id,
  status,
}: {
  id: string
  status: PurchaseOrderStatus
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleChange = (next: string) => {
    startTransition(async () => {
      const r = await updatePurchaseOrderStatus(id, next as PurchaseOrderStatus)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("ステータスを更新しました")
      router.refresh()
    })
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="h-8 w-[170px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PURCHASE_ORDER_STATUS_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
