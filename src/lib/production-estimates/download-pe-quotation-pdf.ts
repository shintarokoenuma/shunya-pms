/**
 * B-085 量産見積 見積書 PDF の共通ダウンロードハンドラ。
 * 横断一覧（/quotations）・品番カルテ内の両方から呼ぶ。
 * POST /api/production-estimates/pdf → blob → 一時 <a> で DL（download-quotation-pdf.ts 作法踏襲）。
 */
export async function downloadPeQuotationPdf(
  ids: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch("/api/production-estimates/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) {
    return { ok: false, message: await res.text() }
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)

  const filename = filenameFromDisposition(
    res.headers.get("Content-Disposition"),
  )

  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)

  return { ok: true }
}

function filenameFromDisposition(disposition: string | null): string {
  if (!disposition) return "量産見積書.pdf"
  const match = disposition.match(/filename="?([^"]+)"?/)
  if (!match) return "量産見積書.pdf"
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}
