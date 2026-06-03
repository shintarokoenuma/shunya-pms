import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, Pencil } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getProduct } from "@/lib/actions/products"
import { ProductActions } from "../_components/product-delete-button"
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_BADGE_VARIANT,
} from "../_components/labels"

type Params = Promise<{ id: string }>

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function ProductDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const companyId = session.user.companyId
  if (!companyId) redirect("/login")

  const { id } = await params
  const result = await getProduct(id)
  if (!result.ok) notFound()
  const product = result.data

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { tenantType: true },
  })
  const isMasterAdmin = company?.tenantType === "MASTER_ADMIN"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/products">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧へ戻る
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/products/${product.id}/edit`}>
              <Pencil className="mr-1 h-4 w-4" />
              編集
            </Link>
          </Button>
          <ProductActions
            id={product.id}
            productCode={product.productCode}
            productName={product.productName}
            status={product.status}
            isMasterAdmin={isMasterAdmin}
            variant="menu"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <h1 className="text-2xl font-bold">{product.productName}</h1>
          <Badge variant={PRODUCT_STATUS_BADGE_VARIANT[product.status]}>
            {PRODUCT_STATUS_LABELS[product.status]}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground font-mono">
          {product.productCode}
          {product.clientProductCode && (
            <span className="ml-3">
              <span className="font-sans text-xs">先方品番:</span>{" "}
              {product.clientProductCode}
            </span>
          )}
        </div>
      </div>

      {/* ───────── 基本情報 ───────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="社内品番" value={product.productCode} mono />
          <Row
            label="先方品番"
            value={product.clientProductCode ?? "—"}
            mono={!!product.clientProductCode}
          />
          <Row label="商品名" value={product.productName} />
          <Row label="商品名（英語）" value={product.productNameEn ?? "—"} />
          <Row
            label="説明"
            value={
              product.description ? (
                <p className="whitespace-pre-wrap">{product.description}</p>
              ) : (
                "—"
              )
            }
          />
        </CardContent>
      </Card>

      {/* ───────── 関連エンティティ ───────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">関連エンティティ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row
            label="ブランド"
            value={
              product.brand ? (
                <span>
                  <span className="font-mono text-xs text-muted-foreground mr-2">
                    {product.brand.brandCode}
                  </span>
                  {product.brand.brandName}
                </span>
              ) : (
                "—"
              )
            }
          />
          <Row
            label="クライアント"
            value={
              product.client ? (
                <Link
                  href={`/clients/${product.client.id}`}
                  className="hover:underline"
                >
                  <span className="font-mono text-xs text-muted-foreground mr-2">
                    {product.client.clientCode}
                  </span>
                  {product.client.companyName}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <Row
            label="商品カテゴリ"
            value={
              product.category ? (
                <span>
                  <span className="font-mono text-xs text-muted-foreground mr-2">
                    {product.category.categoryCode}
                  </span>
                  {product.category.categoryName}
                </span>
              ) : (
                "—"
              )
            }
          />
          <Row
            label="モデルコード"
            value={
              product.modelCode ? (
                <Link
                  href={`/model-codes/${product.modelCode.id}`}
                  className="hover:underline"
                >
                  <span className="font-mono text-xs text-muted-foreground mr-2">
                    {product.modelCode.modelCode}
                  </span>
                  {product.modelCode.modelName}
                </Link>
              ) : (
                "—"
              )
            }
          />
        </CardContent>
      </Card>

      {/* ───────── シーズン ───────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">シーズン</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="シーズン" value={product.season} mono />
          <Row label="年度" value={String(product.year)} mono />
        </CardContent>
      </Card>

      {/* ───────── ステータス履歴 ───────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            ステータス履歴（{product.statusHistory.length} 件）
          </CardTitle>
        </CardHeader>
        <CardContent>
          {product.statusHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">履歴がありません</p>
          ) : (
            <ol className="space-y-3">
              {product.statusHistory.map((h) => (
                <li
                  key={h.id}
                  className="border-l-2 border-muted pl-3 py-1 space-y-1"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {h.fromStatus && (
                      <>
                        <Badge
                          variant={PRODUCT_STATUS_BADGE_VARIANT[h.fromStatus]}
                          className="text-xs"
                        >
                          {PRODUCT_STATUS_LABELS[h.fromStatus]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">→</span>
                      </>
                    )}
                    <Badge
                      variant={PRODUCT_STATUS_BADGE_VARIANT[h.toStatus]}
                      className="text-xs"
                    >
                      {PRODUCT_STATUS_LABELS[h.toStatus]}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDateTime(h.changedAt)}
                    </span>
                  </div>
                  {(h.changedByUserName || h.changeReason) && (
                    <div className="text-xs text-muted-foreground">
                      {h.changedByUserName && (
                        <span>by {h.changedByUserName}</span>
                      )}
                      {h.changedByUserName && h.changeReason && (
                        <span> · </span>
                      )}
                      {h.changeReason && <span>{h.changeReason}</span>}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* ───────── 後続フェーズで追加 ───────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">後続フェーズで追加予定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>・ SKU マトリクス（カラー × サイズ）→ S-2 以降</p>
          <p>・ サンプル製作セット（SampleProduction）→ S-2</p>
          <p>・ 発注（WO/PO）連携 → S-4</p>
          <p>・ 進行チェックリスト → S-3</p>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3">
      <div className="text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono" : ""}>{value}</div>
    </div>
  )
}
