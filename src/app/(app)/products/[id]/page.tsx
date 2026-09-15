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
import { KarteDrawerBar } from "../_components/karte-drawer"
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
import { ProductionProgressChips } from "../_components/production-progress-chips"
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

  // B-202 PR-1r: 品番・分類に出す「工場」は、この品番に紐づく量産の作業発注（WO・PRODUCTION）の発注先から導出する。
  //   Product に工場列は無い（R-6-1）。productOrders は既に取得済みなので新規クエリは足さない（R-6-10）。
  //   PATTERN / GRADING の WO は外注パタンナー（contractor）なので対象外。
  const productionFactoryNames = [
    ...new Set(
      productOrders
        .filter((r) => r.kind === "WO" && r.workCategory === "PRODUCTION")
        .map((r) => r.counterpartyName)
        .filter((n) => n !== "—"),
    ),
  ]

  // B-202 PR-1r（Q6r・慎太郎さん決定 2026-09-15）: 担当者はヘッダ右端に出す。
  //   名前解決は getProduct 側（ProductDetail.assignedTo・manual join）に寄せた。
  const assigneeName = item.assignedTo?.name ?? null

  return (
    <div className="space-y-4 p-6">
      <EntityBreadcrumb
        segments={[
          { label: "品番カルテ", href: "/products" },
          { label: primary },
        ]}
      />

      {/* B-202 PR-1r: 1画面（ヘッダ＋3カラム）＋ 横1列のボタンバー＋共有パネル1枚。
          一次資料: モック「品番カルテ 3案」案C（addendum v0.3 §0 の URL）
          仕様: addendum v0.3 D-2r / D-12 / D-13 / D-14 ＋ v1.0 D-2 の7面
          ★本 PR は移設と並べ替えのみ。各 Section コンポーネントの中身は変えていない。 */}

      {/* ① ヘッダ（モック .viewhead: 品番・先方品番・状態 ＋ 右端に シーズン／クライアント／数量／納期）
          旧「シーズン」「数量・納期」Card と、旧「基本情報」のクライアント・状態をここに吸収（D-14） */}
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/products">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {item.productName}
              </h1>
              <span className="font-mono text-sm text-muted-foreground">
                {primary}
              </span>
              {secondary && (
                <Badge variant="outline" className="font-mono text-xs">
                  {clientPrimary ? "社内" : "先方"}: {secondary}
                </Badge>
              )}
              <Badge variant={PRODUCT_STATUS_BADGE_VARIANT[item.status]}>
                {PRODUCT_STATUS_LABELS[item.status]}
              </Badge>
            </div>
            <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <HeaderStat label="シーズン" value={`${item.season}（${item.year}）`} />
              <HeaderStat
                label="クライアント"
                value={item.brand?.client?.companyName ?? "—"}
              />
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
              <HeaderStat label="担当者" value={assigneeName ?? "—"} />
            </dl>
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

      {/* ② 絵型（B-027）― ヘッダ直下の横スクロール帯。
          ★addendum v0.3 D-12（左カラム固定幅）からの暫定変更: 既存の絵型セクションは複数枚サムネ＋操作ボタンの構成で
            細い左カラムに収まらないため、PR-2（1枚＝1タブ・caption 入力）までは帯で置く。3カラム→2カラム（中／右）に畳む */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">絵型</CardTitle>
        </CardHeader>
        <CardContent>
          <SketchSection productId={item.id} sketches={sketches} />
        </CardContent>
      </Card>

      {/* 2カラムグリッド（暫定・モック .onescreen の 中 1fr / 右 1.05fr。狭幅では1カラム） */}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* 中カラム: ③ 品番・分類 ／ ④ 縫製指示 */}
        <div className="flex min-w-0 flex-col gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">品番・分類</CardTitle>
            </CardHeader>
            <CardContent>
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
                label="社内品番"
                value={<span className="font-mono">{item.productCode}</span>}
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
              {/* モック案C の「型番」。getProduct の manual join（ProductDetail.modelCode）から */}
              <DetailRow
                label="型番"
                value={
                  item.modelCode ? (
                    <span>
                      <span className="font-mono">{item.modelCode.modelCode}</span>
                      {item.modelCode.modelName && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {item.modelCode.modelName}
                        </span>
                      )}
                    </span>
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
              {/* D-14: 工場は量産 WO の発注先から導出（読み取り表示のみ） */}
              <DetailRow
                label="工場"
                value={
                  productionFactoryNames.length > 0
                    ? productionFactoryNames.join("／")
                    : "—"
                }
              />
            </CardContent>
          </Card>

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
        </div>

        {/* 右カラム: ⑤ SKU 数量（色×サイズ） ／ ⑥ 進行 ／ ⑦ メモ */}
        <div className="flex min-w-0 flex-col gap-3">
          <ColorQuantitySection
            productId={item.id}
            colorways={colorways}
            colorOptions={colorOptions}
            patternOptions={patternOptions}
            skus={skus}
            defaultSizeOptions={defaultSizeOptions}
            categoryId={item.category?.id ?? null}
          />

          {/* ⑥ 進行 ― 要約チップ（モック案C .tasks・★直列に並べない＝v1.0 D-4）。
              編集（量産進行チェックリスト）とステータス履歴は共有パネル「進行（編集）」へ移設（既存 JSX を無改変で移動） */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                進行
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  — 直列に並べない（並行・前後あり）
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProductionProgressChips tasks={productionTasks} />
            </CardContent>
          </Card>

          {/* ⑦ メモ（進行の直下）― B-202 PR-3 で Comment を配線する。本 PR では場所のみ確保 */}
        </div>
      </div>

      {/* ボタンバー＋共有パネル1枚（D-2r / Q5r）。6グループは D-13 のとおり */}
      <KarteDrawerBar
        groups={[
          {
            id: "prog",
            title: "進行（編集）",
            hint: "チェックリスト／履歴",
            children: (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-2 text-sm font-medium">量産進行</h3>
                  <ProductionProgressChecklist
                    productId={item.id}
                    tasks={productionTasks}
                    processingOptions={processingOptions}
                  />
                </div>
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
              </div>
            ),
          },
          {
            id: "bom",
            title: "資材表 BOM",
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
            id: "est",
            title: "見積・原価",
            hint: "概算／量産見積／原価",
            children: (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">概算量産見積（提示価格）</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RoughEstimateSection
                      productId={item.id}
                      rows={roughEstimateRows}
                      brandDefaultMarginRate={brandDefaultMarginRate}
                      materials={qeMaterials}
                      costCategories={qeCostCategories}
                      suppliers={qeSuppliers}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">量産見積（提示1枚単価）</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ProductionEstimateSection
                      productId={item.id}
                      rows={productionEstimateSection.rows}
                      hasBaseSample={productionEstimateSection.hasBaseSample}
                    />
                  </CardContent>
                </Card>
                <ProductionCostSection
                  skus={skus}
                  materials={productionCostInputs.materials}
                  labor={productionCostInputs.labor}
                />
              </div>
            ),
          },
          {
            id: "ord",
            title: "受注・発注",
            // ★発注生成後の着地先 `/products/[id]#orders` はこのグループを開く
            hashTargets: ["orders"],
            children: (
              <div className="space-y-4">
                {salesOrderSection.ok && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">受注</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <SalesOrderSection section={salesOrderSection.data} />
                    </CardContent>
                  </Card>
                )}
                <ProductOrdersSection rows={productOrders} />
              </div>
            ),
          },
          {
            id: "docs",
            title: "関連書類",
            children: (
              <p className="text-sm text-muted-foreground">
                関連書類（輸出インボイス・パッキングリスト・原産地証明 ほか）の紐付け一覧は
                B-110 で実装します（B-202 v1.0 D-5）。
              </p>
            ),
          },
          {
            id: "mark",
            title: "マーキング・所要量",
            children: (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">マーキング実測</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MarkingSection
                      productId={item.id}
                      items={markingViews}
                      materials={bomMaterials}
                    />
                  </CardContent>
                </Card>
                <MaterialRequirementSection skus={skus} items={materialReqItems} />
              </div>
            ),
          },
          {
            id: "meta",
            title: "サンプル・メタ",
            children: (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">サンプル製作ラウンド</CardTitle>
                      <Button asChild size="sm">
                        <Link href={`/samples/new?productId=${item.id}`}>
                          <Plus className="mr-1 h-4 w-4" />
                          ラウンド追加
                        </Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <SampleProductionsTable
                      items={samples}
                      showProduct={false}
                      showEstimateBaseControl
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">メタ情報</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* 旧「基本情報」のうちヘッダ・品番分類に吸収しなかった3項目（情報を落とさないためここに置く） */}
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
    <div className="flex items-baseline gap-1.5">
      <dt className="text-xs">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}
