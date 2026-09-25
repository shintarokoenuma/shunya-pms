import { auth } from "@/lib/auth"
import { getInvoicePdfData } from "@/lib/pdf/invoice-data"
import { renderInvoicePdfBuffer } from "@/lib/pdf/render"
import { timestampJst } from "@/lib/gcs"

/**
 * B-109 PR-4（P4-D15）: 請求書 PDF。POST {ids} で複数を1PDFに縦積み（1件なら {番号}_{stamp}.pdf）。
 * - 所有検証は getInvoicePdfData（companyId・deletedAt）に委ねる。他社・不存在は skip
 * - GCS 控えはここでは保存しない（DL 押下時に /api/order-pdf-archive で保存する・B-086）
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const ids = body?.ids
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === "string")) {
    return new Response("ids が不正です", { status: 400 })
  }
  const dataList = []
  for (const id of [...new Set(ids as string[])]) {
    const data = await getInvoicePdfData(id, session.user.companyId)
    if (data) dataList.push(data)
  }
  if (dataList.length === 0) {
    return new Response("請求書が見つかりません", { status: 404 })
  }
  const buffer = await renderInvoicePdfBuffer(dataList)
  const stamp = timestampJst(new Date())
  const filename =
    dataList.length === 1 ? `${dataList[0].invoiceNumber}_${stamp}.pdf` : `請求書_${dataList.length}件_${stamp}.pdf`
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "no-store",
    },
  })
}
