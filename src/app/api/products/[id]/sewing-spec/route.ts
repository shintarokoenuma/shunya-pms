import { auth } from "@/lib/auth"
import { timestampJst } from "@/lib/gcs"
import { parseSewingSpecPages } from "@/lib/pdf/sewing-spec-format"
import { getSewingSpecPdfData } from "@/lib/pdf/sewing-spec-data"
import { renderSewingSpecPdfBuffer } from "@/lib/pdf/render"

/**
 * B-054 PR-4a: 縫製仕様書 PDF（GET・読み取りのみ）。
 * - クエリ: page=<kind>:<woId>[:<sortOrder>(,<sortOrder>…)] を出現順に。kind は sewing | measure | process
 *   （4a は sewing のみ。measure / process は 400「未実装」）
 * - 認証必須・companyId で絞る。未ログインは src/proxy.ts が /login へ 307 で転送する（ここでは 401）
 * - ★4c（品番カルテからの出力ダイアログ）までは画面に入口が無い
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }
  const { id } = await params
  const parsed = parseSewingSpecPages(new URL(req.url).searchParams)
  if (!parsed.ok) {
    return new Response(parsed.error, { status: 400 })
  }

  const result = await getSewingSpecPdfData(id, parsed.pages, session.user.companyId)
  if (!result.ok) {
    if (result.reason === "product-not-found") {
      return new Response("品番が見つかりません", { status: 404 })
    }
    if (result.reason === "sketch-not-found") {
      return new Response(
        `指定の絵型が見つかりません（sortOrder=${result.sortOrder}・woId=${result.woId}）`,
        { status: 400 },
      )
    }
    return new Response(`宛先の作業発注が条件を満たしません: ${result.woId}`, { status: 400 })
  }

  const buffer = await renderSewingSpecPdfBuffer(result.data)
  const stamp = timestampJst(new Date())
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${result.data.productCode}_sewing-spec_${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
