# QE-1R 過去実額引き当てキー再設計 実装ブリーフ (2026-07-05)

## 対象プロジェクト
- リポジトリ: shintarokoenuma/shunya-pms
- ローカルパス: ~/shunya-production-system
- 本番URL: shunya-pms-web-production.up.railway.app
- saagara-v2とは完全に別プロジェクト

## 背景・確定方針
QE-1R の過去実額引き当てのうち**材料費側**を、`materialId`（素材マスター）キーから**仕入先（`PurchaseOrder.supplierId`）キー**へ変更する。素材マスター未登録の品目でも過去 PO 実額を引けるようにするのが目的。**工賃側（`costCategoryId`）は据え置き**。`RoughEstimateItem` が既に `sourcePoItemId` を持ち金額は焼き込み済みのため、**スキーマ変更・migration 追加は不要**（triple-gate 範囲は不変）。

## スコープ
触るのは2ファイルのみ。
- `src/lib/actions/rough-estimates.ts`（PO 側クエリ1本）
- `src/app/(app)/products/_components/rough-estimate-section.tsx`（PastPoSearch と結線）

**触らないもの**: 工賃側の全経路（`listPastWoItemsByCostCategory` / `PastWoSearch` / `onPickCostCategory`）、材料費行の素材セレクト（`onPickMaterial`・自動補完用に温存）、Prisma スキーマ全般。

## 詳細指示

### 1. actions 改修（`rough-estimates.ts`）
`listPastPoItemsByMaterial(materialId)` を `listPastPoItemsBySupplier(supplierId)` に置換する。

- 引数を `supplierId: string` に変更。空なら `[]`。
- 親 PO 取得の `where` に `supplierId` を追加し、**その仕入先の PO だけを親として絞る**（現行の「全件取得してから絞る」を最適化も兼ねて解消）:
  `where: { companyId: sess.companyId, deletedAt: null, supplierId }`
- 明細の `where` から `materialId` を**外す**。`unitPrice: { not: null }` は残す。`take` は候補が増えるため **50** に引き上げ。`orderBy: { createdAt: "desc" }` 維持。

**候補行の label 解決（必須・UX の肝）**: 仕入先で絞ると `customItemName` が null（素材マスター品目）の行が混ざる。現行の `itemLabel = customItemName` だけだと候補一覧で品目を判別できず選べない。以下で解決する。
- 取得した PoItem のうち `materialId` を持つものの id 集合を作り、`Material.findMany({ where: { companyId, id: { in } }, select: { id, materialName } })` で**一括引き**して名称を解決。
- 候補の表示名 = `customItemName` を優先、null なら解決した `materialName`、それも無ければ「（過去発注）」。
- 候補行に**色情報**（`color` / `colorCode`）も含めて返し、UI で品目識別を助ける。
- `PastPoItemCandidate` 型に表示名・色を反映（`materialId` フィールドは焼き込み用に残す）。会社スコープ厳守。

### 2. UI 改修（`rough-estimate-section.tsx`）
`PastPoSearch`（1363行〜）を仕入先ベースに変更する。
- コンポーネント冒頭に**仕入先セレクト**を新設。入力キーは `materialId` props ではなく、この Select で選んだ `supplierId`（ローカル `useState`）。
- 仕入先一覧（`{ id, companyName }`）をコンポーネントへ供給する。**現行 `materials` / `costCategories` を親から渡している供給経路を確認し、同じ経路で `suppliers` も渡す**（既存パターンに合わせること）。
- 検索ボタンは `listPastPoItemsBySupplier(supplierId)` を呼ぶ。`materialId` 依存（1254行の props 渡し・1366〜1381 の materialId 分岐）を除去。
- 候補一覧の各行に**品目名・色・単価/通貨・PO番号・発注日**を表示し、人が1行選ぶ。
- apply（1387行〜）の焼き込みは現行踏襲。候補に `materialId` があれば `c.materialId` を焼き、無ければ null。`sourcePoItemId` は従来どおり焼く。他（itemName/quantity/unit/unitPrice/currency）も現行同様。

### 3. house style 遵守
- 新設 Select は既存作法に合わせる（`position="popper"` ＋ `onValueChange` 内で `setValue` 連鎖があれば `preserveDialogScroll()` でガード）。スクロール巻き戻りを再発させないこと。
- 候補ロードは state 更新のみで `setValue` 連鎖を伴わないなら、そのままで可。

## 焼き込み・追跡の設計注記
仕入先起点で `materialId` を持たない候補（自由名行）を選ぶと、明細の `materialId` は null になる。これは正しい挙動（その明細は素材マスターに紐づかない）。引き当て元は `sourcePoItemId` で追跡可能なので情報は失われない。

## 検証（完了報告前に必須）
「ビルドが通った」だけで完了報告しないこと。Playwright で以下を実機再現し、スクリーンショットで裏取りする。
1. QE-1R ダイアログを開き、材料費行で仕入先を選択 → 候補一覧が出る。
2. 候補行の品目名が判別可能（素材マスター品目・自由名品目の両方で表示名が出る）。
3. 候補を選ぶと単価・通貨・数量が焼き込まれ、`sourcePoItemId` が入る。
4. 工賃側（費目キー）が従来どおり動く（回帰なし）。
5. ダイアログのスクロール巻き戻りが起きない。
- headless で再現しない場合は viewport 高さ・明細行数を変えて再現を試みる。
- ブラウザ実機確認は Claude Code の検証完了後に慎太郎さんが実施。

## git / PR 方針
- コードを含むため feature branch + PR 必須。**既存 `feat/qe1r-p1-rough-estimate-schema` に積む（PR #96 に載せる）**。QE-1R 未マージのうちに引き当てキーも同梱するのが素直（レビュー単位を分割しない）。
- 型・lint がクリーンなら commit → push → PR 更新まで Claude Code 自走可。**マージは慎太郎さん**。
- `git add` は明示パスのみ（`-A`・`.`・`--all` 禁止）。
- コミットメッセージ例: `feat(qe1r): 過去実額引き当ての材料費側を仕入先キーに変更（工賃側据え置き・スキーマ無変更）`

## 完了報告に含めるもの
変更した関数シグネチャ／触った行範囲／Playwright スクショ（上記1〜5）／`npx tsc --noEmit` と lint の結果／PR #96 の更新反映。
