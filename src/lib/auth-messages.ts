/**
 * B-205 PR-3（§4-5・§4-6）: 招待・パスワード再設定の画面の文言。
 * "use server" のファイルは async 関数以外の値を export できないので、action とページ・フォームの両方がここから読む。
 */
export const INVITE_EXPIRED_MESSAGE = "この招待リンクの有効期限が切れています。招待した人に再送を頼んでください。"
export const INVITE_INVALID_MESSAGE = "この招待リンクは使えません。"

export const RESET_EXPIRED_MESSAGE = "この再設定リンクの有効期限が切れています。もう一度、再設定のメールを送ってください。"
export const RESET_INVALID_MESSAGE = "この再設定リンクは使えません。"
