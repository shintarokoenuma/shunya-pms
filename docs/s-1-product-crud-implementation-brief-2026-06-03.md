# S-1 実装指示書 — Product（品番カルテ）基本CRUD

- 作成日: 2026-06-03 / Claude.ai
- 対象: Claude Code（実装）
- 根拠議事録: `product-sample-spec-confirmation-v1_0-2026-06-03.md`（§4）
- 準拠パターン: `shunya-master-patterns.md`（命名・ActionResult・auditLog の流儀）、Phase 1A-12（採番の保存時確定・プレビュー方式）
- 位置づけ: 業務トランザクションの最初の山 S-1。Product を CRUD で動かし、ModelCode 連携と採番を確立する。SampleProduction（S-2）・進行チェックリスト（S-3）の土台。

---

## 0. 重要な前提

- **Product は「業務トランザクション」であり、master-patterns の完全な適用対象ではない**（master-patterns §1 非適用範囲）。住所4分割・主担当Contact同時作成・取引条件プリセットは**持たない**。流用するのは命名規約・`ActionResult<T>`・auditLog・採番の保存時確定方式・8関数の考え方・tsc clean・PR運用。
- **schema 無変更見込み**。`Product` / `ProductStatusHistory` / `ProductStatus` enum / `ModelCode` / `ProductCategory`（categoryCode あり）はすべて既存。migration は原則不要。**もし schema 変更が必要と判断したら、実装を止めて慎太郎さんに相談すること**（本番DBに影響するため）。
- 既存の正を必ず schema で確認してから書く（master-patterns アンチパターン「Prisma 真値を確認せずに書く」を避ける）。

---

## 1. スコープ

### 含む（S-1）
1. Product の基本CRUD（list / get / create / update / archive / restore / checkUsage / deletePermanently）。
2. 社内品番 `productCode` の自動採番（保存時確定・プレビュー）。
3. ModelCode 連携（既存選択 ＋ 新規発番の両対応）。
4. マスター参照UI（Client / Brand / ProductCategory / ModelCode の Select）。
5. status 編集と `ProductStatusHistory` への遷移記録。
6. Phase 1A-12 の ModelCode 手動採番（新規作成）導線の撤去。

### 含まない（後続）
- SampleProduction（S-2）、進行チェックリスト・ProcessingType（S-3a/S-3）、WO/PO 連携（S-4）。
- SKU マトリクス、コレクション、リピート系譜、累積データ集計。
- 価格・粗利の自動計算、量産系 status の遷移ルール。
- Product のフィールドのうち、価格・数量・納期・海外生産などは**入力UIを最小限**にし、まず「品番を発番して器を作る」を成立させる（詳細フォームは段階拡張）。

---

## 2. schema 確認（変更しない・参照のみ）

- `Product`: `productCode`(unique: `@@unique([companyId, productCode])`) / `clientProductCode?` / `inquiryId?` / `modelCodeId`(必須) / `clientId`(必須) / `brandId`(必須) / `categoryId?` / `productName`(必須) / `season`(必須) / `year`(必須 SmallInt) / `status`(ProductStatus) / 他多数。
- `ProductStatus` enum（10段階 + CANCELLED / ON_HOLD / ARCHIVED）は既存。**enum 追加不要。**
- `ProductStatusHistory`: `productId` / `fromStatus?` / `toStatus` / `changedByUserId?` / `changeReason?` / `changedAt`。
- `ProductCategory`: `categoryCode`(VarChar10, 例 TS/JK/PT) / `categoryName` / `status`(String "ACTIVE")。**status が String 型である点に注意**（enum 化は本スコープ外。Select 取得時は `status === "ACTIVE"` でフィルタ）。
- `ModelCode`: `modelCode`(`M-{brandCode}-{連番4桁}`) / `brandId` / `modelName` / `status`(ModelCodeStatus)。

---

## 3. 採番仕様（確定）

### 3-1. 社内品番 productCode

フォーマット（仕様書 Part2 3.2）:
```
{ブランド略号}-{年シーズン}-{カテゴリ略号}-{連番3桁}
例: MK-26SS-TS-001
```
- **ブランド略号**: `Brand.code`（ModelCode 採番と同じ源）。
- **年シーズン**: `Product.season`（`26SS` / `26FW` 形式。フォーム入力。`year` は season から導出 or 別入力）。
- **カテゴリ略号**: `ProductCategory.categoryCode`（TS / JK / PT …）。
- **連番3桁**: **`companyId × ブランド略号 × season × categoryCode` の組み合わせごと**に 001 から、3桁ゼロ埋め。

### 3-2. 採番タイミング（1A-12 方式に統一）
1. 新規作成画面で Brand・Season・Category を選択した時点で、`productCode` 欄にプレビュー表示（読み取り専用）。
2. 注記: 「※ 採番は保存時に確定します。表示中の番号は参考です。」
3. 保存時に Prisma transaction 内で連番を再計算して確定。`@@unique([companyId, productCode])` 違反時はリトライ（次番号）またはエラー表示。

