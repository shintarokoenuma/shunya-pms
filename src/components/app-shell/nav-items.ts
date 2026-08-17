import {
  Building2,
  Calculator,
  ClipboardCheck,
  Coins,
  Factory,
  FolderTree,
  Hammer,
  Hash,
  Layers,
  Palette,
  Scissors,
  Shapes,
  Shirt,
  Sparkles,
  LayoutDashboard,
  MessageSquare,
  Package,
  Receipt,
  MapPin,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Truck,
  UserCog,
  type LucideIcon,
} from "lucide-react"
import type { SectionAccentKey } from "@/lib/constants/section-accents"

export type NavItem = {
  label: string
  href: string
  icon?: LucideIcon
  /** false の場合グレーアウト（後続フェーズで有効化） */
  enabled: boolean
  /**
   * true の場合、前面ナビから完全に下げる（描画しない）。
   * enabled=false（グレーアウト表示）との違いに注意。S-1 の 1A-12 撤去で
   * 型番（ModelCode）を裏方化するために導入。元に戻すには hidden を外すだけ（可逆）。
   */
  hidden?: boolean
}

export type NavSection = {
  label?: string
  /** B-078-3: セクション別アクセント（見出し色）。 */
  accent?: SectionAccentKey
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        label: "ダッシュボード",
        href: "/dashboard",
        icon: LayoutDashboard,
        enabled: true,
      },
    ],
  },
  {
    label: "案件",
    accent: "project",
    items: [
      { label: "品番カルテ", href: "/products", icon: Package, enabled: true },
      { label: "サンプル製作", href: "/samples", icon: Shirt, enabled: true },
      { label: "SKU", href: "/skus", icon: Layers, enabled: false },
    ],
  },
  {
    label: "取引",
    accent: "trade",
    items: [
      { label: "見積もり", href: "/quotations", icon: Calculator, enabled: true },
      { label: "発注（仕入 PO）", href: "/purchase-orders", icon: ShoppingCart, enabled: true },
      { label: "発注（作業 WO）", href: "/work-orders", icon: Hammer, enabled: true },
      { label: "受注", href: "/sales-orders", icon: ClipboardCheck, enabled: true },
      // B-108: 納品書（DLV）を有効化。請求（INV）は B-109 で別項目として追加する
      // （sidebar-ui-design-2026-05-27 は 納品/請求 を別項目として設計）。
      { label: "納品", href: "/deliveries", icon: Receipt, enabled: true },
    ],
  },
  {
    label: "マスター",
    accent: "master",
    items: [
      { label: "クライアント", href: "/clients", icon: Building2, enabled: true },
      { label: "ブランド", href: "/brands", icon: Tag, enabled: true },
      { label: "仕入先", href: "/suppliers", icon: Truck, enabled: true },
      { label: "工場", href: "/factories", icon: Factory, enabled: true },
      { label: "外注先", href: "/contractors", icon: UserCog, enabled: true },
      { label: "バイヤー", href: "/buyers", icon: ShoppingBag, enabled: true },
      { label: "納品先", href: "/delivery-destinations", icon: MapPin, enabled: true },
      // S-1（1A-12 撤去）: 型番は Product 作成時に裏側で自動発番する方式へ移行。
      // 手動採番の前面導線は下げる。ページ/アクションは温存し MASTER_ADMIN のみ直URLで到達可。
      // 完全削除は本番安定後に B 枠で別タスク。hidden を外せば元に戻る（可逆）。
      { label: "型番", href: "/model-codes", icon: Hash, enabled: true, hidden: true },
      { label: "素材", href: "/materials", icon: Scissors, enabled: true },
      { label: "素材カテゴリ", href: "/material-categories", icon: FolderTree, enabled: true },
      { label: "カラー", href: "/colors", icon: Palette, enabled: true },
      { label: "柄種別", href: "/textile-pattern-types", icon: Shapes, enabled: true },
      { label: "柄マスター", href: "/textile-patterns", icon: Shapes, enabled: true },
      { label: "商品カテゴリ", href: "/product-categories", icon: FolderTree, enabled: true },
      { label: "加工種別", href: "/processing-types", icon: Sparkles, enabled: true },
      { label: "原価費目", href: "/cost-categories", icon: Coins, enabled: true },
      {
        label: "Inquiry（営業先DB）",
        href: "/inquiries",
        icon: MessageSquare,
        enabled: false,
      },
    ],
  },
  {
    items: [
      { label: "設定", href: "/settings", icon: Settings, enabled: false },
    ],
  },
]
