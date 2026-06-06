import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, Pencil } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getModelCode } from "@/lib/actions/model-codes"
import { ModelCodeActions } from "../_components/model-code-delete-button"
import {
  MODEL_CODE_STATUS_LABELS,
  MODEL_CODE_STATUS_BADGE_VARIANT,
  OWNERSHIP_TYPE_LABELS,
} from "../_components/labels"

type Params = Promise<{ id: string }>

function formatDecimal(value: unknown): string {
  if (value === null || value === undefined) return "—"
  const n =
    typeof value === "number"
      ? value
      : typeof value === "object" && value && "toNumber" in value
        ? (value as { toNumber: () => number }).toNumber()
        : Number(value)
  if (!Number.isFinite(n)) return "—"
  return n.toLocaleString("ja-JP", { maximumFractionDigits: 4 })
}

export default async function ModelCodeDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  // S-1（1A-12 撤去）: 型番は裏方化。MASTER_ADMIN 限定で温存（可逆）。
  if (session.user.tenantType !== "MASTER_ADMIN") redirect("/products")

  const { id } = await params
  const result = await getModelCode(id)
  if (!result.ok) {
    notFound()
  }
  const item = result.data

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { tenantType: true },
  })
  const isMasterAdmin = company?.tenantType === "MASTER_ADMIN"

  return (
    <div className="space-y-6 p-6">
      {/* ヘッダー */}
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/model-codes">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {item.modelName}
              </h1>
              <Badge variant={MODEL_CODE_STATUS_BADGE_VARIANT[item.status]}>
                {MODEL_CODE_STATUS_LABELS[item.status]}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono">{item.modelCode}</span>
              {item.modelNameEn && (
                <>
                  <span>·</span>
                  <span>{item.modelNameEn}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/model-codes/${id}/edit`}>
                <Pencil className="mr-1 h-4 w-4" />
                編集
              </Link>
            </Button>
            <ModelCodeActions
              id={item.id}
              modelName={item.modelName}
              status={item.status}
              isMasterAdmin={isMasterAdmin}
            />
          </div>
        </div>
      </div>

      {/* 基本情報 + 関連ブランド */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本情報</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="モデルコード" value={<span className="font-mono">{item.modelCode}</span>} />
            <DetailRow label="モデル名" value={item.modelName} />
            <DetailRow label="モデル名（英語）" value={item.modelNameEn ?? "—"} />
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
            <CardTitle className="text-base">関連ブランド</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {item.brand ? (
              <>
                <div className="inline-flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {item.brand.brandCode}
                  </span>
                  <span className="font-medium">{item.brand.brandName}</span>
                </div>
                {item.brand.client && (
                  <div className="text-sm text-muted-foreground">
                    クライアント:{" "}
                    <Link
                      href={`/clients/${item.brand.client.id}`}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      <span className="font-mono text-xs">
                        {item.brand.client.clientCode}
                      </span>
                      <span>{item.brand.client.companyName}</span>
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                ブランド情報が取得できませんでした
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 商品分類 + 所有権 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">商品分類</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow
              label="商品カテゴリ"
              value={
                <span className="text-muted-foreground">
                  （商品カテゴリマスター未実装）
                </span>
              }
            />
            <DetailRow label="シルエット" value={item.silhouette ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">所有権</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow
              label="パターン所有権"
              value={OWNERSHIP_TYPE_LABELS[item.patternOwnership]}
            />
            <DetailRow
              label="デザイン所有権"
              value={OWNERSHIP_TYPE_LABELS[item.designOwnership]}
            />
          </CardContent>
        </Card>
      </div>

      {/* 累積データ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">累積データ</CardTitle>
          <CardDescription>
            ※ このセクションは Product / PatternVersion / DesignVersion
            が実装された段階で自動更新されます（Phase 1B 以降）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <DetailRow
              label="リピート回数"
              value={`${item.totalRepetitions} 回`}
            />
            <DetailRow
              label="累計生産数"
              value={`${item.totalProductionQty.toLocaleString("ja-JP")} 点`}
            />
            <DetailRow label="累計売上" value={formatDecimal(item.totalRevenue)} />
            <DetailRow
              label="累計パターンコスト"
              value={formatDecimal(item.totalPatternCost)}
            />
            <DetailRow
              label="累計デザインコスト"
              value={formatDecimal(item.totalDesignCost)}
            />
            <DetailRow label="単位コスト" value={formatDecimal(item.costPerUnit)} />
          </div>
        </CardContent>
      </Card>

      {/* 保有資産 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">保有資産</CardTitle>
          <CardDescription>
            ※ このセクションは Product / PatternVersion / DesignVersion
            が実装された段階で自動更新されます（Phase 1B 以降）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <DetailRow
              label="パターン保有"
              value={item.hasPattern ? "あり" : "なし"}
            />
            <DetailRow
              label="グレーディング保有"
              value={item.hasGrading ? "あり" : "なし"}
            />
            <DetailRow
              label="デザイン保有"
              value={item.hasDesign ? "あり" : "なし"}
            />
            <DetailRow
              label="最新使用品番"
              value={item.latestProductId ?? "—"}
            />
          </div>
        </CardContent>
      </Card>

      {/* 関連品番（Product）プレースホルダ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">関連品番（Product）</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Phase 1B 以降に Product 一覧を表示予定（シーズン降順、テーブル形式）
          </p>
        </CardContent>
      </Card>

      {/* リピート系譜プレースホルダ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">リピート系譜</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Phase 1B 以降に親子関係の樹形図を表示予定
          </p>
        </CardContent>
      </Card>

      {/* メタ情報 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">メタ情報</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow
            label="初回作成"
            value={new Date(item.firstCreatedAt).toLocaleString("ja-JP")}
          />
          <DetailRow
            label="最終使用"
            value={
              item.lastUsedAt
                ? new Date(item.lastUsedAt).toLocaleString("ja-JP")
                : "—"
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