ヘルパー: `generateNextProductCode({ brandId, season, categoryId })` を `actions/products.ts` に置く。プレビュー用に Server Action として公開し、フォームの onChange から呼ぶ。

### 3-3. カテゴリ必須化（★慎太郎さんに確認した上で確定）
`categoryId` は schema 上 optional だが、**採番にカテゴリ略号が必須**のため、Product 作成フォームでは **categoryId を必須入力にする**（Zod superRefine で必須）。schema は optional のまま据え置き（既存維持・migration 不要）。

---

## 4. ModelCode 連携仕様

新規作成フォームに「モデルコード」セクションを設け、2モードを切り替え:

- **モードA: 既存 ModelCode から選択**。Brand で絞った ACTIVE な ModelCode を Select。選んだ `modelCodeId` を Product に紐付け。
- **モードB: 新規発番**。Product 保存時の transaction 内で ModelCode を `M-{brandCode}-{連番4桁}` で発番（1A-12 の `generateNextModelCode(brandId)` ロジックを再利用）し、その id を `Product.modelCodeId` にセット。`ModelCode.modelName` は Product.productName 等から初期値を入れる（フォームで編集可にしてもよい）。

`modelCodeId` は schema 上必須。モードA/B いずれでも保存時に必ず確定する。

---

## 5. status と ProductStatusHistory

- 編集画面で `status` を Select 変更可能にする。S-1 では全 enum を選択肢に出す自由遷移でよい（遷移ルール＝「この状態からこの状態のみ」の制約は S-2/S-3 で段階導入）。
- status が変化した update では、同一 transaction 内で `ProductStatusHistory` に1行追加（`fromStatus` / `toStatus` / `changedByUserId` / `changedAt`）。`changeReason` は任意入力。
- archive/restore は status を `ARCHIVED` ⇔ 直前 status に出し入れする方式。**`CANCELLED` / `ON_HOLD` は業務ステータスであり archive とは別物**として扱う（混同しない）。
- ステータスバッジ: master-patterns の色規約に準拠しつつ、サンプル系/量産系/終端で見分けられるよう `_BADGE_VARIANT` を定義（`PRODUCT_STATUS_LABELS` / `_OPTIONS` / `_BADGE_VARIANT`）。

---

## 6. Phase 1A-12 手動採番UI の撤去

1A-12 §9.6 の刈り取り。**可逆な形**で進める:
- ModelCode 一覧の「新規作成」ボタンと nav からの新規導線を非表示にする。
- `model-codes/new/page.tsx` はファイル削除せず、`tenantType === "MASTER_ADMIN"` のガードを入れて残す（移行期の保険）。
- ModelCode は今後 Product 作成（モードB）から発番される旨を、一覧ページにヘルプ表示。

> ※ 完全削除は Product 発番が本番で安定稼働してから別タスクで。S-1 では導線を閉じるに留める。

---

## 7. 実装手順（master-patterns §12 準拠・コミット分割）

### Phase 1: スキーマ
- 変更なし想定。`prisma/schema.prisma` で §2 の各モデル真値を確認するのみ。migration を実行しない。
- 変更が要ると判断したら**着手前に慎太郎さんへ相談**。

### Phase 2: 論理層（→ コミット1）
- `src/lib/validators/product.ts`
  - `productInputSchema` / `ProductInput` / `ProductFormValues` / `productListParamsSchema`。
  - 必須: productName / brandId / clientId / categoryId（§3-3）/ season / year / modelCode モード（既存 or 新規）。
  - `season` は `^\d{2}(SS|FW|AW|Pre|Cruise)$` 等の形式検証（実装時に既存 season 表記を確認して確定）。
- `src/app/(app)/products/_components/labels.ts`
  - `PRODUCT_STATUS_LABELS` / `_OPTIONS` / `_BADGE_VARIANT`。共通定数（currencies 等）は re-export。
- `src/lib/actions/products.ts`（8関数 + ヘルパー）
  - `listProducts` / `getProduct` / `createProduct` / `updateProduct` / `archiveProduct` / `restoreProduct` / `checkProductUsage` / `deleteProductPermanently`。
  - ヘルパー: `generateNextProductCode({brandId, season, categoryId})` / `generateNextModelCode(brandId)`（1A-12 再利用）/ `listActiveBrandsForSelect()` / `listActiveCategoriesForSelect()` / `listActiveClientsForSelect()` / `listModelCodesForBrandSelect(brandId)`。
  - `createProduct` / `updateProduct` は transaction 内で「採番確定（＋必要なら ModelCode 発番）＋ Product 作成/更新 ＋ status 変化時 ProductStatusHistory ＋ auditLog」を一括。
  - `checkProductUsage`: S-1 段階では SKU / SampleProduction / WO / PO 等の子レコード件数を確認（現状ほぼ0だが、物理削除ガードの枠を最初から正しく作る）。
  - `deleteProductPermanently`: `MASTER_ADMIN` ＋ `status===ARCHIVED` ＋ 確認名一致（`confirmationCode === product.productCode`）＋ usage 0件。`runWithoutTenantContext` で実行。
  - 全関数 `ActionResult<T>` で返し、auditLog を記録。
