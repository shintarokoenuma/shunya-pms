import { auth } from "@/lib/auth"
import { getOrderPdfData } from "@/lib/pdf/order-data"
import { renderOrderPdfBufferMulti } from "@/lib/pdf/render"
import { timestampJst } from "@/lib/gcs"

/**
 * B-086: 作業発注 PDF（WO）プレビュー用。POST {ids} で複数を1PDFに縦積み（発注ごと改ページ・案B）。
 * - 宛先（工場/外注先）の混在は許可する（各ページが独立した正式発注書のため）。
 * - GCS 控えはここでは保存しない（DL 押下時に /api/order-pdf-archive で保存する）。
 * - 既存 GET /api/work-orders/[id]/pdf は残す（本 PR では削除しない）。
 */
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

  const uniqueIds = [...new Set(ids as string[])]
  const dataList = []
  for (const id of uniqueIds) {
    const data = await getOrderPdfData("wo", id, session.user.companyId)
    if (data) dataList.push(data)
  }
  if (dataList.length === 0) {
    return new Response("作業発注が見つかりません", { status: 404 })
  }

  const buffer = await renderOrderPdfBufferMulti(dataList)
  const stamp = timestampJst(new Date())
  const filename =
    dataList.length === 1
      ? `${dataList[0].docNumber}_${stamp}.pdf`
      : `作業発注書_${dataList.length}件_${stamp}.pdf`
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "no-store",
    },
  })
}
