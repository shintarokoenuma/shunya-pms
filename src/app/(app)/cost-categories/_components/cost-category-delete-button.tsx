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
  checkCostCategoryUsage,
  deleteCostCategoryPermanently,
  archiveCostCategory,
  restoreCostCategory,
  type CostCategoryUsage,
} from "@/lib/actions/cost-categories"
import type { CostCategoryStatus } from "@prisma/client"

type Props = {
  id: string
  categoryName: string
  status: CostCategoryStatus
  isSystemReserved: boolean
  isMasterAdmin: boolean
}

/**
 * 原価費目の archive / restore / 物理削除を集約したボタン群。
 * - 通常権限: アーカイブ / 復元のみ
 * - MASTER_ADMIN: 物理削除（4 重ガード）も表示
 * - isSystemReserved=true の行は archive / 物理削除いずれも表示しない
 */
export function CostCategoryDeleteButton({
  id,
  categoryName,
  status,
  isSystemReserved,
  isMasterAdmin,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (isSystemReserved) {
    return (
      <div className="text-xs text-muted-foreground">
        システム予約行（操作不可）
      </div>
    )
  }

  const handleArchive = () => {
    startTransition(async () => {
      const result = await archiveCostCategory(id)
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
      const result = await restoreCostCategory(id)
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
      {status === "ACTIVE" && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleArchive}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : null}
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
            <PermanentDeleteDialog id={id} categoryName={categoryName} />
          )}
        </>
      )}
    </div>
  )
}

// =============================================================================
// 物理削除ダイアログ (MASTER_ADMIN 専用)
// =============================================================================
function PermanentDeleteDialog({
  id,
  categoryName,
}: {
  id: string
  categoryName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [usage, setUsage] = useState<CostCategoryUsage | null>(null)
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
      checkCostCategoryUsage(id)
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
      const result = await deleteCostCategoryPermanently(id, confirmName)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("物理削除しました")
      setOpen(false)
      router.push("/cost-categories")
      router.refresh()
    })
  }

  const canDelete =
    usage !== null &&
    usage.totalRefs === 0 &&
    confirmName.trim() === categoryName

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
            原価費目を物理削除
          </DialogTitle>
          <DialogDescription>
            この操作は元に戻せません。データが完全に削除されます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="text-xs text-muted-foreground">削除対象</div>
            <div className="font-medium">{categoryName}</div>
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
                子カテゴリ {usage.childrenCount} 件 / 見積もり原価明細{" "}
                {usage.quotationCostBreakdownCount} 件 から参照されています。
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
              確認のためカテゴリ名を入力してください
            </Label>
            <Input
              id="confirmName"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={categoryName}
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
