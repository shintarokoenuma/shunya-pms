"use client"

import { useTransition } from "react"
import { FileText } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { usePdfPreview, PdfPreviewDialog } from "./pdf-preview-dialog"

/**
 * B-117: DL ファイル名末尾の stamp（`yyyyMMdd-HHmmss`）を取り出す。
 * 形式は `{docNumber}_{stamp}.pdf` / `発注書_N件_{stamp}.pdf` のいずれも末尾が stamp。
 * 正規表現を使わず、明示的な位置・文字種チェックで抽出する。取れなければ null。
 */
function extractStamp(filename: string): string | null {
  if (!filename.endsWith(".pdf")) return null
  const base = filename.slice(0, -4) // ".pdf" を除去
  const idx = base.lastIndexOf("_")
  if (idx < 0) return null
  const candidate = base.slice(idx + 1) // 末尾 "_" 以降
  // yyyyMMdd-HHmmss = 数字8 + "-" + 数字6（計15文字）
  if (candidate.length !== 15) return null
  if (candidate[8] !== "-") return null
  for (let i = 0; i < candidate.length; i++) {
    if (i === 8) continue
    const ch = candidate[i]
    if (ch < "0" || ch > "9") return null
  }
  return candidate
}

/**
 * B-086: 発注書/作業発注 PDF の「プレビュー → 承認後 DL」ボタン（PO/WO 詳細ページ共用）。
 * - 旧 `<a href={GET} target="_blank">`（開いた瞬間 DL＋GCS 控え保存）を置き換える。
 * - endpoint は POST {ids}。詳細ページからは単一 ID（ids=[id]）で叩く。
 * - DL 押下時に /api/order-pdf-archive を叩いて GCS 控えを保存する（§3・失敗は握りつぶす）。
 */
export function OrderPdfPreviewButton({
  endpoint,
  kind,
  id,
  fallbackName,
}: {
  endpoint: string
  kind: "purchase-order" | "work-order"
  id: string
  fallbackName: string
}) {
  const preview = usePdfPreview()
  const [pending, startTransition] = useTransition()

  function handleOpen() {
    startTransition(async () => {
      const r = await preview.open(endpoint, [id], fallbackName)
      if (!r.ok) toast.error(r.message)
    })
  }

  function handleDownload(filename: string) {
    // B-117: DL 名の末尾 stamp を控え側にも渡し、B-055 の突合（DL 名 = 控え名）を保つ。
    // 取れなければ stamp を送らず、API 側の内部生成にフォールバックさせる。
    const stamp = extractStamp(filename)
    // 控え保存はベストエフォート（DL 自体はクライアント側 blob で完了済み）。
    void fetch("/api/order-pdf-archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ids: [id], ...(stamp ? { stamp } : {}) }),
    }).catch(() => {})
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        disabled={pending}
      >
        <FileText className="mr-1 h-4 w-4" />
        発注書 PDF
      </Button>
      <PdfPreviewDialog
        url={preview.url}
        filename={preview.filename}
        onClose={preview.close}
        onDownload={handleDownload}
      />
    </>
  )
}
