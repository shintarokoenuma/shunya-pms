import { auth } from "@/lib/auth"
import { getOrderPdfData } from "@/lib/pdf/order-data"
import { renderOrderPdfBuffer } from "@/lib/pdf/render"
import { timestampJst } from "@/lib/gcs"

// 発注書 PDF（WO）オンデマンド生成・ダウンロード（S-4c-2）。
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }
  const { id } = await params
  const data = await getOrderPdfData("wo", id, session.user.companyId)
  if (!data) {
    return new Response("Not Found", { status: 404 })
  }

  const buffer = await renderOrderPdfBuffer(data)
  // B-086: GCS 控えは「開いただけ」では取らない（DL 押下時に /api/order-pdf-archive で保存）。
  const stamp = timestampJst(new Date())
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.docNumber}_${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
