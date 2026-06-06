import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, Pencil } from "lucide-react"
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getProduct } from "@/lib/actions/products"
import {
  primaryProductCode,
  secondaryProductCode,
  isClientCodePrimary,
} from "@/lib/utils/product-code"
import { ProductActions } from "../_components/product-delete-button"
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_BADGE_VARIANT,
} from "../_components/labels"

type Params = Promise<{ id: string }>

export default async function ProductDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const result = await getProduct(id)
  if (!result.ok) {
    notFound()
  }
  const item = result.data
  const isMasterAdmin = session.user.tenantType === "MASTER_ADMIN"

  const primary = primaryProductCode(item)
  const secondary = secondaryProductCode(item)
  const clientPrimary = isClientCodePrimary(item)

  return (
    <div className="space-y-6 p-6">
      {/* ヘッダー */}
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/products">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {item.productName}
              </h1>
              <Badge variant={PRODUCT_STATUS_BADGE_VARIANT[item.status]}>
                {PRODUCT_STATUS_LABELS[item.status]}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono">{primary}</span>
              {secondary && (
                <>
                  <span>·</span>
                  <span className="font-mono">社内: {secondary}</span>
                </>
              )}
              {clientPrimary && (
                <Badge variant="outline" className="text-xs">
                  先方品番
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/products/${id}/edit`}>
                <Pencil className="mr-1 h-4 w-4" />
                編集
              </Link>
            </Button>
            <ProductActions
              id={item.id}
              productName={item.productName}
              status={item.status}
              isMasterAdmin={isMasterAdmin}
            />
          </div>
        </div>
      </div>

      {/* 基本情報 + 品番・分類 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本情報</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="品名" value={item.productName} />
            <DetailRow label="品名（英語）" value={item.productNameEn ?? "—"} />
            <DetailRow label="シルエット" value={item.silhouette ?? "—"} />
            <DetailRow
              label="説明"
              value={
                item.description ? (
                  <p className="whitespace-pre-wrap">{item.description}</p>
                ) : (
                  "—"
                )
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">品番・分類</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow
              label="社内品番"
              value={<span className="font-mono">{item.productCode}</span>}
            />
            <DetailRow
              label="先方品番"
              value={
                item.clientProductCode ? (
                  <span className="font-mono">{item.clientProductCode}</span>
                ) : (
                  "—"
                )
              }
            />
            <DetailRow
              label="ブランド"
              value={
                item.brand ? (
                  <span>
                    <span className="font-mono text-xs text-muted-foreground mr-1">
                      {item.brand.brandCode}
                    </span>
                    {item.brand.brandName}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <DetailRow
              label="クライアント"
              value={
                item.brand?.client ? (
                  <Link
                    href={`/clients/${item.brand.client.id}`}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.brand.client.clientCode}
                    </span>
                    <span>{item.brand.client.companyName}</span>
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <DetailRow
              label="商品カテゴリ"
              value={
                item.category ? (
                  <span>
                    <span className="font-mono text-xs text-muted-foreground mr-1">
                      {item.category.categoryCode}
                    </span>
                    {item.category.categoryName}
                  </span>
                ) : (
                  "—"
                )
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* シーズン + 数量・納期 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">シーズン</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="シーズン" value={item.season} />
            <DetailRow label="年度" value={String(item.year)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">数量・納期</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow
              label="想定数量"
              value={
                item.expectedQuantity != null
                  ? `${item.expectedQuantity.toLocaleString("ja-JP")} 点`
                  : "—"
              }
            />
            <DetailRow
              label="希望納期"
              value={
                item.desiredDeliveryDate
                  ? new Date(item.desiredDeliveryDate).toLocaleDateString("ja-JP")
                  : "—"
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* ステータス履歴 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ステータス履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {item.statusHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">履歴がありません</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {item.statusHistory.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-b-0 last:pb-0"
                >
                  <span className="text-muted-foreground">
                    {new Date(h.changedAt).toLocaleString("ja-JP")}
                  </span>
                  <span>
                    {h.fromStatus
                      ? PRODUCT_STATUS_LABELS[h.fromStatus]
                      : "（新規）"}
                    {" → "}
                    <Badge
                      variant={PRODUCT_STATUS_BADGE_VARIANT[h.toStatus]}
                      className="ml-1"
                    >
                      {PRODUCT_STATUS_LABELS[h.toStatus]}
                    </Badge>
                  </span>
                  {h.changeReason && (
                    <span className="text-muted-foreground">
                      （{h.changeReason}）
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* メタ情報 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">メタ情報</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow
            label="社内メモ"
            value={
              item.internalNotes ? (
                <p className="whitespace-pre-wrap">{item.internalNotes}</p>
              ) : (
                "—"
              )
            }
          />
          <DetailRow
            label="作成日時"
            value={new Date(item.createdAt).toLocaleString("ja-JP")}
          />
          <DetailRow
            label="最終更新"
            value={new Date(item.updatedAt).toLocaleString("ja-JP")}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 text-sm py-1">
      <div className="text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  )
}
