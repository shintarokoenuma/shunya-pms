import { auth } from "@/lib/auth"
import { getQuotationPdfData } from "@/lib/pdf/quotation-data"
import { renderQuotationPdfBuffer } from "@/lib/pdf/render"
import { timestampJst } from "@/lib/gcs"

// QE-1R 見積書 PDF（複数見積を1PDFに縦積み）オンデマンド生成・ダウンロード（Part B）。
// GCS 控えは v0.1 では保存しない。
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

  const data = await getQuotationPdfData(ids, session.user.companyId)
  if ("error" in data) {
    if (data.error === "MIXED_CLIENT") {
      return new Response("宛先が異なる見積が含まれています", { status: 400 })
    }
    if (data.error === "NOT_FOUND") {
      return new Response("見積が見つかりません", { status: 404 })
    }
    if (data.error === "MOQ_REQUIRED") {
      const nums = data.estimateNumbers?.join(", ") ?? ""
      return new Response(
        `提示MOQ 未入力の見積が含まれています: ${nums}`,
        { status: 400 },
      )
    }
    if (data.error === "UNIT_UNRESOLVED") {
      const nums = data.estimateNumbers?.join(", ") ?? ""
      return new Response(
        `1枚単価を導出できない見積が含まれています（明細か手打ち単価を確認）: ${nums}`,
        { status: 400 },
      )
    }
    return new Response("ids が不正です", { status: 400 })
  }

  const buffer = await renderQuotationPdfBuffer(data)
  const stamp = timestampJst(new Date())
  const filename = `見積書_${data.clientName}_${stamp}.pdf`
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "no-store",
    },
  })
}
