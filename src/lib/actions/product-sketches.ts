"use server"

import { revalidatePath } from "next/cache"
import sharp from "sharp"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { uploadProductSketch, getSignedReadUrl } from "@/lib/gcs"
import type { ProductSketch, ProductSketchView } from "@/lib/types/product-sketch"

/**
 * B-027: 品番カルテ 絵型（服のスケッチ）Server Actions。
 * 仕様: docs/specs/b-027-product-sketch-spec-confirmation-v1_1-2026-06-16.md §5
 * - markings.ts の attach/get を鏡写し（FormData→Buffer→GCS→DB update→AuditLog→revalidate）。
 * - 画像は GCS パス保持・表示時に署名URL化。サムネは sharp で長辺400px・WebP。
 * - sketchImages(Json) を配列まるごと更新（last-write-wins・最新読み直してから操作）。
 * - 物理削除（GCS オブジェクト）はしない＝既存方針（孤児許容・§6）。
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

async function requireSession() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, error: "認証されていません" }
  }
  return {
    ok: true as const,
    companyId: session.user.companyId,
    userId: session.user.id,
  }
}

const SKETCH_MAX_BYTES = 5 * 1024 * 1024 // 5MB/枚
const SKETCH_MAX_COUNT = 20 // 1品番あたり上限
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

/** sketchImages(Json) を ProductSketch[] として安全に読む。 */
function readImages(raw: unknown): ProductSketch[] {
  if (!Array.isArray(raw)) return []
  return raw as ProductSketch[]
}

/** sortOrder 昇順の先頭 thumbGcsPath（無ければ gcsPath）。0枚なら null。 */
function syncThumbPath(images: ProductSketch[]): string | null {
  if (images.length === 0) return null
  const head = [...images].sort((a, b) => a.sortOrder - b.sortOrder)[0]
  return head.thumbGcsPath || head.gcsPath
}

/** 品番の所有確認（companyId スコープ）＋現 sketchImages を返す。 */
async function loadProduct(productId: string, companyId: string) {
  return prisma.product.findFirst({
    where: { id: productId, companyId, deletedAt: null },
    select: { id: true, sketchImages: true },
  })
}

// =============================================================================
// 1. 追加（画像1枚 → サムネ生成 → 原本+サムネ GCS → 配列追記）
// =============================================================================
export async function addProductSketch(
  productId: string,
  formData: FormData,
): Promise<ActionResult<{ count: number }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const product = await loadProduct(productId, sess.companyId)
    if (!product) return { ok: false, error: "品番が見つかりません" }

    const file = formData.get("file")
    if (!(file instanceof File)) return { ok: false, error: "ファイルがありません" }
    const ext = ALLOWED_TYPES[file.type]
    if (!ext) {
      return { ok: false, error: "PNG / JPEG / WebP の画像のみ添付できます" }
    }
    if (file.size > SKETCH_MAX_BYTES) {
      return { ok: false, error: "ファイルサイズは 5MB 以下にしてください" }
    }

    const images = readImages(product.sketchImages)
    if (images.length >= SKETCH_MAX_COUNT) {
      return { ok: false, error: `絵型は1品番あたり ${SKETCH_MAX_COUNT} 枚までです` }
    }

    const originalBuffer = Buffer.from(await file.arrayBuffer())

    // サムネ生成（長辺400px・WebP）。失敗時は null＝原本のみ保存＋thumbGcsPath=gcsPath にフォールバック。
    let thumbBuffer: Buffer | null = null
    try {
      thumbBuffer = await sharp(originalBuffer)
        .resize({ width: 400, height: 400, fit: "inside", withoutEnlargement: true })
        .webp()
        .toBuffer()
    } catch (e) {
      console.error(
        "[b027] サムネ生成に失敗（原本のみ保存にフォールバック）:",
        e instanceof Error ? e.message : "unknown error",
      )
    }

    const uploaded = await uploadProductSketch(
      productId,
      originalBuffer,
      thumbBuffer,
      file.type,
      ext,
    )
    if (!uploaded) {
      return {
        ok: false,
        error:
          "GCS へのアップロードに失敗しました（環境変数 or 権限を確認してください）。レコードは変更していません。",
      }
    }

    // 最新を読み直してから追記（last-write-wins の影響を最小化）
    const fresh = await loadProduct(productId, sess.companyId)
    if (!fresh) return { ok: false, error: "品番が見つかりません" }
    const current = readImages(fresh.sketchImages)
    if (current.length >= SKETCH_MAX_COUNT) {
      return { ok: false, error: `絵型は1品番あたり ${SKETCH_MAX_COUNT} 枚までです` }
    }
    const nextOrder =
      current.reduce((m, i) => Math.max(m, i.sortOrder), -1) + 1
    const next: ProductSketch[] = [
      ...current,
      {
        gcsPath: uploaded.gcsPath,
        thumbGcsPath: uploaded.thumbGcsPath,
        sortOrder: nextOrder,
      },
    ]

    await prisma.product.update({
      where: { id: productId },
      data: { sketchImages: next, sketchThumbPath: syncThumbPath(next) },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Product",
        entityId: productId,
        afterData: { action: "add_sketch", gcsPath: uploaded.gcsPath },
      },
    })

    revalidatePath(`/products/${productId}`)
    revalidatePath("/products")
    return { ok: true, data: { count: next.length } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "絵型の追加に失敗しました" }
  }
}

