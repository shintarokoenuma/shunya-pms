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
import { getMaterial } from "@/lib/actions/materials"
import { MaterialActions } from "../_components/material-delete-button"
import {
  MATERIAL_STATUS_LABELS,
  MATERIAL_STATUS_BADGE_VARIANT,
  MATERIAL_TYPE_LABELS,
  MATERIAL_TYPE_BADGE_VARIANT,
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

export default async function MaterialDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const result = await getMaterial(id)
  if (!result.ok) {
    notFound()
  }
  const item = result.data

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { tenantType: true },
  })
  const isMasterAdmin = company?.tenantType === "MASTER_ADMIN"

  const priceDisplay =
    item.unitPrice !== null
      ? `${formatDecimal(item.unitPrice)} ${item.currency} / ${item.unit}`
      : "—"

  return (
    <div className="space-y-6 p-6">
      {/* ヘッダー */}
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/materials">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {item.materialName}
              </h1>
              <Badge variant={MATERIAL_STATUS_BADGE_VARIANT[item.status]}>
                {MATERIAL_STATUS_LABELS[item.status]}
              </Badge>
              <Badge variant={MATERIAL_TYPE_BADGE_VARIANT[item.materialType]}>
                {MATERIAL_TYPE_LABELS[item.materialType]}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono">{item.materialCode}</span>
              {item.materialNameEn && (
                <>
                  <span>·</span>
                  <span>{item.materialNameEn}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/materials/${id}/edit`}>
                <Pencil className="mr-1 h-4 w-4" />
                編集
              </Link>
            </Button>
            <MaterialActions
              id={item.id}
              materialName={item.materialName}
              status={item.status}
              isMasterAdmin={isMasterAdmin}
            />
          </div>
        </div>
      </div>

      {/* 基本情報 + 分類・仕入先 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本情報</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow
              label="素材コード"
              value={<span className="font-mono">{item.materialCode}</span>}
            />
            <DetailRow label="素材名" value={item.materialName} />
            <DetailRow
              label="素材名（英語）"
              value={item.materialNameEn ?? "—"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">分類・仕入先</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow
              label="素材タイプ"
              value={MATERIAL_TYPE_LABELS[item.materialType]}
            />
            <DetailRow
              label="素材カテゴリ"
              value={
                item.category ? (
                  <Link
                    href={`/material-categories/${item.category.id}`}
                    className="inline-flex items-center gap-2 hover:underline"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.category.categoryCode}
                    </span>
                    <span>{item.category.categoryName}</span>
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <DetailRow
              label="主要仕入先"
              value={
                item.supplier ? (
                  <Link
                    href={`/suppliers/${item.supplier.id}`}
                    className="inline-flex items-center gap-2 hover:underline"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.supplier.supplierCode}
                    </span>
                    <span>{item.supplier.companyName}</span>
                  </Link>
                ) : (
                  "—"
                )
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* 単価 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">単価</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow label="単価" value={priceDisplay} />
          <DetailRow
            label="最小発注数"
            value={
              item.minimumOrderQty !== null
                ? `${formatDecimal(item.minimumOrderQty)} ${item.unit}`
                : "—"
            }
          />
        </CardContent>
      </Card>

      {/* 仕様 */}
      {item.specification && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">仕様</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{item.specification}</p>
          </CardContent>
        </Card>
      )}

      {/* メモ */}
      {item.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">メモ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{item.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Phase 1A-13b / 13c で追加されるセクション */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">後続フェーズで追加予定</CardTitle>
          <CardDescription>
            このセクションは Phase 1A-13b / 13c で順次拡張されます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            ・ 生地特有データ（fabricWeight / fabricWidth / composition）→
            Phase 1A-13b
          </p>
          <p>・ 規格（standardUsage / standardLossRate）→ Phase 1A-13b</p>
          <p>・ 貿易データ（hsCode / originCountry）→ Phase 1A-13b</p>
          <p>・ 画像 / 色展開 / 参考サイト → Phase 1A-13c</p>
          <p>・ 多言語（materialNameZh / materialNameVi）→ Phase 1A-13c</p>
        </CardContent>
      </Card>

      {/* メタ情報 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">メタ情報</CardTitle>
        </CardHeader>
        <CardContent>
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
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm py-1">
      <div className="text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  )
}
