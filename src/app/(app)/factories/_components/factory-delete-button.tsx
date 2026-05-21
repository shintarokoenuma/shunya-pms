"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Archive,
  RotateCcw,
  Trash2,
  AlertTriangle,
  MoreHorizontal,
} from "lucide-react"
import { FactoryStatus } from "@prisma/client"
import {
  archiveFactory,
  restoreFactory,
  deleteFactoryPermanently,
  checkFactoryUsage,
  type FactoryUsage,
} from "@/lib/actions/factories"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Props = {
  id: string
  name: string
  status: FactoryStatus
  isMasterAdmin: boolean
  variant?: "icon" | "menu"
  onChanged?: () => void
}

type DialogMode = null | "archive" | "restore" | "delete"

export function FactoryActions({
  id,
  name,
  status,
  isMasterAdmin,
  variant = "menu",
  onChanged,
}: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<DialogMode>(null)
  const [isPending, startTransition] = useTransition()
  const [confirmName, setConfirmName] = useState("")
  const [usage, setUsage] = useState<FactoryUsage | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)

  useEffect(() => {
    if (mode === "delete") {
      setUsageLoading(true)
      setUsage(null)
      checkFactoryUsage(id)
        .then(setUsage)
        .finally(() => setUsageLoading(false))
    } else {
      setConfirmName("")
      setUsage(null)
    }
  }, [mode, id])

  const close = () => setMode(null)

  const onArchive = () => {
    startTransition(async () => {
      const result = await archiveFactory(id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("工場をアーカイブしました")
      close()
      if (onChanged) onChanged()
      else router.refresh()
    })
  }

  const onRestore = () => {
    startTransition(async () => {
      const result = await restoreFactory(id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("工場を復元しました")
      close()
      if (onChanged) onChanged()
      else router.refresh()
    })
  }

  const onDelete = () => {
    startTransition(async () => {
      const result = await deleteFactoryPermanently(id, confirmName)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("工場を本削除しました")
      close()
      if (onChanged) onChanged()
      else router.push("/factories")
      router.refresh()
    })
  }

  const trigger = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button variant="ghost" size="icon" aria-label="工場操作">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            操作
            <MoreHorizontal className="ml-1 h-4 w-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {status !== "ARCHIVED" && (
          <DropdownMenuItem onClick={() => setMode("archive")}>
            <Archive className="mr-2 h-4 w-4" />
            アーカイブ
          </DropdownMenuItem>
        )}
        {status === "ARCHIVED" && (
          <DropdownMenuItem onClick={() => setMode("restore")}>
            <RotateCcw className="mr-2 h-4 w-4" />
            復元
          </DropdownMenuItem>
        )}
        {status === "ARCHIVED" && isMasterAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setMode("delete")}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              本削除
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <>
      {trigger}

      {/* アーカイブ確認 */}
      <Dialog open={mode === "archive"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>工場をアーカイブしますか？</DialogTitle>
            <DialogDescription>
              「{name}」をアーカイブします。一覧から「稼働中」では非表示になりますが、
              「アーカイブ」絞り込みで再表示・復元が可能です。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={isPending}>
              キャンセル
            </Button>
            <Button variant="default" onClick={onArchive} disabled={isPending}>
              {isPending ? "処理中..." : "アーカイブ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 復元確認 */}
      <Dialog open={mode === "restore"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>工場を復元しますか？</DialogTitle>
            <DialogDescription>「{name}」を稼働中に戻します。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={isPending}>
              キャンセル
            </Button>
            <Button variant="default" onClick={onRestore} disabled={isPending}>
              {isPending ? "処理中..." : "復元"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 本削除確認 */}
      <Dialog open={mode === "delete"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              工場を本削除しますか？
            </DialogTitle>
            <DialogDescription>
              「{name}」を物理的に削除します。
              <strong className="text-destructive font-bold">
                {" "}
                この操作は取り消せません。
              </strong>
            </DialogDescription>
          </DialogHeader>

          {usageLoading && (
            <div className="text-sm text-muted-foreground">
              紐付くデータを確認中...
            </div>
          )}

          {usage && usage.totalRefs > 0 && (
            <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm">
              <div className="font-medium text-destructive mb-1">
                この工場は本削除できません
              </div>
              <div className="text-foreground">
                以下のデータが紐付いています：
              </div>
              <ul className="list-disc list-inside mt-1 text-foreground">
                {usage.workOrderCount > 0 && (
                  <li>製造指示: {usage.workOrderCount} 件</li>
                )}
                {usage.productCount > 0 && (
                  <li>製品: {usage.productCount} 件</li>
                )}
              </ul>
              <div className="mt-2 text-muted-foreground text-xs">
                関連データを先にアーカイブ・削除してからもう一度お試しください。
              </div>
            </div>
          )}

          {usage && usage.totalRefs === 0 && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted p-3 text-sm">
                <div>紐付くデータはありません。削除可能です。</div>
                {usage.contactCount > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    （担当者 {usage.contactCount} 件は同時に削除されます）
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="text-sm">
                  確認のため、工場名「<strong>{name}</strong>」を入力してください：
                </div>
                <Input
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={name}
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={isPending}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={
                isPending ||
                usageLoading ||
                !usage ||
                usage.totalRefs > 0 ||
                confirmName.trim() !== name
              }
            >
              {isPending ? "処理中..." : "本削除する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
