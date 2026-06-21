"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, X } from "lucide-react"
import { createSkusForProduct, type SkuSizeInput } from "@/lib/actions/skus"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
 * - サイズ候補はカテゴリ defaultSizeOptions を初期表示。無ければ／不足分は手入力で追加。
 * - shadcn に multi-select プリミティブが無いため、チェックボックス＋追加入力（チップ）で複数選択を実現。
 * - sizeOrder は最終選択順（表示順）に連番を振る。受注数は触らない（生成時 0）。
 */
export function SkuGenerateDialog({
  productId,
  defaultSizeOptions,
  open,
  onClose,
  onGenerated,
}: {
  productId: string
  defaultSizeOptions: string[]
  open: boolean
  onClose: () => void
  onGenerated: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  // 候補（カテゴリ既定 ＋ 手入力で追加した分）。選択状態は selected で管理。
  const [options, setOptions] = useState<string[]>(() =>
    dedupe(defaultSizeOptions),
  )
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultSizeOptions),
  )
  const [customInput, setCustomInput] = useState("")

  function toggle(size: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(size)) next.delete(size)
      else next.add(size)
      return next
    })
  }

  function addCustom() {
    // カンマ／空白区切りで複数まとめて追加可。
    const tokens = customInput
      .split(/[,\s、，]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
    if (tokens.length === 0) return
    setOptions((prev) => dedupe([...prev, ...tokens]))
    setSelected((prev) => {
      const next = new Set(prev)
      tokens.forEach((t) => next.add(t))
      return next
    })
    setCustomInput("")
  }

  function handleGenerate() {
    // options の並び（既定→追加順）を尊重して、選択済みのみ sizeOrder を連番付与。
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
            <p className="text-sm font-medium">サイズ</p>
            {options.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                候補がありません。下の入力からサイズを追加してください。
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

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              候補にないサイズを追加（カンマ・空白区切りで複数可）
            </p>
            <div className="flex gap-2">
              <Input
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addCustom()
                  }
                }}
                placeholder="例: 3L, F"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addCustom}
                aria-label="サイズを追加"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
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
