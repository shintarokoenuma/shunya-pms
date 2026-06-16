import { Storage } from "@google-cloud/storage"
// 注: 本モジュールはサーバ専用（PDF route からのみ import）。秘密情報を扱うためクライアントに含めないこと。

/**
 * B-053: Google Cloud Storage 連携（発注書 PDF の控え保存）。
 *
 * 設計方針:
 * - 環境変数 GCP_PROJECT_ID / GCS_BUCKET_NAME / GCP_SERVICE_ACCOUNT_KEY_BASE64 を読む。
 *   GCP_SERVICE_ACCOUNT_KEY_BASE64 は SA JSON キーの Base64（1行）。Base64→JSON 復号して
 *   credentials 直渡し（ファイル書き出しはしない）。
 * - dev/本番の出し分けは GCS_BUCKET_NAME をそのまま使う（コードで分岐しない）。
 * - ★graceful degradation: 未設定・初期化失敗・アップロード失敗時は console.error に
 *   （キー情報を含めず）出して null を返す。例外を上に投げず、PDF のユーザー返却を阻害しない。
 * - ⚠️ キーの中身・Base64 文字列は絶対にログ出力しない。
 */

type StorageContext = { storage: Storage; bucketName: string }

// モジュールスコープのシングルトン（初期化は1回だけ試行）
let cached: StorageContext | null = null
let initialized = false

function getStorageContext(): StorageContext | null {
  if (initialized) return cached
  initialized = true

  const projectId = process.env.GCP_PROJECT_ID
  const bucketName = process.env.GCS_BUCKET_NAME
  const keyBase64 = process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64

  if (!projectId || !bucketName || !keyBase64) {
    console.error(
      "[gcs] 環境変数が未設定のため GCS 連携を無効化します（GCP_PROJECT_ID / GCS_BUCKET_NAME / GCP_SERVICE_ACCOUNT_KEY_BASE64）。",
    )
    cached = null
    return null
  }

  try {
    const json = Buffer.from(keyBase64, "base64").toString("utf8")
    const credentials = JSON.parse(json) as {
      client_email?: string
      private_key?: string
    }
    const storage = new Storage({ projectId, credentials })
    cached = { storage, bucketName }
    return cached
  } catch (e) {
    // キー本体は出さず、種別のみ
    console.error(
      "[gcs] サービスアカウントキーの復号/初期化に失敗しました:",
      e instanceof Error ? e.message : "unknown error",
    )
    cached = null
    return null
  }
}

/**
 * yyyyMMdd-HHmmss を JST (Asia/Tokyo) 基準で生成する。
 * コンテナTZ非依存: UTC エポックに +9時間して getUTC* で整形する
 * （Railway コンテナは UTC。JST は DST が無いため固定 +9h で正しい）。
 */
export function timestampJst(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0")
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return (
    `${jst.getUTCFullYear()}${p(jst.getUTCMonth() + 1)}${p(jst.getUTCDate())}` +
    `-${p(jst.getUTCHours())}${p(jst.getUTCMinutes())}${p(jst.getUTCSeconds())}`
  )
}

export type UploadOrderPdfParams = {
  kind: "purchase-order" | "work-order"
  orderNumber: string
  buffer: Buffer
  /** JST タイムスタンプ(yyyyMMdd-HHmmss)。DL ファイル名と突合させるため route 側で生成して渡す。
   *  未指定なら内部生成（後方互換）。 */
  timestamp?: string
}

/**
 * 発注書 PDF を GCS に保存する。
 * パス規約: {kind}/{orderNumber}/{yyyyMMdd-HHmmss}.pdf（再生成のたびに別オブジェクト＝履歴保持・上書きしない）。
 * 失敗時は null を返す（例外は投げない）。
 */
export async function uploadOrderPdf(
  params: UploadOrderPdfParams,
): Promise<{ gcsPath: string } | null> {
  const ctx = getStorageContext()
  if (!ctx) return null

  const stamp = params.timestamp ?? timestampJst(new Date())
  const objectPath = `${params.kind}/${params.orderNumber}/${stamp}.pdf`

  try {
    await ctx.storage
      .bucket(ctx.bucketName)
      .file(objectPath)
      .save(params.buffer, {
        contentType: "application/pdf",
        resumable: false,
      })
    return { gcsPath: `gs://${ctx.bucketName}/${objectPath}` }
  } catch (e) {
    console.error(
      `[gcs] 発注書PDFのアップロードに失敗しました (${objectPath}):`,
      e instanceof Error ? e.message : "unknown error",
    )
    return null
  }
}

