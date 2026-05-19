"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Archive, RotateCcw, Trash2, AlertTriangle, MoreHorizontal } from "lucide-react"
import { BrandStatus } from "@prisma/client"
import {
  archiveBrand,
  restoreBrand,
  deleteBrandPermanently,
  checkBrandUsage,
  type BrandUsage,
} from "@/lib/actions/brands"
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
  status: BrandStatus
  isMasterAdmin: boolean
  variant?: "icon" | "menu"
  onChanged?: () => void
}

type DialogMode = null | "archive" | "restore" | "delete"

export function BrandActions({
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
  const [usage, setUsage] = useState<BrandUsage | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)

  // 削除ダイアログを開いたタイミングで紐付きチェック
  useEffect(() => {
    if (mode === "delete") {
      setUsageLoading(true)
      setUsage(null)
      checkBrandUsage(id)
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
      const result = await archiveBrand(id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("ブランドをアーカイブしました")
      close()
      if (onChanged) onChanged()
      else router.refresh()
    })
  }

  const onRestore = () => {
    startTransition(async () => {
      const result = await restoreBrand(id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("ブランドを復元しました")
      close()
      if (onChanged) onChanged()
      else router.refresh()
    })
  }

  const onDelete = () => {
    startTransition(async () => {
      const result = await deleteBrandPermanently(id, confirmName)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("ブランドを本削除しました")
      close()
      if (onChanged) onChanged()
      else router.push("/brands")
      router.refresh()
    })
  }

  // ===========================================================================
  // トリガー（メニュー or アイコン）
  // ===========================================================================

  const trigger = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button variant="ghost" size="icon" aria-label="ブランド操作">
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
            <DialogTitle>ブランドをアーカイブしますか？</DialogTitle>
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
            <DialogTitle>ブランドを復元しますか？</DialogTitle>
            <DialogDescription>
              「{name}」を稼働中に戻します。
            </DialogDescription>
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
              ブランドを本削除しますか？
            </DialogTitle>
            <DialogDescription>
              「{name}」を物理的に削除します。
              <strong className="text-destructive font-bold"> この操作は取り消せません。</strong>
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
                このブランドは本削除できません
              </div>
              <div className="text-foreground">
                以下のデータが紐付いています：
              </div>
              <ul className="list-disc list-inside mt-1 text-foreground">
                {usage.modelCodeCount > 0 && (
                  <li>モデルコード: {usage.modelCodeCount} 件</li>
                )}
                {usage.productCount > 0 && (
                  <li>品番カルテ: {usage.productCount} 件</li>
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
              </div>
              <div className="space-y-2">
                <div className="text-sm">
                  確認のため、ブランド名「<strong>{name}</strong>」を入力してください：
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
