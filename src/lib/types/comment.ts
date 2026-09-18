/**
 * B-202 PR-3: 品番カルテ メモ（Comment）の共有型（中立モジュール・"use server"/prisma 非依存）。
 * client component が "use server" の actions ファイルから型を import すると
 * ブラウザバンドルに @prisma/client が漏れるため、型はここに置いて decouple する（product-sketch.ts と同形）。
 */

/** listProductComments の戻り（表示用・書いた人の名前は解決済み）。 */
export type CommentView = {
  id: string
  content: string
  authorUserId: string
  authorName: string
  createdAt: string // ISO 文字列（Server → Client の直列化のため Date にしない）
  isEdited: boolean
  /** 自分のメモか（編集・削除の表示に使う。権限の最終判定は action 側で行う） */
  canEdit: boolean
}
