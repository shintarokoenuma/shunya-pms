import { auth } from "@/lib/auth"
import { getOrderPdfData } from "@/lib/pdf/order-data"
import { renderOrderPdfBuffer } from "@/lib/pdf/render"
import { uploadOrderPdf, timestampJst } from "@/lib/gcs"

/**
 * B-086 §3: 発注書/作業発注 PDF の GCS 控えを「ダウンロード押下時」に保存する。
 * - プレビュー生成時ではなく DL 時にのみ叩かれる（相手に渡した記録だけを凍結する）。
 * - 所有検証は getOrderPdfData（companyId スコープ）に委ねる。他社伝票は null で弾かれ skip。
 * - 保存失敗は DL をブロックしないため、常に 200 を返し件数のみ通知する。
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const kind = body?.kind
  const ids = body?.ids
  if (kind !== "purchase-order" && kind !== "work-order") {
    return new Response("kind が不正です", { status: 400 })
  }
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !ids.every((x) => typeof x === "string")
  ) {
    return new Response("ids が不正です", { status: 400 })
  }

  const type = kind === "purchase-order" ? "po" : "wo"
  let saved = 0
  for (const id of ids) {
    try {
      const data = await getOrderPdfData(type, id, session.user.companyId)
      if (!data) continue // 他社伝票 or 存在しない → skip
      const buffer = await renderOrderPdfBuffer(data)
      const result = await uploadOrderPdf({
        kind,
        orderNumber: data.docNumber,
        buffer,
        timestamp: timestampJst(new Date()),
      })
      if (result) saved += 1
    } catch {
      // 個別の失敗は握りつぶす（DL はクライアント側で完了済み・ブロックしない）。
    }
  }

  return Response.json({ ok: true, saved })
}
