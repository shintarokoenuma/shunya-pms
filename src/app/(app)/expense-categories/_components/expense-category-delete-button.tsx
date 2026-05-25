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
  checkExpenseCategoryUsage,
  deleteExpenseCategoryPermanently,
  archiveExpenseCategory,
  restoreExpenseCategory,
  type ExpenseCategoryUsage,
} from "@/lib/actions/expense-categories"
import type { ExpenseCategoryStatus } from "@prisma/client"

type Props = {
  id: string
  expenseName: string
  status: ExpenseCategoryStatus
  isMasterAdmin: boolean
}

/**
 * 諸経費カテゴリの archive / restore / 物理削除を集約したボタン群。
 * - 通常権限: アーカイブ / 復元のみ
 * - MASTER_ADMIN: 物理削除（4 重ガード）も表示
 */
export function ExpenseCategoryDeleteButton({
  id,
  expenseName,
  status,
  isMasterAdmin,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // アーカイブ
  const handleArchive = () => {
    startTransition(async () => {
      const result = await archiveExpenseCategory(id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("アーカイブしました")
      router.refresh()
    })
  }

  // 復元
  const handleRestore = () => {
    startTransition(async () => {
      const result = await restoreExpenseCategory(id)
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
            <PermanentDeleteDialog id={id} expenseName={expenseName} />
          )}
        </>
      )}
    </div>
  )
}

// =============================================================================
// 物理削除ダイアログ（MASTER_ADMIN 専用）
// =============================================================================
function PermanentDeleteDialog({
  id,
  expenseName,
}: {
  id: string
  expenseName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [usage, setUsage] = useState<ExpenseCategoryUsage | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [confirmName, setConfirmName] = useState("")

  // ダイアログを開いたら参照件数を取得
  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setConfirmName("")
      setUsageError(null)
      setUsage(null)
      setUsageLoading(true)
      checkExpenseCategoryUsage(id)
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
      const result = await deleteExpenseCategoryPermanently(id, confirmName)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("物理削除しました")
      setOpen(false)
      router.push("/expense-categories")
      router.refresh()
    })
  }

  const canDelete =
    usage !== null &&
    usage.totalRefs === 0 &&
    confirmName.trim() === expenseName

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
            諸経費カテゴリを物理削除
          </DialogTitle>
          <DialogDescription>
            この操作は元に戻せません。データが完全に削除されます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 対象 */}
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="text-xs text-muted-foreground">削除対象</div>
            <div className="font-medium">{expenseName}</div>
          </div>

          {/* 参照件数 */}
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
                見積もり原価明細から {usage.quotationCostBreakdownCount}{" "}
                件参照されています。
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

          {/* 確認入力 */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmName">
              確認のためカテゴリ名を入力してください
            </Label>
            <Input
              id="confirmName"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={expenseName}
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
