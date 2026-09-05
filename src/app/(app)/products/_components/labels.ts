import { ProductStatus } from "@prisma/client"
import {
  Lightbulb,
  Inbox,
  Scissors,
  CircleCheck,
  CalendarClock,
  ClipboardCheck,
  Factory,
  Search,
  Truck,
  CheckCheck,
  Ban,
  Pause,
  Archive,
  type LucideIcon,
} from "lucide-react"

/**
 * S-1: 品番カルテ（Product）ラベル定義
 *
 * - shunya-master-patterns.md v1.2 §4 の命名規約に従う
 * - ProductStatus は 13 値（PLANNING 〜 ARCHIVED）。仕様書 F-3 の A〜D 表示パターンに対応
 * - S-1 ではサンプル系（PLANNING / SAMPLE_*）を主に扱うが、量産系も「箱」として選択可能にする
 * - ARCHIVED はステータス Select には出さない（archive/restore はアクションボタンで操作）
 */

// =============================================================================
// ステータス：日本語ラベル
// =============================================================================
export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  PLANNING: "企画中",
  SAMPLE_REQUESTED: "サンプル依頼受付",
  SAMPLE_IN_PROGRESS: "サンプル製作中",
  SAMPLE_APPROVED: "サンプル承認済",
  ORDERING_PERIOD: "受注期間中",
  ORDER_CONFIRMED: "受注確定",
  MASS_PRODUCTION: "量産中",
  INSPECTION: "検品中",
  DELIVERED: "納品済",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
  ON_HOLD: "保留中",
  ARCHIVED: "アーカイブ",
}

// =============================================================================
// B-091 P-8: ステータスの「形」アイコン（色に依存せず区別する）
// 各ステータスに一意のシルエットの lucide アイコンを与える。色（badge variant）は補助であり、
// グレースケールでもアイコン＋ラベルで13値すべてが互いに区別できる。
// ★テキスト記号はフォント依存で Windows で豆腐になりうるため SVG（lucide）にする（B-187 の学び）。
// ★色トークン（globals.css）には手を付けない。色の体系は B-188。
// =============================================================================
export const PRODUCT_STATUS_ICON: Record<ProductStatus, LucideIcon> = {
  PLANNING: Lightbulb, // 企画中
  SAMPLE_REQUESTED: Inbox, // 依頼受付
  SAMPLE_IN_PROGRESS: Scissors, // 製作中
  SAMPLE_APPROVED: CircleCheck, // 承認
  ORDERING_PERIOD: CalendarClock, // 受注期間
  ORDER_CONFIRMED: ClipboardCheck, // 受注確定
  MASS_PRODUCTION: Factory, // 量産中
  INSPECTION: Search, // 検品中
  DELIVERED: Truck, // 納品済
  COMPLETED: CheckCheck, // 完了
  CANCELLED: Ban, // キャンセル
  ON_HOLD: Pause, // 保留
  ARCHIVED: Archive, // アーカイブ
}

// =============================================================================
// ステータス：バッジ variant（master-patterns §4 統一色の考え方を踏襲）
// =============================================================================
export const PRODUCT_STATUS_BADGE_VARIANT: Record<
  ProductStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PLANNING: "outline",
  SAMPLE_REQUESTED: "outline",
  SAMPLE_IN_PROGRESS: "default",
  SAMPLE_APPROVED: "default",
  ORDERING_PERIOD: "default",
  ORDER_CONFIRMED: "default",
  MASS_PRODUCTION: "default",
  INSPECTION: "default",
  DELIVERED: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
  ON_HOLD: "outline",
  ARCHIVED: "secondary",
}

// =============================================================================
// ステータス：フォーム Select 用（ARCHIVED は除外＝archive ボタンで操作）
// =============================================================================
export const PRODUCT_STATUS_OPTIONS: {
  value: ProductStatus
  label: string
}[] = (
  [
    "PLANNING",
    "SAMPLE_REQUESTED",
    "SAMPLE_IN_PROGRESS",
    "SAMPLE_APPROVED",
    "ORDERING_PERIOD",
    "ORDER_CONFIRMED",
    "MASS_PRODUCTION",
    "INSPECTION",
    "DELIVERED",
    "COMPLETED",
    "ON_HOLD",
    "CANCELLED",
  ] as const
).map((value) => ({ value, label: PRODUCT_STATUS_LABELS[value] }))

// =============================================================================
// 検索フィルタ用（全ステータス、ARCHIVED 含む）
// =============================================================================
export const PRODUCT_STATUS_FILTER_OPTIONS: {
  value: ProductStatus
  label: string
}[] = (Object.keys(PRODUCT_STATUS_LABELS) as ProductStatus[]).map((value) => ({
  value,
  label: PRODUCT_STATUS_LABELS[value],
}))
