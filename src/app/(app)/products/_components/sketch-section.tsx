"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, ImagePlus, Trash2, ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  addProductSketch,
  deleteProductSketch,
  reorderProductSketches,
} from "@/lib/actions/product-sketches"
import type { ProductSketchView } from "@/lib/types/product-sketch"

const MAX_COUNT = 20

export function SketchSection({
  productId,
  sketches,
}: {
  productId: string
  sketches: ProductSketchView[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [isDragging, setIsDragging] = useState(false)
  const atMax = sketches.length >= MAX_COUNT

  // 複数枚を直列（for...of await）で追加する。並列にしない＝サーバの「最新読み直し→追記」が
  //   last-write-wins のため、並列だと取りこぼす。サーバ(addProductSketch)は無改修。
  const handleFiles = (files: File[]) => {
    if (files.length === 0) return
    // client 側 UX ガード: 残り枚数を超える分は弾く（サーバが最終防衛線だが往復を減らす）
    const remaining = MAX_COUNT - sketches.length
    if (remaining <= 0) {
      toast.error(`絵型は${MAX_COUNT}枚までです`)
      return
    }
    const targets = files.slice(0, remaining)
    const skippedByLimit = files.length - targets.length
    startTransition(async () => {
      let ok = 0
      const failed: string[] = []
      for (const file of targets) {
        const fd = new FormData()
        fd.set("file", file)
        const r = await addProductSketch(productId, fd)
        if (r.ok) ok++
        else failed.push(`${file.name}: ${r.error}`)
      }
      if (ok > 0) toast.success(`絵型を${ok}枚追加しました`)
      if (failed.length > 0)
        toast.error(
          `${failed.length}枚を追加できませんでした\n${failed
            .slice(0, 3)
            .join("\n")}${failed.length > 3 ? "\n…" : ""}`,
        )
      if (skippedByLimit > 0)
        toast.error(`上限(${MAX_COUNT}枚)を超える${skippedByLimit}枚はスキップしました`)
      router.refresh()
    })
  }

  const handleDelete = (gcsPath: string) => {
    startTransition(async () => {
      const r = await deleteProductSketch(productId, gcsPath)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("絵型を削除しました")
      router.refresh()
    })
  }

  const handleMove = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= sketches.length) return
    const order = sketches.map((s) => s.gcsPath)
    ;[order[index], order[target]] = [order[target], order[index]]
    startTransition(async () => {
      const r = await reorderProductSketches(productId, order)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(Array.from(e.target.files ?? []))
          e.target.value = ""
        }}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          PNG / JPEG / WebP・1枚5MBまで・最大{MAX_COUNT}枚（{sketches.length}/{MAX_COUNT}）
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending || atMax}
          title={atMax ? `絵型は${MAX_COUNT}枚までです` : undefined}
          onClick={() => inputRef.current?.click()}
        >
          {isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="mr-1 h-4 w-4" />
          )}
          絵型を追加
        </Button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!atMax) setIsDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setIsDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFiles(Array.from(e.dataTransfer.files))
        }}
        className={
          isDragging ? "rounded-md ring-2 ring-primary ring-offset-2" : undefined
        }
      >
      {sketches.length === 0 ? (
        <div
          className={`rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground ${
            isDragging ? "border-primary bg-muted/40" : ""
          }`}
        >
          画像をここにドラッグ&ドロップ、または「絵型を追加」からアップロードしてください。
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {sketches.map((s, i) => (
            <div key={s.gcsPath} className="rounded-md border p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.url}
                alt={s.caption ?? `絵型 ${i + 1}`}
                className="h-40 w-full rounded object-contain"
              />
              {s.caption && (
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {s.caption}
                </div>
              )}
              <div className="mt-1 flex items-center justify-between">
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={isPending || i === 0}
                    title="前へ"
                    onClick={() => handleMove(i, -1)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={isPending || i === sketches.length - 1}
                    title="後へ"
                    onClick={() => handleMove(i, 1)}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={isPending}
                  title="削除"
                  onClick={() => handleDelete(s.gcsPath)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
