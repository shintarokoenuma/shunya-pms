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

export function ProductsTable({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        品番カルテがありません
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[112px]">絵型</TableHead>
            <TableHead>品名 / 品番 ／ 分類</TableHead>
            <TableHead className="w-[140px]">ステータス</TableHead>
            <TableHead className="w-[90px] text-right">量産数</TableHead>
            <TableHead className="w-[72px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const primary = primaryProductCode(item)
            const secondary = secondaryProductCode(item)
            const mismatch = isClassificationMismatch(item)
            const StatusIcon = PRODUCT_STATUS_ICON[item.status]
            return (
              <TableRow key={item.id}>
                {/* 絵型（メイン・大） */}
                <TableCell>
                  {item.sketchThumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.sketchThumbUrl}
                      alt=""
                      className="h-24 w-24 rounded border object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded border border-dashed text-muted-foreground">
                      <ImageOff className="h-6 w-6" />
                    </div>
                  )}
                </TableCell>

                {/* 情報（2段構成）: 1段目=品名・品番、2段目=ブランド/シーズン/カテゴリ */}
                <TableCell className="align-top">
                  <div className="space-y-1">
                    {/* 1段目 */}
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className="font-medium">{item.productName}</span>
                      <span className="font-mono text-sm">{primary}</span>
                      {secondary && (
                        <span className="font-mono text-xs text-muted-foreground">
                          社内: {secondary}
                        </span>
                      )}
                    </div>
                    {item.productNameEn && (
                      <div className="text-xs text-muted-foreground">
                        {item.productNameEn}
                      </div>
                    )}
                    {/* 2段目（分類・小さめ） */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>
                        ブランド:{" "}
                        {item.brand ? (
                          <>
                            <span className="font-mono">
                              {item.brand.brandCode}
                            </span>{" "}
                            {item.brand.brandName}
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                      <span>シーズン: {item.season}</span>
                      <span className="inline-flex items-center gap-1">
                        カテゴリ: {item.category ? item.category.categoryName : "—"}
                        {mismatch && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded border border-amber-400 px-1 text-[10px] text-amber-700"
                            title="社内品番の文字列が、現在のブランド／シーズン／カテゴリと一致しません（採番後に分類を変更した可能性）"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            品番と不一致
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </TableCell>

                {/* ステータス（形マーカー＋ラベル・色に依存しない） */}
                <TableCell className="align-top">
                  <Badge variant={PRODUCT_STATUS_BADGE_VARIANT[item.status]}>
                    <StatusIcon aria-hidden className="mr-1 h-3 w-3" />
                    {PRODUCT_STATUS_LABELS[item.status]}
                  </Badge>
                </TableCell>

                {/* 量産数（SO 由来・0 は「—」） */}
                <TableCell className="text-right align-top tabular-nums">
                  {item.productionQuantity > 0
                    ? item.productionQuantity.toLocaleString("ja-JP")
                    : "—"}
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
  )
}
