"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { SalesOrderStatus } from "@prisma/client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateSalesOrderStatus } from "@/lib/actions/sales-orders"
import { SALES_ORDER_STATUS_OPTIONS } from "./labels"

export function SalesOrderStatusControl({
  id,
  status,
}: {
  id: string
  status: SalesOrderStatus
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleChange = (next: string) => {
    startTransition(async () => {
      const r = await updateSalesOrderStatus(id, next as SalesOrderStatus)
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
      <SelectTrigger className="h-8 w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SALES_ORDER_STATUS_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
