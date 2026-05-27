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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import {
  checkMaterialUsage,
  deleteMaterialPermanently,
  archiveMaterial,
  restoreMaterial,
  type MaterialUsage,
} from "@/lib/actions/materials"
import type { MaterialStatus } from "@prisma/client"

type Props = {
  id: string
  materialName: string
  status: MaterialStatus
  isMasterAdmin: boolean
}

export function MaterialActions({
  id,
  materialName,
  status,
  isMasterAdmin,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleArchive = () => {
    startTransition(async () => {
      const result = await archiveMaterial(id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("アーカイブしました")
      router.refresh()
    })
  }

  const handleRestore = () => {
    startTransition(async () => {
      const result = await restoreMaterial(id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("稼働中に戻しました")
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "ARCHIVED" && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleArchive}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          アーカイブ
        </Button>
      )}
      {status === "ARCHIVED" && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestore}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : null}
            復元
          </Button>
          {isMasterAdmin && (
            <PermanentDeleteDialog id={id} materialName={materialName} />
          )}
        </>
      )}
    </div>
  )
}

function PermanentDeleteDialog({
  id,
  materialName,
}: {
  id: string
  materialName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [usage, setUsage] = useState<MaterialUsage | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [confirmName, setConfirmName] = useState("")

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setConfirmName("")
      setUsageError(null)
      setUsage(null)
      setUsageLoading(true)
      checkMaterialUsage(id)
        .then((result) => {
          if (result.ok) {
            setUsage(result.data)
          } else {
            setUsageError(result.error)
          }
        })
        .finally(() => setUsageLoading(false))
    }
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteMaterialPermanently(id, confirmName)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("物理削除しました")
      setOpen(false)
      router.push("/materials")
      router.refresh()
    })
  }

  const canDelete =
    usage !== null &&
    usage.totalRefs === 0 &&
    confirmName.trim() === materialName

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-1 h-4 w-4" />
          物理削除
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            素材を物理削除
          </DialogTitle>
          <DialogDescription>
            この操作は元に戻せません。データが完全に削除されます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="text-xs text-muted-foreground">削除対象</div>
            <div className="font-medium">{materialName}</div>
          </div>

          {usageLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              参照件数を確認中...
            </div>
          )}
          {usageError && (
            <Alert variant="destructive">
              <AlertTitle>参照確認エラー</AlertTitle>
              <AlertDescription>{usageError}</AlertDescription>
            </Alert>
          )}
          {usage !== null && usage.totalRefs > 0 && (
            <Alert variant="destructive">
              <AlertTitle>削除できません</AlertTitle>
              <AlertDescription>
                {usage.totalRefs} 件の業務データから参照されています。
              </AlertDescription>
            </Alert>
          )}
          {usage !== null && usage.totalRefs === 0 && (
            <Alert>
              <AlertTitle>参照ゼロ件</AlertTitle>
              <AlertDescription>
                他のデータからの参照はありません。削除できます。
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="confirmName">
              確認のため素材名を入力してください
            </Label>
            <Input
              id="confirmName"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={materialName}
              disabled={isPending || usage === null || usage.totalRefs > 0}
            />
          </div>
        </div>

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
            onClick={handleDelete}
            disabled={isPending || !canDelete}
          >
            {isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-4 w-4" />
            )}
            物理削除する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
