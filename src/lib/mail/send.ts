import { Resend } from "resend"
import { getMailConfig } from "./config"

/**
 * B-205 PR-3（P3-D13・D-8）: メールを1通送る。Resend を使う。
 * - 招待や再設定の知識はここに入れない（B-049 発注書・B-219 請求書の送付でも使い回す）
 * - API キーが無いとき: 本番は NOT_CONFIGURED。dev は送らずにコンソールに本文を出して ok（確認用）
 * - Resend のエラーは握りつぶさず SEND_FAILED で返す（画面には Resend の文をそのまま出さない・ログには出す）
 */
export type SendMailInput = {
  to: string
  subject: string
  text: string
  html: string
}

export type SendMailResult =
  | { ok: true; id: string }
  | { ok: false; reason: "NOT_CONFIGURED" | "SEND_FAILED"; message: string }

export const MAIL_NOT_CONFIGURED_MESSAGE = "メールの送信が設定されていません（運営者に連絡してください）"
const MAIL_SEND_FAILED_MESSAGE = "メールを送れませんでした"

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const cfg = getMailConfig()

  if (!cfg.apiKey) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, reason: "NOT_CONFIGURED", message: MAIL_NOT_CONFIGURED_MESSAGE }
    }
    // dev: 送らずにコンソールへ（リンクを目で確かめるため・本番ではここに来ない）
    console.info(`[mail:dev] to=${input.to} subject=${input.subject}\n${input.text}`)
    return { ok: true, id: "dev-console" }
  }

  try {
    const resend = new Resend(cfg.apiKey)
    const { data, error } = await resend.emails.send({
      from: `${cfg.fromName} <${cfg.fromAddress}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    })
    if (error) {
      console.error("[mail] send failed:", error.name, error.message)
      return { ok: false, reason: "SEND_FAILED", message: MAIL_SEND_FAILED_MESSAGE }
    }
    return { ok: true, id: data?.id ?? "" }
  } catch (e) {
    console.error("[mail] send threw:", e instanceof Error ? e.message : e)
    return { ok: false, reason: "SEND_FAILED", message: MAIL_SEND_FAILED_MESSAGE }
  }
}
