"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import {
  addMaterialEvidenceFile,
  getMaterialEvidenceFileUrl,
  removeMaterialEvidenceFile,
  updateMaterialReferenceUrls,
  type MaterialEvidenceFile,
} from "@/lib/actions/material-evidence"
import type { ReferenceUrls } from "@/lib/hs/export-spec"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * B-211 PR-1（P1-D6）: 材料の詳細の節「根拠」
 * - ファイル: 一覧（名前・追加日・追加した人）・追加（PDF / PNG / JPG / EML / MSG・20MB まで）・開く（署名 URL）・取り消す
 * - URL: referenceUrls の一覧・追加・削除
 * - 編集権限（masterTerms）が無い人は見るだけ
 */
type Props = {
  materialId: string
  files: MaterialEvidenceFile[]
  referenceUrls: ReferenceUrls
  canEdit: boolean
}

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.eml,.msg"
const MAX_BYTES = 20 * 1024 * 1024

function formatSize(size: string | null): string {
  if (!size) return ""
  const n = Number(size)
  if (!Number.isFinite(n)) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function EvidenceSection({ materialId, files, referenceUrls, canEdit }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState<{ label: string; url: string } | null>(null)

  const handleFiles = (list: File[]) => {
    if (list.length === 0) return
    startTransition(async () => {
      for (const file of list) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: 20MB を超えています`)
          continue
        }
        const fd = new FormData()
        fd.append("file", file)
        const r = await addMaterialEvidenceFile(materialId, fd)
        if (!r.ok) {
          toast.error(`${file.name}: ${r.error}`)
          continue
        }
        toast.success(`${file.name} を追加しました`)
      }
      router.refresh()
    })
  }

  const openFile = (fileId: string) => {
    startTransition(async () => {
      const r = await getMaterialEvidenceFileUrl(materialId, fileId)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      window.open(r.data.url, "_blank", "noopener,noreferrer")
    })
  }

  const removeFile = (f: MaterialEvidenceFile) => {
    if (!window.confirm(`「${f.fileName}」を取り消しますか？（一覧から消えます）`)) return
    startTransition(async () => {
      const r = await removeMaterialEvidenceFile(materialId, f.id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("取り消しました")
      router.refresh()
    })
  }

  const saveUrls = (next: ReferenceUrls, done: string) => {
    startTransition(async () => {
      const r = await updateMaterialReferenceUrls(materialId, next)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(done)
      setDraft(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* ファイル */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">ファイル</p>
          {canEdit && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFiles(Array.from(e.target.files ?? []))
                  e.target.value = ""
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => inputRef.current?.click()}
                title="PDF / PNG / JPG / EML / MSG・1 件 20MB まで"
              >
                {isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
                ファイルを追加
              </Button>
            </>
          )}
        </div>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            根拠ファイル（規格書 PDF・メール .eml / .msg・画像）はまだありません
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    className="truncate text-left hover:underline"
                    onClick={() => openFile(f.id)}
                    title="開く（署名 URL・15 分）"
                  >
                    {f.fileName}
                  </button>
                  <div className="text-xs text-muted-foreground">
                    {new Date(f.createdAt).toLocaleString("ja-JP")}
                    {f.uploadedBy && ` ・ ${f.uploadedBy}`}
                    {f.fileSize && ` ・ ${formatSize(f.fileSize)}`}
                  </div>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => openFile(f.id)} disabled={isPending}>
                  開く
                </Button>
                {canEdit && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeFile(f)}
                    disabled={isPending}
                    aria-label="取り消す"
                    title="取り消す（論理削除）"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* URL */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">参考 URL</p>
          {canEdit && !draft && (
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => setDraft({ label: "", url: "" })}>
              <Plus className="mr-1 h-3 w-3" />
              URL を追加
            </Button>
          )}
        </div>
        {referenceUrls.length === 0 && !draft && (
          <p className="text-sm text-muted-foreground">メーカーサイトなどの参考 URL はまだありません</p>
        )}
        {referenceUrls.length > 0 && (
          <ul className="divide-y rounded-md border">
            {referenceUrls.map((u, i) => (
              <li key={`${u.url}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  {u.label && <div>{u.label}</div>}
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-muted-foreground hover:underline"
                  >
                    {u.url}
                  </a>
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={isPending}
                    aria-label="URL を削除"
                    onClick={() => {
                      if (!window.confirm("この URL を削除しますか？")) return
                      saveUrls(referenceUrls.filter((_, j) => j !== i), "URL を削除しました")
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {draft && (
          <div className="flex items-start gap-2 rounded-md border p-2">
            <Input
              placeholder="ラベル（例: メーカー規格書）"
              className="w-[220px]"
              maxLength={100}
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
            <Input
              placeholder="https://…"
              className="flex-1"
              maxLength={500}
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            />
            <Button
              type="button"
              size="sm"
              disabled={isPending || draft.url.trim() === ""}
              onClick={() => saveUrls([...referenceUrls, { label: draft.label, url: draft.url }], "URL を追加しました")}
            >
              追加
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => setDraft(null)}>
              やめる
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
