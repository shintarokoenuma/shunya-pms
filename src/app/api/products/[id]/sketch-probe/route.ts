import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { loadSketchForPdf } from "@/lib/pdf/sketch-image"
import { renderSketchProbePdfBuffer } from "@/lib/pdf/render"
import type { SketchProbeItem } from "@/lib/pdf/sketch-probe-document"
import type { ProductSketch } from "@/lib/types/product-sketch"

/**
 * B-054 PR-3: 絵型を react-pdf に載せる技術検証用ルート（GET・読み取りのみ）。
 * - 品番の絵型を1ページ1枚で描き、形式・容量・処理時間をページとサーバログに出す。
 * - ?w=長辺px（400〜4000・既定1600）&q=JPEG品質（40〜95・既定85）で比較できる。
 * - ★PR-4（縫製仕様書 PDF 本体）で本体ルートに置き換えて削除する。
 */
function toInt(v: string | null, def: number, min: number, max: number): number {
  const n = Number.parseInt(v ?? "", 10)
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, n))
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }
  const { id } = await params
  const url = new URL(req.url)
  const maxEdge = toInt(url.searchParams.get("w"), 1600, 400, 4000)
  const quality = toInt(url.searchParams.get("q"), 85, 40, 95)

  const product = await prisma.product.findFirst({
    where: { id, companyId: session.user.companyId, deletedAt: null },
    select: { productCode: true, sketchImages: true },
  })
  if (!product) {
    return new Response("品番が見つかりません", { status: 404 })
  }
  const sketches = (
    Array.isArray(product.sketchImages) ? product.sketchImages : []
  ) as unknown as ProductSketch[]
  if (sketches.length === 0) {
    return new Response("この品番には絵型がありません", { status: 404 })
  }
  const ordered = [...sketches].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  )

  const t0 = Date.now()
  const items: SketchProbeItem[] = []
  for (const s of ordered) {
    const r = await loadSketchForPdf(s.gcsPath, { maxEdge, quality })
    items.push({ caption: s.caption ?? null, image: r.image, meta: r.meta })
  }
  const loadMs = Date.now() - t0
  const buffer = await renderSketchProbePdfBuffer({
    productCode: product.productCode,
    maxEdge,
    quality,
    items,
  })
  const totalMs = Date.now() - t0

  console.log(
    "[sketch-probe]",
    JSON.stringify({
      productCode: product.productCode,
      pages: items.length,
      maxEdge,
      quality,
      loadMs,
      totalMs,
      pdfBytes: buffer.length,
      perImage: items.map((x) => ({
        src: x.meta.srcFormat,
        srcBytes: x.meta.srcBytes,
        outBytes: x.meta.outBytes,
        w: x.meta.width,
        h: x.meta.height,
        ms: x.meta.ms,
        err: x.meta.error,
      })),
    }),
  )

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="sketch-probe-${product.productCode}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
