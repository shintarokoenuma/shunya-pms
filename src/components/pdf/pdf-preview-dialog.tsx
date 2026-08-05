"use client"

import { useCallback, useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * 見積書PDF の「プレビュー→ダウンロード」共通モーダル（QE-1R / PE 共通・二重実装しない）。
 * - usePdfPreview().open(endpoint, ids, fallbackName): POST → blob → objectURL＋Content-Disposition の
 *   ファイル名を保持しモーダルを開く。エラー時は { ok:false, message } を返し呼び出し側の toast に委ねる。
 * - モーダル内「ダウンロード」で <a download filename> により保存（blob 直開きで名前が落ちるのを防ぐ）。
 * - 「閉じる」/×/オーバーレイで DL せずキャンセル可。クローズ時に blob URL を revoke。
 */

function filenameFromDisposition(
  disposition: string | null,
  fallback: string,
): string {
  if (!disposition) return fallback
  const match = disposition.match(/filename="?([^"]+)"?/)
  if (!match) return fallback
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export function usePdfPreview() {
  const [url, setUrl] = useState<string | null>(null)
  const [filename, setFilename] = useState("")

  const open = useCallback(
    async (
      endpoint: string,
      ids: string[],
      fallbackName: string,
    ): Promise<{ ok: true } | { ok: false; message: string }> => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) {
        return { ok: false, message: await res.text() }
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      setFilename(
        filenameFromDisposition(
          res.headers.get("Content-Disposition"),
          fallbackName,
        ),
      )
      setUrl(objectUrl)
      return { ok: true }
    },
    [],
  )

  const close = useCallback(() => {
    setUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [])

  return { url, filename, open, close }
}

export function PdfPreviewDialog({
  url,
  filename,
  onClose,
  onDownload,
}: {
  url: string | null
  filename: string
  onClose: () => void
  /**
   * B-086/B-117: ダウンロード押下時のコールバック（GCS 控え保存 API を叩く等）。未指定でも動く。
   * B-117: プレビュー時に確定した filename（`{docNumber}_{stamp}.pdf`）を渡す。控え側が
   * 新規に時刻を生成せず、この stamp を使って B-055 の突合（DL 名 = 控え名）を保つため。
   */
  onDownload?: (filename: string) => void
}) {
  return (
    <Dialog
      open={url !== null}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      {/* 画面ほぼいっぱいに拡大。既定の sm:max-w-lg を sm:max-w-[1500px] で上書き。 */}
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-[1500px] flex-col gap-3 sm:max-w-[1500px]">
        <DialogHeader>
          <DialogTitle className="truncate text-base">
            {filename || "見積書プレビュー"}
          </DialogTitle>
        </DialogHeader>
        {url && (
          <iframe
            src={url}
            title="PDF プレビュー"
            className="min-h-0 w-full flex-1 rounded-md border"
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            閉じる
          </Button>
          {url && (
            <Button asChild>
              <a href={url} download={filename} onClick={() => onDownload?.(filename)}>
                <Download className="mr-1 h-4 w-4" />
                ダウンロード
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
