import { auth } from "@/lib/auth"
import { getOrderPdfData } from "@/lib/pdf/order-data"
import { renderOrderPdfBuffer } from "@/lib/pdf/render"
import { uploadOrderPdf } from "@/lib/gcs"

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
  // B-053: GCS へ控えを保存（失敗しても null が返るだけで返却は継続）。
  await uploadOrderPdf({
    kind: "work-order",
    orderNumber: data.docNumber,
    buffer,
  })
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.docNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
