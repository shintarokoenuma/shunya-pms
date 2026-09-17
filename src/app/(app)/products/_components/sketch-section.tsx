"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, ImagePlus, Trash2, ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  addProductSketch,
  deleteProductSketch,
  reorderProductSketches,
  updateProductSketchCaption,
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
        {/* B-202 PR-1r: 1画面の左カラム（216px）に収めるため形式説明は title に逃がし、枚数だけ出す */}
        <p
          className="truncate text-xs text-muted-foreground"
          title={`PNG / JPEG / WebP・1枚5MBまで・最大${MAX_COUNT}枚`}
        >
          {sketches.length}/{MAX_COUNT} 枚
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
        <div className="flex gap-3 overflow-x-auto pb-1">
          {/* B-202 PR-2: 帯で確定（addendum v0.5 D-21）。並び順・追加・削除・前後入替のロジックは無変更 */}
          {sketches.map((s, i) => (
            <div key={s.gcsPath} className="w-52 shrink-0 rounded-md border p-2">
              {/* B-202 PR-1r: 「クリックで拡大」（モック sketchbox の文言）。帯はサムネ（thumbUrl）・
                  拡大は原本（url）＝addendum v0.1 Q10。表示のみ・action なし・非制御 Dialog（開閉 state を持たない） */}
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    title="クリックで拡大"
                    className="block w-full rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.thumbUrl}
                      alt={s.caption ?? `絵型 ${i + 1}`}
                      className="h-60 w-full rounded object-contain"
                    />
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-[90vw] sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>{s.caption ?? `絵型 ${i + 1}`}</DialogTitle>
                    <DialogDescription className="sr-only">
                      絵型の原本を表示しています
                    </DialogDescription>
                  </DialogHeader>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.url}
                    alt={s.caption ?? `絵型 ${i + 1}`}
                    className="max-h-[80vh] w-full rounded object-contain"
                  />
                </DialogContent>
              </Dialog>
              {/* B-202 PR-2（addendum v0.5 D-22）: caption の表示とその場編集 */}
              <SketchCaptionEditor
                productId={productId}
                gcsPath={s.gcsPath}
                caption={s.caption}
                disabled={isPending}
              />
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

/**
 * B-202 PR-2（addendum v0.5 D-22）: サムネ直下の caption をその場で編集する。
 * - 表示: caption があればその文字（truncate）／無ければ薄い字の「説明を追加」
 * - 編集: クリックで Input（maxLength=50・autoFocus）。Enter か フォーカスが外れたら保存、Esc で取り消し。
 *   変更が無ければ action を呼ばない。保存中は無効化。失敗は toast.error、成功は router.refresh()（成功 toast は出さない）
 * - 非制御 Dialog と同じく、親（帯）の state には触らない
 */
function SketchCaptionEditor({
  productId,
  gcsPath,
  caption,
  disabled,
}: {
  productId: string
  gcsPath: string
  caption?: string
  disabled?: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(caption ?? "")
  const [isSaving, startSave] = useTransition()

  const startEdit = () => {
    setValue(caption ?? "")
    setEditing(true)
  }
  const cancel = () => {
    setEditing(false)
    setValue(caption ?? "")
  }
  const commit = () => {
    const next = value.trim()
    setEditing(false)
    if (next === (caption ?? "")) return // 変更なし: action を呼ばない
    startSave(async () => {
      const r = await updateProductSketchCaption(productId, gcsPath, next)
      if (!r.ok) {
        toast.error(r.error)
        setValue(caption ?? "")
        return
      }
      router.refresh()
    })
  }

  if (editing) {
    return (
      <Input
        autoFocus
        maxLength={50}
        value={value}
        disabled={isSaving}
        aria-label="絵型の説明"
        placeholder="説明（50文字まで）"
        className="mt-1 h-7 text-xs"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            e.currentTarget.blur() // onBlur → commit
          } else if (e.key === "Escape") {
            e.preventDefault()
            cancel()
          }
        }}
      />
    )
  }
  return (
    <button
      type="button"
      disabled={disabled || isSaving}
      onClick={startEdit}
      title={caption ? `${caption}（クリックで編集）` : "説明を追加"}
      className={cn(
        "mt-1 block w-full truncate rounded text-left text-xs hover:underline disabled:opacity-60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        caption ? "text-muted-foreground" : "italic text-muted-foreground/60",
      )}
    >
      {caption ?? "説明を追加"}
    </button>
  )
}
