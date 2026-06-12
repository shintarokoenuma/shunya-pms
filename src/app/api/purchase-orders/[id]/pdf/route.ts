import { auth } from "@/lib/auth"
import { getOrderPdfData } from "@/lib/pdf/order-data"
import { renderOrderPdfBuffer } from "@/lib/pdf/render"
import { uploadOrderPdf, timestampJst } from "@/lib/gcs"

// 発注書 PDF（PO）オンデマンド生成・ダウンロード（S-4c-2）。
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }
  const { id } = await params
  const data = await getOrderPdfData("po", id, session.user.companyId)
  if (!data) {
    return new Response("Not Found", { status: 404 })
  }

  const buffer = await renderOrderPdfBuffer(data)
  // B-055: DL ファイル名と GCS 控えのタイムスタンプを同一値にする（突合可能に）。
  const stamp = timestampJst(new Date())
  // B-053: GCS へ控えを保存（失敗しても null が返るだけで返却は継続）。
  await uploadOrderPdf({
    kind: "purchase-order",
    orderNumber: data.docNumber,
    buffer,
    timestamp: stamp,
  })
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.docNumber}_${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
