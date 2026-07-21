import { auth } from "@/lib/auth"
import { getPeQuotationPdfData } from "@/lib/pdf/pe-quotation-data"
import { renderPeQuotationPdfBuffer } from "@/lib/pdf/render"
import { timestampJst } from "@/lib/gcs"

// B-085 量産見積 見積書 PDF（複数 PE を1PDFに縦積み）オンデマンド生成・ダウンロード。
// GCS 控えは保存しない（QE-1R 踏襲）。
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const ids = body?.ids
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !ids.every((x) => typeof x === "string")
  ) {
    return new Response("ids が不正です", { status: 400 })
  }

  const data = await getPeQuotationPdfData(ids, session.user.companyId)
  if ("error" in data) {
    if (data.error === "MIXED_CLIENT") {
      return new Response("宛先が異なる見積が含まれています", { status: 400 })
    }
    if (data.error === "NOT_FOUND") {
      return new Response("見積が見つかりません", { status: 404 })
    }
    if (data.error === "PE_NOT_READY") {
      const nums = data.estimateNumbers?.join(", ") ?? ""
      return new Response(
        `見積数量または1枚単価が未確定の見積が含まれています: ${nums}`,
        { status: 400 },
      )
    }
    return new Response("ids が不正です", { status: 400 })
  }

  const buffer = await renderPeQuotationPdfBuffer(data)
  const stamp = timestampJst(new Date())
  const filename = `量産見積書_${data.clientName}_${stamp}.pdf`
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "no-store",
    },
  })
}
