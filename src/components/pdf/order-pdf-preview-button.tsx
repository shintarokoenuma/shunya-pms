"use client"

import { useTransition } from "react"
import { FileText } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { usePdfPreview, PdfPreviewDialog } from "./pdf-preview-dialog"

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

  function handleDownload() {
    // 控え保存はベストエフォート（DL 自体はクライアント側 blob で完了済み）。
    void fetch("/api/order-pdf-archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ids: [id] }),
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
