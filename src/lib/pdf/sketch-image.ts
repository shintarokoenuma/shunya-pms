import sharp from "sharp"
import { downloadToBuffer } from "@/lib/gcs"

/**
 * B-054 PR-3: 絵型の原本を react-pdf で描ける形（JPEG）に正規化する。
 * - react-pdf 4.5.1 が描けるのは PNG / JPEG のみ。原本は png / jpeg / webp のいずれか。
 * - react-pdf は EXIF の向きを見ないため、.rotate() で向きを焼き込む（B-204 と同じ理由）。
 * - JPEG は透過を持てず sharp の既定では黒になるため、白で flatten する。
 * - PR-4 でもこの関数をそのまま使う想定。
 */
export type PdfImage = { data: Buffer; format: "jpg" }

export type PdfSketchMeta = {
  srcFormat: string | null
  srcBytes: number
  outBytes: number
  width: number | null
  height: number | null
  ms: number
  error: string | null
}

export async function loadSketchForPdf(
  gcsPath: string,
  opts: { maxEdge: number; quality: number },
): Promise<{ image: PdfImage | null; meta: PdfSketchMeta }> {
  const t0 = Date.now()
  const src = await downloadToBuffer(gcsPath)
  if (!src) {
    return {
      image: null,
      meta: {
        srcFormat: null, srcBytes: 0, outBytes: 0, width: null, height: null,
        ms: Date.now() - t0, error: "原本を読み出せませんでした",
      },
    }
  }
  try {
    const inMeta = await sharp(src).metadata()
    const { data, info } = await sharp(src)
      .rotate()
      .resize({
        width: opts.maxEdge,
        height: opts.maxEdge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: opts.quality, mozjpeg: true })
      .toBuffer({ resolveWithObject: true })
    return {
      image: { data, format: "jpg" },
      meta: {
        srcFormat: inMeta.format ?? null,
        srcBytes: src.length,
        outBytes: data.length,
        width: info.width,
        height: info.height,
        ms: Date.now() - t0,
        error: null,
      },
    }
  } catch (e) {
    return {
      image: null,
      meta: {
        srcFormat: null, srcBytes: src.length, outBytes: 0, width: null, height: null,
        ms: Date.now() - t0,
        error: e instanceof Error ? e.message : "変換に失敗しました",
      },
    }
  }
}
