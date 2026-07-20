"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Star } from "lucide-react"
import { SampleProductionStatus } from "@prisma/client"
import { setProductionEstimateBase } from "@/lib/actions/sample-productions"
import { Button } from "@/components/ui/button"

type Props = {
  id: string
  status: SampleProductionStatus
}

/** 量産見積の基準サンプル指定（§1-3・APPROVED を既定候補として視覚的に推す）。 */
export function SetEstimateBaseButton({ id, status }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const recommended = status === SampleProductionStatus.APPROVED

  return (
    <Button
      size="sm"
      variant="outline"
      className={
        recommended ? "border-emerald-400 text-emerald-700" : undefined
      }
      onClick={() =>
        startTransition(async () => {
          const r = await setProductionEstimateBase(id)
          if (!r.ok) {
            toast.error(r.error)
            return
          }
          toast.success("量産見積の基準サンプルに指定しました")
          router.refresh()
        })
      }
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Star className="mr-1 h-3.5 w-3.5" />
      )}
      基準にする{recommended && "（推奨）"}
    </Button>
  )
}
