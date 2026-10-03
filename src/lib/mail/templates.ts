/**
 * B-205 PR-3（P3-D16・§4-7）: 招待とパスワード再設定のメールの文面（純関数・テストあり）。
 * - 件名と本文はブリーフ §4-7 のとおり。テキストと、同じ内容の簡単な HTML
 * - 生のトークンはリンクにだけ入れる
 * - 期限は JST で「2026/10/06 11:00」の形
 */

export type MailContent = { subject: string; text: string; html: string }

/** JST で "YYYY/MM/DD HH:mm"（純関数） */
export function formatJstDateTime(d: Date): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ""
  // hour12:false でも環境により "24" が返ることがあるため 00 に寄せる
  const hour = get("hour") === "24" ? "00" : get("hour")
  return `${get("year")}/${get("month")}/${get("day")} ${hour}:${get("minute")}`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/** テキスト本文を <p> と <a> だけの HTML にする（空行で段落・URL はリンク） */
function textToHtml(text: string, link: string): string {
  const paragraphs = text.split(/\n\n+/).map((para) => {
    const lines = para.split("\n").map((line) => {
      const safe = escapeHtml(line)
      return line.trim() === link ? `<a href="${escapeHtml(link)}">${safe}</a>` : safe
    })
    return `<p>${lines.join("<br />")}</p>`
  })
  return paragraphs.join("\n")
}

export function buildInviteMail(args: {
  companyName: string
  inviteeName: string
  inviterName: string
  appBaseUrl: string
  token: string
  expiresAt: Date
}): MailContent {
  const link = `${args.appBaseUrl}/invite/${args.token}`
  const subject = `【PMS】${args.companyName} から招待が届いています`
  const text = [
    `${args.inviteeName} 様`,
    ``,
    `${args.inviterName} さんから、PMS（${args.companyName}）への招待が届いています。`,
    `次のリンクを開いて、パスワードを決めてください。`,
    ``,
    link,
    ``,
    `このリンクの有効期限は ${formatJstDateTime(args.expiresAt)} です。`,
    `期限が切れた場合は、招待した人に再送を頼んでください。`,
    ``,
    `このメールに心当たりがない場合は、何もせずに破棄してください。`,
    `※このアドレスは送信専用です。返信はできません。`,
  ].join("\n")
  return { subject, text, html: textToHtml(text, link) }
}

export function buildPasswordResetMail(args: {
  userName: string
  appBaseUrl: string
  token: string
  expiresAt: Date
}): MailContent {
  const link = `${args.appBaseUrl}/reset-password/${args.token}`
  const subject = `【PMS】パスワードの再設定`
  const text = [
    `${args.userName} 様`,
    ``,
    `パスワードの再設定を受け付けました。`,
    `次のリンクを開いて、新しいパスワードを決めてください。`,
    ``,
    link,
    ``,
    `このリンクの有効期限は ${formatJstDateTime(args.expiresAt)} です。`,
    ``,
    `再設定をしていない場合は、このメールを破棄してください。パスワードは変わりません。`,
    `※このアドレスは送信専用です。返信はできません。`,
  ].join("\n")
  return { subject, text, html: textToHtml(text, link) }
}
