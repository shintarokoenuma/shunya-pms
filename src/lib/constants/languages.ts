import { Language } from "@prisma/client"

/**
 * 言語オプション（共通モジュール）
 *
 * Client / Supplier / Factory / Contractor で共通使用。
 *
 * Prisma の Language enum と一致させる（JA / EN / ZH / VI）。
 * 将来的に KO（韓国語）等を追加する場合は、
 * Phase 1A-9 候補として別マイグレーション + ここを更新。
 */

export const LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: "JA", label: "日本語" },
  { value: "EN", label: "英語" },
  { value: "ZH", label: "中国語" },
  { value: "VI", label: "ベトナム語" },
]

export const LANGUAGE_LABELS: Record<Language, string> = {
  JA: "日本語",
  EN: "英語",
  ZH: "中国語",
  VI: "ベトナム語",
}
