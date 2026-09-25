import Link from "next/link"
import { ChevronRight, ImageOff, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ProductListItem } from "@/lib/actions/products"
import {
  primaryProductCode,
  secondaryProductCode,
} from "@/lib/utils/product-code"
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_BADGE_VARIANT,
  PRODUCT_STATUS_ICON,
} from "./labels"

type Props = {
  items: ProductListItem[]
}

/**
 * B-191 P-5: 社内品番の文字列と「現在の属性」の食い違い判定。
 * productCode の採番規則は `{brandCode}-{season}-{categoryCode}-{連番3桁}`（すべて大文字・
 * src/lib/actions/products.ts:166）。categoryCode はハイフンを含みうる（本番 M-TS 等）ため、
 * split では位置決めできない。現在の属性から採番プレフィクスを再構成し、前方一致で照合する。
 * ★ブランド・カテゴリのどちらかが欠けると判定できないので、その行はバッジを出さない
 *   （無関係な行に誤って出さないことを優先する）。
 */
function isClassificationMismatch(item: ProductListItem): boolean {
  if (!item.brand || !item.category) return false
  const expectedPrefix =
    `${item.brand.brandCode}-${item.season}-${item.category.categoryCode}-`.toUpperCase()
  return !item.productCode.toUpperCase().startsWith(expectedPrefix)
}

// ---------------------------------------------------------------------------
// B-093 PR-2: カード（768px 未満）と表（768px 以上）で共用する部品。
// 判定（不一致・品番の表記・状態）は 1 箇所で計算し、二重に書かない（ブリーフ §2）。
// ---------------------------------------------------------------------------

function rowData(item: ProductListItem) {
  return {
    primary: primaryProductCode(item),
    secondary: secondaryProductCode(item),
    mismatch: isClassificationMismatch(item),
    StatusIcon: PRODUCT_STATUS_ICON[item.status],
    quantityLabel:
      item.productionQuantity > 0
        ? item.productionQuantity.toLocaleString("ja-JP")
        : "—",
  }
}

/** 絵型サムネ。★img に shrink-0 / max-w-none を付け、preflight の max-width:100% でセル幅まで縮まないようにする（ブリーフ §0・D-3）。 */
function SketchThumb({ url, sizeClass }: { url?: string; sizeClass: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={`${sizeClass} shrink-0 max-w-none rounded border object-cover`}
      />
    )
  }
  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded border border-dashed text-muted-foreground`}
    >
      <ImageOff className="h-6 w-6" />
    </div>
  )
}

function MismatchBadge() {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded border border-amber-400 px-1 text-[10px] text-amber-700"
      title="社内品番の文字列が、現在のブランド／シーズン／カテゴリと一致しません（採番後に分類を変更した可能性）"
    >
      <AlertTriangle className="h-3 w-3" />
      品番と不一致
    </span>
  )
}

/** 2段目（ブランド／シーズン／カテゴリ・小さめ）。カードと表で同じ。 */
function ClassificationLine({
  item,
  mismatch,
}: {
  item: ProductListItem
  mismatch: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      <span>
        ブランド:{" "}
        {item.brand ? (
          <>
            <span className="font-mono">{item.brand.brandCode}</span>{" "}
            {item.brand.brandName}
          </>
        ) : (
          "—"
        )}
      </span>
      <span>シーズン: {item.season}</span>
      <span className="inline-flex items-center gap-1">
        カテゴリ: {item.category ? item.category.categoryName : "—"}
        {mismatch && <MismatchBadge />}
      </span>
    </div>
  )
}

export function ProductsTable({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        品番カルテがありません
      </div>
    )
  }

  return (
    <>
      {/* B-093 PR-2（D-1・D-2）: 768px 未満はカード。カード全体が品番カルテへのリンク */}
      <ul className="space-y-2 md:hidden">
        {items.map((item) => {
          const r = rowData(item)
          return (
            <li key={item.id}>
              <Link
                href={`/products/${item.id}`}
                className="flex gap-3 rounded-md border bg-card p-3 transition-colors hover:bg-accent/50"
              >
                <SketchThumb url={item.sketchThumbUrl} sizeClass="h-20 w-20" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="font-medium leading-snug">{item.productName}</div>
                  <div className="font-mono text-sm">{r.primary}</div>
                  {r.secondary && (
                    <div className="font-mono text-xs text-muted-foreground">
                      社内: {r.secondary}
                    </div>
                  )}
                  {item.productNameEn && (
                    <div className="text-xs text-muted-foreground">{item.productNameEn}</div>
                  )}
                  <ClassificationLine item={item} mismatch={r.mismatch} />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                    <Badge variant={PRODUCT_STATUS_BADGE_VARIANT[item.status]}>
                      <r.StatusIcon aria-hidden className="mr-1 h-3 w-3" />
                      {PRODUCT_STATUS_LABELS[item.status]}
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      量産数: {r.quantityLabel}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground" />
              </Link>
            </li>
          )
        })}
      </ul>

      {/* 768px 以上は従来の表。絵型は縮まない（D-3）・品名列に最小幅 */}
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[112px]">絵型</TableHead>
              <TableHead className="min-w-[12rem]">品名 / 品番 ／ 分類</TableHead>
              <TableHead className="w-[140px]">ステータス</TableHead>
              <TableHead className="w-[90px] text-right">量産数</TableHead>
              <TableHead className="w-[72px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const r = rowData(item)
              return (
                <TableRow key={item.id}>
                  {/* 絵型（メイン・大） */}
                  <TableCell>
                    <SketchThumb url={item.sketchThumbUrl} sizeClass="h-24 w-24" />
                  </TableCell>

                  {/* 情報（2段構成）: 1段目=品名・品番、2段目=ブランド/シーズン/カテゴリ */}
                  <TableCell className="min-w-[12rem] align-top">
                    <div className="space-y-1">
                      {/* 1段目 */}
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <span className="font-medium">{item.productName}</span>
                        <span className="font-mono text-sm">{r.primary}</span>
                        {r.secondary && (
                          <span className="font-mono text-xs text-muted-foreground">
                            社内: {r.secondary}
                          </span>
                        )}
                      </div>
                      {item.productNameEn && (
                        <div className="text-xs text-muted-foreground">
                          {item.productNameEn}
                        </div>
                      )}
                      {/* 2段目（分類・小さめ） */}
                      <ClassificationLine item={item} mismatch={r.mismatch} />
                    </div>
                  </TableCell>

                  {/* ステータス（形マーカー＋ラベル・色に依存しない） */}
                  <TableCell className="align-top">
                    <Badge variant={PRODUCT_STATUS_BADGE_VARIANT[item.status]}>
                      <r.StatusIcon aria-hidden className="mr-1 h-3 w-3" />
                      {PRODUCT_STATUS_LABELS[item.status]}
                    </Badge>
                  </TableCell>

                  {/* 量産数（SO 由来・0 は「—」） */}
                  <TableCell className="text-right align-top tabular-nums">
                    {r.quantityLabel}
                  </TableCell>

                  <TableCell className="align-top">
                    <Link
                      href={`/products/${item.id}`}
                      className="inline-flex items-center text-sm text-primary hover:underline"
                    >
                      詳細
                      <ChevronRight className="ml-0.5 h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
