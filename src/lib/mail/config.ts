/**
 * B-205 PR-3（P3-D2）: メール送信の設定。すべて環境変数で持ち、無いときは既定を使う。
 * 運営側がコードを変えずに切り替えられるようにするための1か所。
 *
 * | 名前                              | 既定                        |
 * |-----------------------------------|-----------------------------|
 * | RESEND_API_KEY                    | なし（無ければ apiKey=null） |
 * | MAIL_FROM_ADDRESS                 | noreply@shunya.cc           |
 * | MAIL_FROM_NAME                    | PMS                         |
 * | INVITE_TOKEN_TTL_HOURS            | 72                          |
 * | PASSWORD_RESET_TOKEN_TTL_MINUTES  | 60                          |
 * | APP_BASE_URL                      | dev は http://localhost:3001・本番は必須（無ければ null） |
 *
 * ★AUTH_URL / NEXTAUTH_URL は使わない（別に持つ・§1）
 */

export const MAIL_DEFAULTS = {
  fromAddress: "noreply@shunya.cc",
  fromName: "PMS",
  inviteTtlHours: 72,
  passwordResetTtlMinutes: 60,
  devAppBaseUrl: "http://localhost:3001",
} as const

export type MailConfig = {
  /** Resend の API キー。無ければ null（本番は送らない・dev はコンソールに出す・P3-D13） */
  apiKey: string | null
  fromAddress: string
  fromName: string
  inviteTtlHours: number
  passwordResetTtlMinutes: number
  /** メールに書くリンクの頭（末尾の / は無し）。本番で未設定なら null */
  appBaseUrl: string | null
}

/** 数でない・0 以下・空なら fallback（純関数） */
export function parsePositiveInt(raw: string | null | undefined, fallback: number): number {
  if (raw == null) return fallback
  const t = raw.trim()
  if (!/^\d+$/.test(t)) return fallback
  const n = Number(t)
  return Number.isSafeInteger(n) && n > 0 ? n : fallback
}

/** 末尾の / を取る（純関数） */
export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "")
}

function nonEmpty(raw: string | undefined): string | null {
  const t = (raw ?? "").trim()
  return t === "" ? null : t
}

/** 環境変数の束から設定を組み立てる（純関数・テスト用に env を引数で受ける） */
export function readMailConfig(env: Record<string, string | undefined>, nodeEnv: string | undefined): MailConfig {
  const isProduction = nodeEnv === "production"
  const base = nonEmpty(env.APP_BASE_URL)
  return {
    apiKey: nonEmpty(env.RESEND_API_KEY),
    fromAddress: nonEmpty(env.MAIL_FROM_ADDRESS) ?? MAIL_DEFAULTS.fromAddress,
    fromName: nonEmpty(env.MAIL_FROM_NAME) ?? MAIL_DEFAULTS.fromName,
    inviteTtlHours: parsePositiveInt(env.INVITE_TOKEN_TTL_HOURS, MAIL_DEFAULTS.inviteTtlHours),
    passwordResetTtlMinutes: parsePositiveInt(env.PASSWORD_RESET_TOKEN_TTL_MINUTES, MAIL_DEFAULTS.passwordResetTtlMinutes),
    appBaseUrl: base ? stripTrailingSlash(base) : isProduction ? null : MAIL_DEFAULTS.devAppBaseUrl,
  }
}

export function getMailConfig(): MailConfig {
  return readMailConfig(process.env, process.env.NODE_ENV)
}

export class MailConfigError extends Error {}

/** 本番で APP_BASE_URL が無ければ throw（呼び出し側で画面の文に変える） */
export function getAppBaseUrl(): string {
  const base = getMailConfig().appBaseUrl
  if (!base) throw new MailConfigError("APP_BASE_URL が設定されていません")
  return base
}

/** 「1時間」「90分」のように有効期限を文にする（純関数・§4-6 の文に使う） */
export function formatTtlMinutes(minutes: number): string {
  if (minutes > 0 && minutes % 60 === 0) return `${minutes / 60}時間`
  return `${minutes}分`
}
