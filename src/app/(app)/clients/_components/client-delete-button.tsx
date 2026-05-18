"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
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

import { softDeleteClient } from "@/lib/actions/clients"

type Props = {
  id: string
  name: string
}

export function ClientDeleteButton({ id, name }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await softDeleteClient(id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`「${name}」をアーカイブしました`)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-4" />
          <span className="sr-only">削除</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>クライアントをアーカイブ</DialogTitle>
          <DialogDescription>
            「{name}」をアーカイブします。データは論理削除され、一覧から非表示になります。
            完全削除ではないため、必要に応じて復元できます（管理画面から）。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "処理中..." : "アーカイブする"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
