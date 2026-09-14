import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, Pencil, Plus } from "lucide-react"
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
import { listSampleProductions } from "@/lib/actions/sample-productions"
import {
  getBomByProductId,
  listMaterialsForBomSelect,
  listSuppliersForBomSelect,
  listMarkingsForBomSelect,
} from "@/lib/actions/boms"
import { getMarkingRecordsByProductId } from "@/lib/actions/markings"
import { listSkusForProduct, getDefaultSizesForProduct } from "@/lib/actions/skus"
import { listColorways } from "@/lib/actions/product-colorways"
import { listActiveColorsForPicker } from "@/lib/actions/colors"
import { listActiveTextilePatterns } from "@/lib/actions/textile-patterns"
import { getProductSketchUrls } from "@/lib/actions/product-sketches"
import { SketchSection } from "../_components/sketch-section"
import { KarteDrawers } from "../_components/karte-drawer"
import { listColorwaysByBomItems } from "@/lib/actions/bom-item-colorways"
import { SampleProductionsTable } from "../../samples/_components/sample-productions-table"
import { ColorQuantitySection } from "../_components/color-quantity-section"
import { BomSection, type BomItemView } from "../_components/bom-section"
import { MaterialRequirementSection } from "../_components/material-requirement-section"
import type { MaterialReqBomItem } from "@/lib/calc/material-requirement"
import { ProductionCostSection } from "../_components/production-cost-section"
import { getProductionCostInputs } from "@/lib/actions/production-cost"
import { ProductionEstimateSection } from "../_components/production-estimate-section"
import { getProductionEstimateSection } from "@/lib/actions/production-estimates"
import { SalesOrderSection } from "../_components/sales-order-section"
import { getSalesOrderSectionForProduct } from "@/lib/actions/sales-orders"
import { ProductOrdersSection } from "../_components/product-orders-section"
import { getProductOrders } from "@/lib/actions/product-orders"
import { MarkingSection, type MarkingView } from "../_components/marking-section"
import { SewingInstructionSection } from "../_components/sewing-instruction-section"
import { parseSewingInstruction } from "@/lib/validators/sewing-instruction"
import {
  listProductionTasks,
  listActiveProcessingTypesForSelect,
} from "@/lib/actions/progress-tasks"
import { ProductionProgressChecklist } from "../_components/production-progress-checklist"
import { RoughEstimateSection } from "../_components/rough-estimate-section"
import {
  listRoughEstimatesByProduct,
  getDefaultMarginRateForProduct,
} from "@/lib/actions/rough-estimates"
import {
  listActiveMaterialsForPoSelect,
  listActiveCostCategoriesForPoSelect,
  listActiveSuppliersForPoSelect,
} from "@/lib/actions/purchase-orders"
import {
  primaryProductCode,
  secondaryProductCode,
  isClientCodePrimary,
} from "@/lib/utils/product-code"
import { ProductActions } from "../_components/product-delete-button"
import { EntityBreadcrumb } from "../../_components/entity-breadcrumb"
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

  // S-2: この品番カルテ配下のサンプル製作セット
  const samplesResult = await listSampleProductions({
    productId: id,
    pageSize: 50,
  })
  const samples = samplesResult.ok ? samplesResult.data.items : []

  // B-064: 数量マトリクス（色×サイズ＋数量群）。量産発注数のみインライン編集可。
  const skusResult = await listSkusForProduct(id)
  const skus = skusResult.ok ? skusResult.data : []
  // SKU 生成ダイアログのサイズ初期候補（カテゴリ defaultSizeOptions・無ければ手入力）。
  const defaultSizesResult = await getDefaultSizesForProduct(id)
  const defaultSizeOptions = defaultSizesResult.ok ? defaultSizesResult.data.sizes : []

  // B-062 β: カラー展開（ProductColorway）。カラー軸の親。
  const colorwaysResult = await listColorways(id)
  const colorways = colorwaysResult.ok ? colorwaysResult.data : []
  // B-063: カラーピッカー用の ACTIVE 色マスター（read のみ）。
  const colorOptions = await listActiveColorsForPicker()
  // B-066-③: 柄ピッカー用の ACTIVE 柄マスター（read のみ）。
  const patternOptions = await listActiveTextilePatterns()

  // B-027: 絵型（服のスケッチ）。各画像を署名URL化して取得。
  const sketchResult = await getProductSketchUrls(id)
  const sketches = sketchResult.ok ? sketchResult.data : []

  // QE-0b/0c: 資材表（BOM）。Decimal はクライアントへ渡すため number に正規化。
  const [bomResult, bomMaterials, bomSuppliers, bomMarkings] = await Promise.all([
    getBomByProductId(id),
    listMaterialsForBomSelect(),
    listSuppliersForBomSelect(),
    listMarkingsForBomSelect(id),
  ])
  const bom = bomResult.ok ? bomResult.data : null

  // B-062 β 次PR: 資材×カラーウェイの調達カラー（C/#）を bom 配下一括取得し bomItemId で畳む。
  const bicResult = bom
    ? await listColorwaysByBomItems(bom.id)
    : null
  const bicByItem = bicResult?.ok ? bicResult.data : {}

  const toNum = (v: { toNumber: () => number } | null) =>
    v == null ? null : v.toNumber()
  const bomItems: BomItemView[] = (bom?.items ?? []).map((it) => ({
    id: it.id,
    itemCategory: it.itemCategory,
    materialId: it.materialId,
    materialLabel: it.material
      ? `${it.material.materialCode} ${it.material.materialName}`
      : null,
    customMaterialName: it.customMaterialName,
    supplierId: it.supplierId,
    supplierLabel: it.supplier
      ? `${it.supplier.supplierCode} ${it.supplier.companyName}`
      : null,
    usagePerUnit: toNum(it.usagePerUnit),
    unit: it.unit,
    lossRate: it.lossRate.toNumber(),
    procurementMode: it.procurementMode,
    unitPrice: toNum(it.unitPrice),
    supplierItemCode: it.supplierItemCode,
    designCode: it.designCode,
    sizeValue: toNum(it.sizeValue),
    sizeUnit: it.sizeUnit,
    usageSource: it.usageSource,
    markingRecordId: it.markingRecordId,
    costSource: it.costSource,
    purchaseOrderId: it.purchaseOrderId,
    colorCode: it.colorCode,
    colorName: it.colorName,
    notes: it.notes,
    colorways: bicByItem[it.id] ?? [],
  }))

  // B-067 D4(ア): 資材所要量セクション用の薄い入力（追加クエリなし・既存 bomItems/colorways から詰め替え）。
  // colorways(ColorwayRow[]) で productColorwayId→colorwayCode を引き、調達色行のラベルに使う。
  const colorwayCodeById = new Map(colorways.map((c) => [c.id, c.colorwayCode]))
  const materialReqItems: MaterialReqBomItem[] = bomItems.map((it) => ({
    id: it.id,
    itemLabel: it.materialLabel ?? it.customMaterialName ?? "（名称未設定）",
    itemCategory: it.itemCategory,
    usagePerUnit: it.usagePerUnit,
    lossRate: it.lossRate,
    unit: it.unit,
    colorways: it.colorways.map((cw) => ({
      productColorwayId: cw.productColorwayId,
      colorwayCode: colorwayCodeById.get(cw.productColorwayId) ?? null,
      supplierColorCode: cw.supplierColorCode,
    })),
  }))

  // QE-1R: 概算量産見積（提示価格）。一覧・既定利益率・引き当てピッカー用の素材/費目/仕入先候補を取得。
  const [
    roughEstimateRows,
    marginDefaultResult,
    qeMaterials,
    qeCostCategories,
    qeSuppliers,
  ] = await Promise.all([
    listRoughEstimatesByProduct(id),
    getDefaultMarginRateForProduct(id),
    listActiveMaterialsForPoSelect(),
    listActiveCostCategoriesForPoSelect(),
    listActiveSuppliersForPoSelect(),
  ])
  const brandDefaultMarginRate = marginDefaultResult.ok
    ? marginDefaultResult.data.marginRate
    : 0

  // A-seed1: 量産見積（発行履歴＋基準サンプル有無）。
  const productionEstimateSection = await getProductionEstimateSection(id)
  const salesOrderSection = await getSalesOrderSectionForProduct(id)
  const productOrders = await getProductOrders(id)

  // QE-1: 量産原価ビュー用の入力（ROLL 反情報・PRODUCTION WoItem。read-only）。
  const productionCostResult = await getProductionCostInputs(id)
  const productionCostInputs = productionCostResult.ok
    ? productionCostResult.data
    : { materials: [], labor: [] }

  // QE-0c: マーキング実測
  const markingResult = await getMarkingRecordsByProductId(id)
  const markingViews: MarkingView[] = (markingResult.ok ? markingResult.data : []).map(
    (m) => ({
      id: m.id,
      markerName: m.markerName,
      materialId: m.materialId,
      materialLabel: m.material
        ? `${m.material.materialCode} ${m.material.materialName}`
        : null,
      usagePerUnit: m.usagePerUnit.toNumber(),
      fabricWidth: m.fabricWidth.toNumber(),
      rollLength: toNum(m.rollLength),
      yieldRate: toNum(m.yieldRate),
      partsCount: m.partsCount,
      patternPitch: toNum(m.patternPitch),
      hasPdf: !!m.originalFileGcsPath,
      notes: m.notes,
    }),
  )

  // B-101: 量産進行（PRODUCTION タスク＋加工マスター）
  const [productionTasksResult, processingOptions] = await Promise.all([
    listProductionTasks(id),
    listActiveProcessingTypesForSelect(),
  ])
  const productionTasks = productionTasksResult.ok
    ? productionTasksResult.data.items
    : []

  return (
    <div className="space-y-6 p-6">
      <EntityBreadcrumb
        segments={[
          { label: "品番カルテ", href: "/products" },
          { label: primary },
        ]}
      />

      {/* B-202 PR-1: 1画面（7面）＋下開きの引き出し。
          仕様: docs/specs/b-202-product-karte-one-screen-spec-confirmation-v1_0-2026-09-12.md D-2 /
                docs/specs/b-202-implementation-brief-2026-09-15.md §2
          ★本 PR は移設と並べ替えのみ。各 Section コンポーネントの中身は変えていない。 */}

      {/* ① ヘッダ（品名・状態・社内品番・先方品番 ＋ 旧「シーズン」「数量・納期」Card を統合） */}
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
        {/* 旧「シーズン」「数量・納期」Card（項目・値の算出は同じ・置き場所のみ統合） */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border bg-muted/30 px-4 py-2 text-sm sm:grid-cols-4">
          <HeaderStat label="シーズン" value={item.season} />
          <HeaderStat label="年度" value={String(item.year)} />
          <HeaderStat
            label="想定数量"
            value={
              item.expectedQuantity != null
                ? `${item.expectedQuantity.toLocaleString("ja-JP")} 点`
                : "—"
            }
          />
          <HeaderStat
            label="希望納期"
            value={
              item.desiredDeliveryDate
                ? new Date(item.desiredDeliveryDate).toLocaleDateString("ja-JP")
                : "—"
            }
          />
        </dl>
      </div>

      {/* ② 絵型（服のスケッチ・B-027） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">絵型</CardTitle>
        </CardHeader>
        <CardContent>
          <SketchSection productId={item.id} sketches={sketches} />
        </CardContent>
      </Card>

      {/* ③ 品番・分類（旧「基本情報」との2列並置は維持・情報の欠落を防ぐ） */}
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

      {/* ④ 縫製指示（B-094: 固定5＋縫製指示6・Product.sewingInstructions Json） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">縫製指示</CardTitle>
        </CardHeader>
        <CardContent>
          <SewingInstructionSection
            productId={item.id}
            value={parseSewingInstruction(item.sewingInstructions)}
          />
        </CardContent>
      </Card>

      {/* ⑤ SKU 数量（B-062β カラー展開＋B-064 数量マトリクス・色×サイズ） */}
      <ColorQuantitySection
        productId={item.id}
        colorways={colorways}
        colorOptions={colorOptions}
        patternOptions={patternOptions}
        skus={skus}
        defaultSizeOptions={defaultSizeOptions}
        categoryId={item.category?.id ?? null}
      />

      {/* ⑥ 進行（B-101・上段: 量産進行チェックリスト / 下段: ステータス履歴） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">進行</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 上段: 量産進行チェックリスト */}
          <div>
            <h3 className="mb-2 text-sm font-medium">量産進行</h3>
            <ProductionProgressChecklist
              productId={item.id}
              tasks={productionTasks}
              processingOptions={processingOptions}
            />
          </div>
          {/* 下段: ステータス履歴（既存 JSX をそのまま移設・read-only） */}
          <div>
            <h3 className="mb-2 text-sm font-medium">ステータス履歴</h3>
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
          </div>
        </CardContent>
      </Card>

      {/* ⑦ メモ（進行の直下）― B-202 PR-3 で Comment を配線する。本 PR では場所のみ確保 */}

      {/* 引き出し（同時に開くのは1つ・中身は内側でスクロール）。
          順序は実装ブリーフ §2 のとおり。★「関連書類」は移設元の既存セクションが無いため本 PR には含めない（D-5 / B-110） */}
      <KarteDrawers
        items={[
          {
            id: "bom",
            title: "資材表（BOM）",
            children: (
              <BomSection
                productId={item.id}
                bomId={bom?.id ?? null}
                items={bomItems}
                materials={bomMaterials}
                suppliers={bomSuppliers}
                markings={bomMarkings}
                colorwayColumns={colorways.filter((c) => c.status === "ACTIVE")}
              />
            ),
          },
          {
            id: "marking",
            title: "マーキング実測",
            children: (
              <MarkingSection
                productId={item.id}
                items={markingViews}
                materials={bomMaterials}
              />
            ),
          },
          {
            id: "material-requirement",
            title: "資材所要量",
            children: (
              <MaterialRequirementSection skus={skus} items={materialReqItems} />
            ),
          },
          {
            id: "rough-estimate",
            title: "概算量産見積（提示価格）",
            children: (
              <RoughEstimateSection
                productId={item.id}
                rows={roughEstimateRows}
                brandDefaultMarginRate={brandDefaultMarginRate}
                materials={qeMaterials}
                costCategories={qeCostCategories}
                suppliers={qeSuppliers}
              />
            ),
          },
          {
            id: "production-estimate",
            title: "量産見積（提示1枚単価）",
            children: (
              <ProductionEstimateSection
                productId={item.id}
                rows={productionEstimateSection.rows}
                hasBaseSample={productionEstimateSection.hasBaseSample}
              />
            ),
          },
          {
            id: "production-cost",
            title: "量産原価（実績・請求突合用）",
            children: (
              <ProductionCostSection
                skus={skus}
                materials={productionCostInputs.materials}
                labor={productionCostInputs.labor}
              />
            ),
          },
          ...(salesOrderSection.ok
            ? [
                {
                  id: "sales-orders",
                  title: "受注",
                  children: (
                    <SalesOrderSection section={salesOrderSection.data} />
                  ),
                },
              ]
            : []),
          {
            // ★id="orders" は発注生成後の着地先 `/products/[id]#orders` と一致させる
            id: "orders",
            title: "発注（PO / WO）",
            children: <ProductOrdersSection rows={productOrders} />,
          },
          {
            id: "samples",
            title: "サンプル製作ラウンド",
            children: (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button asChild size="sm">
                    <Link href={`/samples/new?productId=${item.id}`}>
                      <Plus className="mr-1 h-4 w-4" />
                      ラウンド追加
                    </Link>
                  </Button>
                </div>
                <SampleProductionsTable
                  items={samples}
                  showProduct={false}
                  showEstimateBaseControl
                />
              </div>
            ),
          },
          {
            id: "meta",
            title: "メタ情報",
            children: (
              <div>
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
              </div>
            ),
          },
        ]}
      />
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

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
