"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { changeSampleStatus } from "@/lib/actions/sample-productions"
import type { SampleProductionStatus } from "@prisma/client"
import { SAMPLE_STATUS_OPTIONS } from "./labels"

type Props = {
  id: string
  current: SampleProductionStatus
}

/** status を手動遷移する小コントロール（変更は changeSampleStatus → AuditLog 記録）。 */
export function SampleStatusControl({ id, current }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState<SampleProductionStatus>(current)

  const handleApply = () => {
    if (value === current) {
      toast.info("ステータスが変わっていません")
      return
    }
    startTransition(async () => {
      const result = await changeSampleStatus(id, { status: value })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("ステータスを変更しました")
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value}
        onValueChange={(v) => setValue(v as SampleProductionStatus)}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SAMPLE_STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        onClick={handleApply}
        disabled={isPending || value === current}
      >
        {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
        変更
      </Button>
    </div>
  )
}
