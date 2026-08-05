import { auth } from "@/lib/auth"
import { getOrderPdfData } from "@/lib/pdf/order-data"
import { renderOrderPdfBuffer } from "@/lib/pdf/render"
import { uploadOrderPdf, timestampJst } from "@/lib/gcs"

/**
 * B-117: DL 名末尾の stamp（`yyyyMMdd-HHmmss`）が渡された場合のみ検証して受け入れる。
 * stamp は外部入力であり GCS オブジェクトパスに使うため、パストラバーサル防止として
 * 「数字8 + '-' + 数字6（計15文字）」以外は一切受け付けず、内部生成にフォールバックする。
 * 正規表現ではなく明示的な位置・文字種チェックで判定する。
 */
function isValidStamp(v: unknown): v is string {
  if (typeof v !== "string") return false
  if (v.length !== 15) return false
  if (v[8] !== "-") return false
  for (let i = 0; i < v.length; i++) {
    if (i === 8) continue
    const ch = v[i]
    if (ch < "0" || ch > "9") return false
  }
  return true
}

/**
 * B-086 §3: 発注書/作業発注 PDF の GCS 控えを「ダウンロード押下時」に保存する。
 * - プレビュー生成時ではなく DL 時にのみ叩かれる（相手に渡した記録だけを凍結する）。
 * - 所有検証は getOrderPdfData（companyId スコープ）に委ねる。他社伝票は null で弾かれ skip。
 * - 保存失敗は DL をブロックしないため、常に 200 を返し件数のみ通知する。
 * - B-117: body.stamp が有効ならその値を控えのタイムスタンプに使い、DL 名と一致させる。
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

  // B-117: 検証を通った stamp のみ採用。不正・未指定なら内部生成にフォールバック。
  const stamp = isValidStamp(body?.stamp)
    ? body.stamp
    : timestampJst(new Date())

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
        timestamp: stamp,
      })
      if (result) saved += 1
    } catch {
      // 個別の失敗は握りつぶす（DL はクライアント側で完了済み・ブロックしない）。
    }
  }

  return Response.json({ ok: true, saved })
}
