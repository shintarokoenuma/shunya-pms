/**
 * チャットツールプリセット（共通モジュール）
 *
 * 海外取引先・工場とのコミュニケーション用ツール。
 * Supplier / Factory / Contractor で共通使用。
 */

export const CHAT_TOOL_PRESETS = [
  "WeChat",
  "LINE",
  "Zalo",
  "WhatsApp",
  "KakaoTalk",
  "Telegram",
  "Signal",
  "Other",
] as const

export type ChatToolPreset = (typeof CHAT_TOOL_PRESETS)[number]
