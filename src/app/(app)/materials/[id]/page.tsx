import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AlertTriangle, ChevronLeft, Pencil } from "lucide-react"
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
import { COUNTRY_OPTIONS } from "@/lib/constants/countries"
import { listMaterialEvidenceFiles } from "@/lib/actions/material-evidence"
import {
  HS_SOURCE_LABELS,
  formatComposition,
  parseCompositionData,
  parseExportSpec,
  parseReferenceUrls,
  summarizeExportSpec,
} from "@/lib/hs/export-spec"
import { EvidenceSection } from "../_components/evidence-section"
import { candidateDiffersFromHsCode, classifyHs } from "@/lib/hs/classify"

const COUNTRY_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  COUNTRY_OPTIONS.map((c) => [c.value, c.label]),
)

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

  // B-211 PR-1: 輸出用の規格・根拠
  const compositionData = parseCompositionData(item.compositionData)
  const exportSpec = parseExportSpec(item.exportSpec)
  const specSummary = summarizeExportSpec(exportSpec)
  const referenceUrls = parseReferenceUrls(item.referenceUrls)
  // FIX-1 B-4: 保存されている規格から候補を計算し、HS コードと違えば注意を出す
  const candidate = classifyHs({
    materialType: item.materialType,
    compositionData,
    exportSpec,
    fabricWeight: item.fabricWeight === null ? null : Number(item.fabricWeight),
    fabricWidth: item.fabricWidth === null ? null : Number(item.fabricWidth),
  })
  const hsMismatch = candidateDiffersFromHsCode(candidate, item.hsCode)
  const evidence = await listMaterialEvidenceFiles(id)
  const evidenceFiles = evidence.ok ? evidence.data : []
  const copiedFrom =
    exportSpec?.hsSource === "COPIED" && exportSpec.copiedFromMaterialId
      ? await prisma.material.findFirst({
          where: { id: exportSpec.copiedFromMaterialId, companyId: session.user.companyId },
          select: { materialCode: true },
        })
      : null
  const copiedFromLabel = copiedFrom?.materialCode ?? "（削除済みの材料）"

  // B-243 PR-4（D4-3）: マスターの取引条件・編集が見えない役割は「見るだけ」。単価のカード・編集・メニューを出さない
  const canEditMaster = !item.termsHidden

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
          {canEditMaster && (
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
          )}
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
            <DetailRow
              label="代表画像"
              value={
                item.imageUrl ? (
                  <a
                    href={item.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline break-all"
                  >
                    {item.imageUrl}
                  </a>
                ) : (
                  "—"
                )
              }
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

      {/* 単価。B-243 PR-4（D4-3）: マスターの取引条件が見える役割だけ（見えない人には action が null で返す） */}
      {!item.termsHidden && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">単価</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow
            label="単価"
            value={
              item.unitPrice !== null
                ? `${formatDecimal(item.unitPrice)} ${item.currency} / ${item.unit}`
                : "—"
            }
          />
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
      )}

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

      {/* Phase 1A-13b 生地仕様 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">生地仕様</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow
            label="目付"
            value={
              item.fabricWeight !== null
                ? `${formatDecimal(item.fabricWeight)} g/m²`
                : "—"
            }
          />
          <DetailRow
            label="生地巾"
            value={
              item.fabricWidth !== null
                ? `${formatDecimal(item.fabricWidth)} cm`
                : "—"
            }
          />
          <DetailRow
            label="組成"
            value={
              item.composition ? (
                <span className="whitespace-pre-wrap">{item.composition}</span>
              ) : (
                "—"
              )
            }
          />
          <DetailRow
            label="生地見本"
            value={
              item.swatchImageUrl ? (
                <a
                  href={item.swatchImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {item.swatchImageUrl}
                </a>
              ) : (
                "—"
              )
            }
          />
        </CardContent>
      </Card>

      {/* Phase 1A-13b 規格・標準 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">規格・標準</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow
            label="標準用尺"
            value={
              item.standardUsage !== null
                ? `${formatDecimal(item.standardUsage)} m/枚`
                : "—"
            }
          />
          <DetailRow
            label="標準ロス率"
            value={
              item.standardLossRate !== null
                ? `${formatDecimal(item.standardLossRate)} %`
                : "—"
            }
          />
        </CardContent>
      </Card>

      {/* B-211 PR-1 輸出用の規格（Phase 1A-13b の「貿易」をここに統合） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">輸出用の規格</CardTitle>
          <CardDescription>
            輸出インボイスと HS コードの判定に使う。判定の木は照合前のため HS コードには「要確認」の札が付く
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DetailRow
            label="混率"
            value={
              compositionData.length > 0
                ? formatComposition(compositionData)
                : item.composition
                  ? <span className="text-muted-foreground">{item.composition}（文字のみ）</span>
                  : "—"
            }
          />
          <DetailRow
            label="規格"
            value={specSummary.length > 0 ? specSummary.join(" / ") : "—"}
          />
          <DetailRow
            label="目付"
            value={
              item.fabricWeight !== null && item.fabricWeight !== undefined
                ? `${formatDecimal(item.fabricWeight)} g/㎡`
                : "—"
            }
          />
          <DetailRow
            label="幅"
            value={
              item.fabricWidth !== null && item.fabricWidth !== undefined
                ? `${formatDecimal(item.fabricWidth)} cm`
                : "—"
            }
          />
          <DetailRow
            label="HS コード"
            value={
              item.hsCode ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{item.hsCode}</span>
                  <Badge variant="outline" title="判定の木は澁澤WT と照合前。照合が済むまで「要確認」">
                    要確認
                  </Badge>
                  {exportSpec?.hsSource && (
                    <span className="text-xs text-muted-foreground">
                      {exportSpec.hsSource === "COPIED" && exportSpec.copiedFromMaterialId
                        ? `${copiedFromLabel} から写した`
                        : HS_SOURCE_LABELS[exportSpec.hsSource]}
                      {exportSpec.decidedAt &&
                        `（${new Date(exportSpec.decidedAt).toLocaleDateString("ja-JP")}）`}
                    </span>
                  )}
                  {hsMismatch && (
                    <span className="flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-900">
                      <AlertTriangle className="h-3 w-3" />
                      候補と今の HS コードが違います（規格からの候補 {candidate.code}）
                    </span>
                  )}
                </span>
              ) : (
                "—"
              )
            }
          />
          <DetailRow
            label="原産国"
            value={
              item.originCountry ? (
                <span>
                  <span className="font-mono text-xs text-muted-foreground mr-2">
                    {item.originCountry}
                  </span>
                  {COUNTRY_LABEL_BY_VALUE[item.originCountry] ?? ""}
                </span>
              ) : (
                "—"
              )
            }
          />
        </CardContent>
      </Card>

      {/* B-211 PR-1 根拠（SharedFile・referenceUrls） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">根拠</CardTitle>
          <CardDescription>
            HS コードや規格の根拠になる規格書・メール・メーカーの URL
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EvidenceSection
            materialId={item.id}
            files={evidenceFiles}
            referenceUrls={referenceUrls}
            canEdit={canEditMaster}
          />
        </CardContent>
      </Card>

      {/* Phase 1A-13c で追加されるセクション */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">後続フェーズで追加予定</CardTitle>
          <CardDescription>
            次フェーズ（1A-13c）で追加される予定の項目。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>・ 色展開（availableColors）→ Phase 1A-13c</p>
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