/**
 * QE-0c: マーキング図 原本PDF を GCS に保存する。
 * パス規約: marking/{productId}/{yyyyMMdd-HHmmss}.pdf（履歴保持・上書きなし。識別子は productId）。
 * 失敗/未設定は null を返す（呼び出し側＝添付 action は null をエラー扱いにする＝控え保存と違い保存自体が目的）。
 */
export async function uploadMarkingPdf(
  productId: string,
  buffer: Buffer,
): Promise<{ gcsPath: string } | null> {
  const ctx = getStorageContext()
  if (!ctx) return null

  const stamp = timestampJst(new Date())
  const objectPath = `marking/${productId}/${stamp}.pdf`
  try {
    await ctx.storage
      .bucket(ctx.bucketName)
      .file(objectPath)
      .save(buffer, { contentType: "application/pdf", resumable: false })
    return { gcsPath: `gs://${ctx.bucketName}/${objectPath}` }
  } catch (e) {
    console.error(
      `[gcs] マーキング原本PDFのアップロードに失敗しました (${objectPath}):`,
      e instanceof Error ? e.message : "unknown error",
    )
    return null
  }
}

/**
 * B-027: 品番カルテ 絵型（服のスケッチ）の画像を GCS に保存する。
 * 原本とサムネ（WebP）の2オブジェクトを同一 stamp で対にして保存する。
 * パス規約:
 *   原本:   sketch/{productId}/{yyyyMMdd-HHmmss}.{ext}（contentType=引数）
 *   サムネ: sketch/{productId}/{yyyyMMdd-HHmmss}.thumb.webp（contentType="image/webp"）
 * 履歴保持・上書きなし。失敗/未設定は null（graceful degradation・例外は投げない）。
 */
export async function uploadProductSketch(
  productId: string,
  originalBuffer: Buffer,
  thumbBuffer: Buffer | null, // null=サムネ生成失敗時。原本のみ保存し thumbGcsPath=gcsPath
  contentType: string,
  ext: string,
): Promise<{ gcsPath: string; thumbGcsPath: string } | null> {
  const ctx = getStorageContext()
  if (!ctx) return null

  const stamp = timestampJst(new Date())
  const base = `sketch/${productId}/${stamp}`
  const originalPath = `${base}.${ext}`
  const thumbPath = `${base}.thumb.webp`
  try {
    const bucket = ctx.storage.bucket(ctx.bucketName)
    await bucket
      .file(originalPath)
      .save(originalBuffer, { contentType, resumable: false })
    const gcsPath = `gs://${ctx.bucketName}/${originalPath}`
    if (!thumbBuffer) {
      // サムネ無し: 原本を表示にも使う
      return { gcsPath, thumbGcsPath: gcsPath }
    }
    await bucket
      .file(thumbPath)
      .save(thumbBuffer, { contentType: "image/webp", resumable: false })
    return { gcsPath, thumbGcsPath: `gs://${ctx.bucketName}/${thumbPath}` }
  } catch (e) {
    console.error(
      `[gcs] 絵型画像のアップロードに失敗しました (${originalPath}):`,
      e instanceof Error ? e.message : "unknown error",
    )
    return null
  }
}

/**
 * gs://bucket/object 形式のパスから署名付き読み取りURL（有効期限15分）を生成する。
 * バケットは非公開のためダウンロード/プレビューはこれ経由。失敗/未設定は null。
 */
export async function getSignedReadUrl(gcsPath: string): Promise<string | null> {
  const ctx = getStorageContext()
  if (!ctx) return null
  const m = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/)
  if (!m) {
    console.error("[gcs] gcsPath の形式が不正です")
    return null
  }
  const [, bucket, object] = m
  try {
    const [url] = await ctx.storage
      .bucket(bucket)
      .file(object)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 15 * 60 * 1000, // 15分
      })
    return url
  } catch (e) {
    console.error(
      "[gcs] 署名URLの生成に失敗しました:",
      e instanceof Error ? e.message : "unknown error",
    )
    return null
  }
}
