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
