"use client"

import { useEffect, useState, useTransition } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import {
  checkBuyerUsage,
  deleteBuyerPermanently,
  archiveBuyer,
  restoreBuyer,
  type BuyerUsage,
} from "@/lib/actions/buyers"
import {
  listActiveDestinationsByBuyer,
  type ActiveDestinationsByBuyer,
} from "@/lib/actions/delivery-destinations"
import type { BuyerStatus } from "@prisma/client"

type Props = {
  id: string
  buyerName: string
  status: BuyerStatus
  isMasterAdmin: boolean
}

/**
 * バイヤーの archive / restore / 物理削除を集約したボタン群。
 * - 通常権限: アーカイブ / 復元のみ
 * - MASTER_ADMIN: 物理削除（4 重ガード）も表示
 * - Phase 1A-10 で archive はパターン γ（配下 DD 連鎖の警告 + ユーザー選択）
 */
export function BuyerActions({
  id,
  buyerName,
  status,
  isMasterAdmin,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleRestore = () => {
    startTransition(async () => {
      const result = await restoreBuyer(id)
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
      {status === "ACTIVE" && <ArchiveBuyerDialog id={id} buyerName={buyerName} />}
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
            <PermanentDeleteDialog id={id} buyerName={buyerName} />
          )}
        </>
      )}
    </div>
  )
}

// =============================================================================
// Archive ダイアログ（Phase 1A-10：パターン γ）
//
// 配下に ACTIVE な DeliveryDestination があれば連鎖アーカイブのチェックボックス
// （デフォルト ON）を表示。0 件の場合は単純な確認ダイアログ。
// =============================================================================
function ArchiveBuyerDialog({
  id,
  buyerName,
}: {
  id: string
  buyerName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [cascade, setCascade] = useState(true)
  const [destinations, setDestinations] =
    useState<ActiveDestinationsByBuyer | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCascade(true)
    setDestinations(null)
    setLoadError(null)
    setLoading(true)
    listActiveDestinationsByBuyer(id)
      .then((result) => {
        if (result.ok) {
          setDestinations(result.data)
        } else {
          setLoadError(result.error)
        }
      })
      .finally(() => setLoading(false))
  }, [open, id])

  const handleArchive = () => {
    startTransition(async () => {
      const result = await archiveBuyer(id, {
        cascadeArchiveDestinations:
          (destinations?.count ?? 0) > 0 ? cascade : false,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      if (result.data.cascadedCount > 0) {
        toast.success(
          `アーカイブしました（配下の納品先 ${result.data.cascadedCount} 件も連鎖アーカイブ）`,
        )
      } else {
        toast.success("アーカイブしました")
      }
      setOpen(false)
      router.refresh()
    })
  }

  const ddCount = destinations?.count ?? 0
  const hasDestinations = ddCount > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          アーカイブ
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>バイヤーをアーカイブ</DialogTitle>
          <DialogDescription>
            アーカイブ後は一覧の絞り込み「アーカイブ」から再表示・復元できます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="text-xs text-muted-foreground">対象</div>
            <div className="font-medium">{buyerName}</div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              配下の納品先を確認中...
            </div>
          )}
          {loadError && (
            <Alert variant="destructive">
              <AlertTitle>確認エラー</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {!loading && !loadError && hasDestinations && (
            <Alert>
              <AlertTitle>
                配下に稼働中の納品先が {ddCount} 件あります
              </AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1 text-xs">
                  {destinations!.preview.map((d) => (
                    <li key={d.id}>
                      <span className="font-mono text-muted-foreground mr-2">
                        {d.destinationCode}
                      </span>
                      {d.destinationName}
                    </li>
                  ))}
                  {ddCount > destinations!.preview.length && (
                    <li className="text-muted-foreground">
                      他 {ddCount - destinations!.preview.length} 件
                    </li>
                  )}
                </ul>
                <div className="mt-3 flex items-center gap-2">
                  <Checkbox
                    id="cascade-archive"
                    checked={cascade}
                    onCheckedChange={(v) => setCascade(v === true)}
                  />
                  <Label
                    htmlFor="cascade-archive"
                    className="text-sm font-normal"
                  >
                    配下の納品先も同時にアーカイブする
                  </Label>
                </div>
              </AlertDescription>
            </Alert>
          )}
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
            onClick={handleArchive}
            disabled={isPending || loading || !!loadError}
          >
            {isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : null}
            アーカイブ実行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// 物理削除ダイアログ（MASTER_ADMIN 専用、4 重ガード UI）
// =============================================================================
function PermanentDeleteDialog({
  id,
  buyerName,
}: {
  id: string
  buyerName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [usage, setUsage] = useState<BuyerUsage | null>(null)
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
      checkBuyerUsage(id)
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
      const result = await deleteBuyerPermanently(id, confirmName)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("物理削除しました")
      setOpen(false)
      router.push("/buyers")
      router.refresh()
    })
  }

  const canDelete =
    usage !== null &&
    usage.totalRefs === 0 &&
    confirmName.trim() === buyerName

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
            バイヤーを物理削除
          </DialogTitle>
          <DialogDescription>
            この操作は元に戻せません。データが完全に削除されます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 対象 */}
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="text-xs text-muted-foreground">削除対象</div>
            <div className="font-medium">{buyerName}</div>
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
                納品先から {usage.deliveryDestinationCount} 件参照されています。
                先に納品先を削除してください。
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
              確認のためバイヤー名を入力してください
            </Label>
            <Input
              id="confirmName"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={buyerName}
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
