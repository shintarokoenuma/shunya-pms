/**
 * B-202 PR-4（addendum v0.2 D-11）: CompanySetting を初めて作るときの既定値。
 * ★{} は未設定を意味する。将来この領域（採番ルール・メール・在庫警告・見積有効期限・自動化・AI・セキュリティ）を
 *   実装するときは {} を未設定として扱うこと。
 * - CompanySetting は休眠テーブル（2026-09-15 実測で 0 行）で、必須 Json 7本に @default が無いため、
 *   upsert の create 側でここから埋める。migration（@default('{}') の追加）は足さない（v0.2 D-11 で不採用）。
 * - Decimal / Int / enum / String の列は schema の @default に任せ、ここには書かない。
 */
export const COMPANY_SETTING_REQUIRED_JSON_DEFAULTS = {
  numberingRules: {},
  emailSettings: {},
  expiryWarningDays: {},
  quotationValidityDays: {},
  automationSettings: {},
  aiSettings: {},
  securitySettings: {},
} as const