- tsc clean 確認 → **コミット1（論理層）**。

### Phase 3: UI（→ コミット2）
- `_components/product-form.tsx`
  - カード構成（最小）: ①基本情報（productCode プレビュー＝読取専用 / productName / productNameEn / description）②関連エンティティ（brandId / clientId / categoryId / modelCode モードA・B）③シーズン（season / year）④ステータス（status）。価格・数量・納期・海外生産は S-1 では非表示 or 折りたたみ（schema 列は温存）。
  - Brand/Season/Category 変更時に `generateNextProductCode` を呼び productCode プレビュー更新。
  - フォームは React Hook Form + Zod。`<form>` タグは Artifacts 制約と無関係（本番アプリなので通常実装でよい）。
- `_components/product-delete-button.tsx`（archive/restore/物理削除。master-patterns 準拠）
- `_components/products-table.tsx` / `products-search.tsx` / `products-pagination.tsx`
  - 検索: productCode / productName / clientProductCode 部分一致。
  - フィルタ: Brand / Category / Status / Season。
- `page.tsx` / `new/page.tsx` / `[id]/page.tsx` / `[id]/edit/page.tsx`
  - 詳細ページに ProductStatusHistory のタイムライン表示、SKU / SampleProduction セクションは「S-2 以降で表示」プレースホルダ。
- `nav-items.ts` に `/products` を追加（または既存項目を `enabled: true`）。
- 1A-12 手動採番導線の撤去（§6）。
- tsc clean 確認 → **コミット2（UI）**。

### Phase 4: PR & デプロイ
- feature ブランチ → push → PR 作成（**コード変更ありなので PR 必須**。main 直 push 不可）。
- dev で動作確認（§8）→ PR マージ → main 最新化 → ブランチ削除 → Railway デプロイ確認。

---

## 8. 動作確認チェックリスト

### 基本CRUD（master-patterns §11 相当）
- [ ] 新規作成: Brand/Season/Category 選択で productCode プレビュー表示 → 保存で確定。
- [ ] 詳細表示: 全カード正しく表示、ProductStatusHistory に初期 status が記録。
- [ ] 一覧表示: フィルタ（Brand/Category/Status/Season）と検索が動作。
- [ ] 編集: status 変更が ProductStatusHistory に追記される。productCode は編集不可。
- [ ] アーカイブ → 復元。
- [ ] 物理削除（MASTER_ADMIN / ARCHIVED / 確認コード一致 / usage 0件）。

### S-1 固有
- [ ] 採番連番: 同一 Brand×Season×Category で 001→002 と進む。別カテゴリは別カウント。
- [ ] カテゴリ未選択では保存できない（§3-3 の必須化）。
- [ ] ModelCode モードA（既存選択）で紐付く。
- [ ] ModelCode モードB（新規発番）で `M-{brandCode}-{連番}` が同時生成され Product に紐付く。
- [ ] 1A-12 の ModelCode 新規作成導線が一般ユーザーから見えない（MASTER_ADMIN のみ到達可）。
- [ ] clientId 必須・modelCodeId 必須が保存時に保証される。

---

## 9. 環境安全 & Git 運用

- **schema 無変更見込み**のため、CRUD 動作確認は **dev 優先**（dev=7492/hopper:12921）。本番（ab6d/shuttle:16099）は smoke test のみ。データ作成操作の直前に URL/接続先で dev を確認（`shunya-environment-safety-check`）。
- 万一 migration が必要になった場合は本指示を一旦停止し、dev 検証 → 本番は別途明示指示 ＋ host 照合 ＋ 三重ガードに切り替える。
- Git: **コードを含むため PR 必須**（`shunya-git-workflow`）。docs（本指示書・議事録 v1.0）は main 直 push 可。

---

## 10. 慎太郎さんへの確認事項（実装着手前）

1. **§3-3 カテゴリ必須化**: 採番のため Product 作成フォームで `categoryId` を必須にしてよいか（schema は optional 据え置き）。→ これがないと品番が採番できないため、原則 Yes 想定。
2. **§6 撤去方式**: 1A-12 手動採番UI を「導線非表示＋MASTER_ADMIN ガードで温存」（完全削除は後日）で進めてよいか。

上記2点 OK であれば、本指示書を Claude Code に渡して S-1 着手可能。
