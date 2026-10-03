/**
 * B-205 PR-3: メールの設定の読み取り（P3-D2）と文面（§4-7）の純関数の検証（テストランナー非依存・DB 非接続・送信なし）。
 * 手動実行: `npx tsx src/lib/mail/mail.test.ts`
 */

import { MAIL_DEFAULTS, formatTtlMinutes, parsePositiveInt, readMailConfig, stripTrailingSlash } from "./config"
import { buildInviteMail, buildPasswordResetMail, formatJstDateTime } from "./templates"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

// ① 数値の環境変数: 数でない・0 以下・空は既定
{
  assert(parsePositiveInt("72", 1) === 72, "① 72")
  assert(parsePositiveInt(" 15 ", 1) === 15, "①' 前後の空白")
  assert(parsePositiveInt("0", 7) === 7, "①'' 0 は既定")
  assert(parsePositiveInt("-3", 7) === 7, "①''' 負は既定")
  assert(parsePositiveInt("abc", 7) === 7, "①-4 文字は既定")
  assert(parsePositiveInt("1.5", 7) === 7, "①-5 小数は既定")
  assert(parsePositiveInt("", 7) === 7 && parsePositiveInt(undefined, 7) === 7 && parsePositiveInt(null, 7) === 7, "①-6 空・未設定は既定")
}

// ② 設定の組み立て: 既定・上書き・本番の APP_BASE_URL
{
  const empty = readMailConfig({}, "development")
  assert(empty.apiKey === null, "② キー無しは null")
  assert(empty.fromAddress === MAIL_DEFAULTS.fromAddress && empty.fromName === MAIL_DEFAULTS.fromName, "②' 送信元の既定")
  assert(empty.inviteTtlHours === 72 && empty.passwordResetTtlMinutes === 60, "②'' 期限の既定")
  assert(empty.appBaseUrl === "http://localhost:3001", "②''' dev の APP_BASE_URL の既定")

  const prodEmpty = readMailConfig({}, "production")
  assert(prodEmpty.appBaseUrl === null, "②-4 本番で APP_BASE_URL が無ければ null")

  const set = readMailConfig(
    {
      RESEND_API_KEY: "re_x",
      MAIL_FROM_ADDRESS: "pms@example.com",
      MAIL_FROM_NAME: "PMS dev",
      INVITE_TOKEN_TTL_HOURS: "24",
      PASSWORD_RESET_TOKEN_TTL_MINUTES: "30",
      APP_BASE_URL: "https://example.com/",
    },
    "production",
  )
  assert(set.apiKey === "re_x" && set.fromAddress === "pms@example.com" && set.fromName === "PMS dev", "②-5 上書き")
  assert(set.inviteTtlHours === 24 && set.passwordResetTtlMinutes === 30, "②-6 期限の上書き")
  assert(set.appBaseUrl === "https://example.com", "②-7 末尾の / を取る")
  assert(stripTrailingSlash("http://a/b///") === "http://a/b", "②-8 stripTrailingSlash")
  assert(formatTtlMinutes(60) === "1時間" && formatTtlMinutes(120) === "2時間" && formatTtlMinutes(90) === "90分" && formatTtlMinutes(1) === "1分", "②-9 期限の文")
}

// ③ JST の日時
{
  // 2026-10-06T02:00:00Z = 2026/10/06 11:00 JST
  assert(formatJstDateTime(new Date("2026-10-06T02:00:00Z")) === "2026/10/06 11:00", "③ JST 変換")
  // 2026-10-05T15:00:00Z = 2026/10/06 00:00 JST
  assert(formatJstDateTime(new Date("2026-10-05T15:00:00Z")) === "2026/10/06 00:00", "③' 日付の繰り上がり・00時")
}

// ④ 招待メール: 件名・リンク・期限・生のトークンはリンクにだけ
{
  const token = "RAW-TOKEN-abc_123"
  const m = buildInviteMail({
    companyName: "shunya",
    inviteeName: "山田 太郎",
    inviterName: "肥沼 慎太郎",
    appBaseUrl: "http://localhost:3001",
    token,
    expiresAt: new Date("2026-10-06T02:00:00Z"),
  })
  assert(m.subject === "【PMS】shunya から招待が届いています", "④ 件名")
  assert(m.text.includes("山田 太郎 様"), "④' 宛名")
  assert(m.text.includes("肥沼 慎太郎 さんから、PMS（shunya）への招待が届いています。"), "④'' 本文1行目")
  assert(m.text.includes(`http://localhost:3001/invite/${token}`), "④''' リンク")
  assert(m.text.includes("このリンクの有効期限は 2026/10/06 11:00 です。"), "④-4 期限")
  assert(m.text.includes("※このアドレスは送信専用です。返信はできません。"), "④-5 末尾")
  assert(m.text.split(token).length - 1 === 1, "④-6 生のトークンは本文に1回（リンク）だけ")
  assert(m.html.includes(`<a href="http://localhost:3001/invite/${token}">`), "④-7 HTML のリンク")
  assert(m.html.split(token).length - 1 === 2, "④-8 HTML では href と表示の2回だけ")
  assert(!m.subject.includes(token), "④-9 件名にトークンが無い")
}

// ⑤ 再設定メール
{
  const token = "RESET-xyz"
  const m = buildPasswordResetMail({ userName: "Shin", appBaseUrl: "https://example.com", token, expiresAt: new Date("2026-10-03T03:30:00Z") })
  assert(m.subject === "【PMS】パスワードの再設定", "⑤ 件名")
  assert(m.text.includes("Shin 様") && m.text.includes("パスワードの再設定を受け付けました。"), "⑤' 本文")
  assert(m.text.includes(`https://example.com/reset-password/${token}`), "⑤'' リンク")
  assert(m.text.includes("このリンクの有効期限は 2026/10/03 12:30 です。"), "⑤''' 期限")
  assert(m.text.includes("再設定をしていない場合は、このメールを破棄してください。パスワードは変わりません。"), "⑤-4 注意書き")
  assert(m.text.split(token).length - 1 === 1, "⑤-5 生のトークンは本文に1回だけ")
  // HTML のエスケープ（名前に < が入っても壊れない）
  const esc = buildPasswordResetMail({ userName: "<b>", appBaseUrl: "https://example.com", token, expiresAt: new Date() })
  assert(esc.html.includes("&lt;b&gt; 様"), "⑤-6 HTML エスケープ")
}

console.log("mail.test.ts: all assertions passed")
