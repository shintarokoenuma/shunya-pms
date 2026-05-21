import { Currency } from "@prisma/client"

/**
 * 通貨オプション（共通モジュール）
 *
 * Client / Supplier / Factory / Contractor で共通使用。
 *
 * Prisma の Currency enum と一致させる（JPY / USD / CNY / VND / EUR）。
 * 将来的に KRW / THB / INR / TRY / GBP 等を追加する場合は、
 * Phase 1A-9 候補として別マイグレーション + ここを更新。
 */

export const CURRENCY_OPTIONS: Array<{ value: Currency; label: string }> = [
  { value: "JPY", label: "JPY（日本円）" },
  { value: "USD", label: "USD（米ドル）" },
  { value: "EUR", label: "EUR（ユーロ）" },
  { value: "CNY", label: "CNY（人民元）" },
  { value: "VND", label: "VND（ベトナムドン）" },
]
