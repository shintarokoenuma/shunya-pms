"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { DeliveryNoteStatus } from "@prisma/client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateDeliveryNoteStatus } from "@/lib/actions/delivery-notes"
import { DELIVERY_NOTE_STATUS_OPTIONS } from "./labels"

/**
 * §8: 選択肢は DRAFT / SHIPPED / DELIVERED / CANCELLED の4値のみ。
 * B-109 PR-6（§5-3）: lockMessage があれば無効にし、title に文を出す（サーバ側の判定が正・画面は案内）。
 */
export function DeliveryNoteStatusControl({
  id,
  status,
  lockMessage = null,
}: {
  id: string
  status: DeliveryNoteStatus
  lockMessage?: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleChange = (next: string) => {
    startTransition(async () => {
      const r = await updateDeliveryNoteStatus(id, next as DeliveryNoteStatus)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("ステータスを更新しました")
      router.refresh()
    })
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={isPending || !!lockMessage}>
      <SelectTrigger className="h-8 w-[150px]" title={lockMessage ?? undefined}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DELIVERY_NOTE_STATUS_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