// =============================================================================
// 2. 削除（配列から除去・GCS は残置）
// =============================================================================
export async function deleteProductSketch(
  productId: string,
  gcsPath: string,
): Promise<ActionResult<{ count: number }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const product = await loadProduct(productId, sess.companyId)
    if (!product) return { ok: false, error: "品番が見つかりません" }

    const current = readImages(product.sketchImages)
    const next = current.filter((i) => i.gcsPath !== gcsPath)
    if (next.length === current.length) {
      return { ok: false, error: "対象の絵型が見つかりません" }
    }
    // sortOrder を 0..n-1 に詰め直す
    next.sort((a, b) => a.sortOrder - b.sortOrder)
    next.forEach((img, idx) => (img.sortOrder = idx))

    await prisma.product.update({
      where: { id: productId },
      data: { sketchImages: next, sketchThumbPath: syncThumbPath(next) },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Product",
        entityId: productId,
        beforeData: { action: "delete_sketch", gcsPath },
      },
    })

    revalidatePath(`/products/${productId}`)
    revalidatePath("/products")
    return { ok: true, data: { count: next.length } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "絵型の削除に失敗しました" }
  }
}

// =============================================================================
// 3. 並び替え（gcsPath の配列順で sortOrder を振り直す）
// =============================================================================
export async function reorderProductSketches(
  productId: string,
  orderedPaths: string[],
): Promise<ActionResult<{ count: number }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const product = await loadProduct(productId, sess.companyId)
    if (!product) return { ok: false, error: "品番が見つかりません" }

    const current = readImages(product.sketchImages)
    const byPath = new Map(current.map((i) => [i.gcsPath, i]))
    // orderedPaths の順で並べ、漏れた要素は末尾に従来順で付ける
    const ordered: ProductSketch[] = []
    for (const p of orderedPaths) {
      const img = byPath.get(p)
      if (img) {
        ordered.push(img)
        byPath.delete(p)
      }
    }
    for (const img of current) {
      if (byPath.has(img.gcsPath)) ordered.push(img)
    }
    ordered.forEach((img, idx) => (img.sortOrder = idx))

    await prisma.product.update({
      where: { id: productId },
      data: { sketchImages: ordered, sketchThumbPath: syncThumbPath(ordered) },
    })

    revalidatePath(`/products/${productId}`)
    revalidatePath("/products")
    return { ok: true, data: { count: ordered.length } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "並び替えに失敗しました" }
  }
}

// =============================================================================
// 4. 表示用：各画像を署名URL化して sortOrder 昇順で返す（read のみ）
// =============================================================================
export async function getProductSketchUrls(
  productId: string,
): Promise<ActionResult<ProductSketchView[]>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const product = await loadProduct(productId, sess.companyId)
    if (!product) return { ok: false, error: "品番が見つかりません" }

    const images = readImages(product.sketchImages).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    )
    const views = await Promise.all(
      images.map(async (img) => {
        const [url, thumbUrl] = await Promise.all([
          getSignedReadUrl(img.gcsPath),
          getSignedReadUrl(img.thumbGcsPath),
        ])
        return {
          gcsPath: img.gcsPath,
          url: url ?? "",
          thumbUrl: thumbUrl ?? url ?? "",
          caption: img.caption,
          sortOrder: img.sortOrder,
        } satisfies ProductSketchView
      }),
    )
    return { ok: true, data: views }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "絵型URLの取得に失敗しました" }
  }
}
