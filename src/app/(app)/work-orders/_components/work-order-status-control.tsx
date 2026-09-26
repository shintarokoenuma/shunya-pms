"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { WorkOrderStatus } from "@prisma/client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateWorkOrderStatus } from "@/lib/actions/work-orders"
import { WORK_ORDER_STATUS_OPTIONS } from "./labels"

/** B-109 PR-6（P6-D8・§5-3）: lockMessage があれば CANCELLED だけ選べなくする（進捗の状態は変えられる） */
export function WorkOrderStatusControl({
  id,
  status,
  lockMessage = null,
}: {
  id: string
  status: WorkOrderStatus
  lockMessage?: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleChange = (next: string) => {
    startTransition(async () => {
      const r = await updateWorkOrderStatus(id, next as WorkOrderStatus)
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
        {WORK_ORDER_STATUS_OPTIONS.map((o) => (
          <SelectItem
            key={o.value}
            value={o.value}
            disabled={!!lockMessage && o.value === "CANCELLED"}
            title={lockMessage && o.value === "CANCELLED" ? lockMessage : undefined}
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
