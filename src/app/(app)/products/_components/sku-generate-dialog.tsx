"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Loader2, X } from "lucide-react"
import { createSkusForProduct, type SkuSizeInput } from "@/lib/actions/skus"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * SKU 生成ダイアログ（B-064 / SKU 生成 UI PR2）。
 * - サイズを複数選択 → ACTIVE カラーウェイ × サイズ の直積を createSkusForProduct で upsert（冪等）。
 * - 候補はカテゴリ defaultSizeOptions（カテゴリ順）＋ 既存 SKU の非定型サイズ（末尾に温存）。手入力でも追加可。
 * - 初期チェックは「この品番に既にあるサイズ（existingSizes）」のみ。SKU0件（初回・サンプル時）は全 OFF。
 * - shadcn に multi-select プリミティブが無いため、チェックボックス＋追加入力（チップ）で複数選択を実現。
 * - sizeOrder は最終選択順（表示順）に連番を振る。受注数は触らない（生成時 0）。
 */
export function SkuGenerateDialog({
  productId,
  defaultSizeOptions,
  existingSizes,
  categoryId,
  open,
  onClose,
  onGenerated,
}: {
  productId: string
  defaultSizeOptions: string[]
  existingSizes: string[]
  categoryId: string | null
  open: boolean
  onClose: () => void
  onGenerated: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  // 候補: カテゴリ順を先頭に維持し、カテゴリ候補に無い既存サイズ（過去分）を末尾に温存。
  // 手入力での追加は廃止（サイズの権威はカテゴリ defaultSizeOptions。足したい時はカテゴリ編集へ誘導）。
  const [options] = useState<string[]>(() =>
    dedupe([...defaultSizeOptions, ...existingSizes]),
  )
  // 初期チェックは既存サイズのみ（SKU0件なら空＝全 OFF）。
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(existingSizes),
  )

  function toggle(size: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(size)) next.delete(size)
      else next.add(size)
      return next
    })
  }

  function handleGenerate() {
    // options の並び（カテゴリ順→候補外既存）を尊重して、選択済みのみ sizeOrder を連番付与。
    const sizes: SkuSizeInput[] = options
      .filter((s) => selected.has(s))
      .map((size, i) => ({ size, sizeOrder: (i + 1) * 10 }))

    if (sizes.length === 0) {
      toast.error("サイズを 1 つ以上選択してください")
      return
    }

    startTransition(async () => {
      const r = await createSkusForProduct(productId, sizes)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`SKU を ${r.data.count} 件生成しました`)
      onGenerated()
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>SKU を生成</DialogTitle>
          <DialogDescription>
            選択したサイズ × ACTIVE カラーウェイの SKU を作成します（既存は維持）。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">サイズ</p>
              {categoryId && (
                <Link
                  href={`/product-categories/${categoryId}/edit`}
                  target="_blank"
                  className="text-xs text-muted-foreground underline"
                >
                  サイズ候補を編集（商品カテゴリ）
                </Link>
              )}
            </div>
            {options.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                サイズ候補がありません。
                {categoryId
                  ? "上の「サイズ候補を編集（商品カテゴリ）」からサイズを登録してください。"
                  : "この品番には商品カテゴリが未設定です。先にカテゴリを設定してください。"}
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {options.map((size) => (
                  <label
                    key={size}
                    className="flex cursor-pointer items-center gap-1.5 text-sm"
                  >
                    <Checkbox
                      checked={selected.has(size)}
                      onCheckedChange={() => toggle(size)}
                    />
                    {size}
                  </label>
                ))}
              </div>
            )}
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {options
                .filter((s) => selected.has(s))
                .map((size) => (
                  <Badge
                    key={size}
                    variant="secondary"
                    className="gap-1"
                  >
                    {size}
                    <button
                      type="button"
                      onClick={() => toggle(size)}
                      className="ml-0.5 rounded-sm hover:text-foreground"
                      aria-label={`${size} を外す`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={pending}
          >
            キャンセル
          </Button>
          <Button type="button" onClick={handleGenerate} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            生成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.map((s) => s.trim()).filter((s) => s.length > 0)))
}
