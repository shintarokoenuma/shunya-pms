【対象プロジェクト】shunya-pms（生産管理システム）
  - リポジトリ: shintarokoenuma/shunya-pms
  - ローカルパス: ~/shunya-production-system
  - 本番URL: shunya-pms-web-production.up.railway.app
  - ※ saagara-v2（saagara-v2-production / 別リポジトリ）とは別物。
    このウィンドウが ~/shunya-production-system を開いているか着手前に必ず目視確認すること。

---

# S-1 実装指示書 — Product（品番カルテ）基本CRUD

- 日付: 2026-06-06
- 上位仕様: `docs/specs/product-sample-spec-confirmation-v1_0-2026-06-06.md`（main・コミット e0a3130）
- 段階: 業務トランザクション「最初の山」の S-1。順序は S-1 → S-2 → S-3a → S-3 → S-4。
- 前提: **Product 本体 schema は無変更（migration なし）**。dev で動作確認、本番は smoke test。
- ブランチ: main 最新（`f7e87e7` 以降）から `feature/s-1-product-crud-v2` を新規に切る。
  既存の `feature/s-1-product-crud`（2026-06-03 作成）は古い別物なので使わない。衝突回避で `-v2`。
- Git運用: コードを含むため PR 必須（main 直 push 禁止）。論理層コミット → UI コミット → PR。

---

## 0. 最初にやること（着手前ガード・順守）

1. **ウィンドウ確認**: VS Code が `~/shunya-production-system` を開いているか目視。saagara-v2 でないこと。
2. **ブランチ作成**:
   ```
   cd ~/shunya-production-system
   git checkout main && git pull origin main
   git checkout -b feature/s-1-product-crud-v2
   ```
3. **スキーマ真値確認（最重要・コード変更前に必ず）**: プロジェクト知識の .prisma はスナップショットでありライブと乖離しうる。実装前に横断 grep で以下を実物確認すること。1つでも食い違ったら**コードを書かず慎太郎さん（Claude.ai）に報告**。
   ```
   # Product 本体
   grep -n "model Product " prisma/schema.prisma
   awk '/^model Product /,/^}/' prisma/schema.prisma
   # 確認ポイント:
   #  - modelCodeId が String（必須・? なし）であること ← 本指示書の自動発番設計の前提
   #  - clientId String（必須）/ brandId String（必須）/ categoryId String?（任意）
   #  - clientProductCode String?（任意）/ productName String（必須）/ season String / year Int
   #  - status ProductStatus @default(PLANNING) / deletedAt DateTime?（論理削除欄あり）
   #  - リレーション: modelCode（必須）, statusHistory ProductStatusHistory[]

   # 関連
   awk '/^enum ProductStatus /,/^}/' prisma/schema.prisma
   awk '/^model ProductStatusHistory /,/^}/' prisma/schema.prisma
   awk '/^model ModelCode /,/^}/' prisma/schema.prisma
   awk '/^enum ModelCodeStatus /,/^}/' prisma/schema.prisma
   grep -n "brandCode\|clientId" prisma/schema.prisma | grep -i brand
   grep -n "categoryCode" prisma/schema.prisma
   ```
   想定真値（スナップショット時点）:
   - `Product.modelCodeId String`（**必須**）→ ModelCode 無しでは保存不可。本指示書は「裏で自動発番」で必ず埋める。
   - `ProductStatus` = PLANNING / SAMPLE_REQUESTED / SAMPLE_IN_PROGRESS / SAMPLE_APPROVED / ORDERING_PERIOD / ORDER_CONFIRMED / MASS_PRODUCTION / INSPECTION / DELIVERED / COMPLETED / CANCELLED / ON_HOLD / ARCHIVED
   - `ProductStatusHistory` = fromStatus? / toStatus / changedByUserId? / changeReason? / changedAt
   - `ModelCode` = modelCode（必須・`M-{brandCode}-{4桁}`）/ brandId（必須）/ modelName（**必須**）/ categoryId? / status ModelCodeStatus @default(ACTIVE)
   - `Brand.clientId`（必須）/ `Brand.brandCode`（VarChar20・略号 例 MK）
   - `ProductCategory.categoryCode`（VarChar10・例 TS/JK/PT）

**migration は作らない・実行しない。** schema 無変更が S-1 の前提。`prisma migrate` 系は禁止。

---

## 1. S-1 のスコープ

Product（品番カルテ）の基本CRUD一式を、`docs/shunya-master-patterns.md` の流儀（8関数・命名・archive/restore/物理削除分離・auditLog 自動記録・フォーム構成）に準拠して実装する。Product はマスターでなくトランザクションだが、**CRUD の作法は master-patterns を precedent として踏襲**する（新規パターンを持ち込まない）。

スコープ内:
- 社内品番の自動採番（保存時確定・選択時プレビュー）
- ModelCode の**裏での自動発番**（UI 非表示・modelCodeId を必ず埋める）
- 先方品番（clientProductCode）入力欄の常設
- 品番表示の主従切替ヘルパー
- status（ProductStatus）の扱い ＋ ProductStatusHistory への記録
- archive / restore（履歴ベース）/ checkUsage / 物理削除
- 一覧（検索・フィルタ・ページネーション）・詳細・新規・編集
- 1A-12 手動採番UI の導線撤去（案2・可逆）

スコープ外（やらない）:
- リピート/型の串・パターン版管理（→ B-025・将来の山）
- SampleProduction / 進行チェックリスト / 発注連携（→ S-2 以降）
- 価格 UI の作り込み（samplePrice / massUnitPrice 等は当面フォームに出さないか read-only 最小）
- ProductPrice / Incoterms（feat/currency-prices-incoterms に保全棚上げ済 8f821f5・本 PR では一切触れない）

---

## 2. 社内品番の採番

- フォーマット: `{Brand.brandCode}-{season}-{ProductCategory.categoryCode}-{連番3桁}`
  - 例: `MK-26SS-TS-001`
  - 連番は `companyId × brandId × season × categoryId` の組み合わせごとに 001 から、3桁ゼロ埋め。
- 採番タイミング: **保存時に transaction 内で連番を再計算して確定**（同時作成の競合を避ける）。フォーム上では選択中の Brand / season / category から**プレビュー表示**（確定値ではない旨を明示、例: 「採番プレビュー: MK-26SS-TS-### / 保存時に確定」）。
- `@@unique([companyId, productCode])` があるため、万一の衝突時はリトライ（連番+1 で再試行）するか、transaction 内 `count`→採番で確実化。既存マスターの採番実装を precedent に。
- **categoryId は採番に必須**。schema は optional のままだが、**Zod で必須化**（後述 §6）。

---

## 3. ModelCode の自動発番（A案・schema 変更なし）

`Product.modelCodeId` は必須（NOT NULL）。S-1 では ModelCode を UI に一切出さないが、**createProduct の同一 transaction 内で ModelCode を1件自動発番して紐づける**。これで NOT NULL を満たしつつ migration を回避する。

自動発番の内容:
- `modelCode`: `M-{Brand.brandCode}-{連番4桁}`（例 `M-MK-0001`）。連番は `companyId × brandId` ごとに 0001 から。`@@unique([companyId, modelCode])` 準拠で transaction 内確定。
- `brandId`: フォームで選択された Brand。
- `modelName`: **必須**。Product の `productName` をそのまま流用（ユーザーは ModelCode を意識しないため）。
- `categoryId`: Product の categoryId を流用（任意）。
- `status`: `ModelCodeStatus.ACTIVE`（default）。
- 著作権系（patternOwnership / designOwnership）は default（SHUNYA）に任せる。

注意:
- 既存 ModelCode の「選択」UI は S-1 では出さない（リピートは量産=B-025 の領域）。S-1 は常に新規自動発番でよい。
- ModelCode の累積データ（totalRepetitions 等）は S-1 では更新しない（後続）。
- ModelCode と Product の社内品番採番を**同一 transaction**で行い、片方だけ採番される事故を防ぐ。

---

## 4. 先方品番・品番表示の主従切替

- `clientProductCode`（任意）の入力欄を新規・編集フォームに**常設**。サンプル期は空でよく、量産確定時に入力する運用。
- **表示ヘルパーを新規作成**（例 `src/lib/utils/product-code.ts` などプロジェクト規約に沿う場所）:
  - 主表示 = `clientProductCode || productCode`
  - 副表示 = 社内品番（productCode）を常に併記
  - 一覧テーブル・詳細ヘッダ・将来の帳票で共通利用。S-1 の時点でこのヘルパー経由に統一しておく（量産で先方品番が主役になっても作り直し不要にするため）。

---

## 5. status の扱いと ProductStatusHistory

- status は既存 `ProductStatus` enum を使用（enum 追加なし）。
- S-1 でUIから扱うのはサンプル系の遷移: PLANNING / SAMPLE_REQUESTED / SAMPLE_IN_PROGRESS / SAMPLE_APPROVED。量産系（ORDERING_PERIOD 以降）は値としては持つが S-1 では「箱」として表示・選択可能にするだけ（積極操作は後続）。
- **status を変更したら必ず `ProductStatusHistory` に1行記録**（fromStatus / toStatus / changedByUserId / changeReason?）。createProduct 時は from=null, to=PLANNING（または初期選択値）を記録。
- 日本語ラベル・バッジ色は master-patterns の labels.ts パターンに準拠（`PRODUCT_STATUS_LABELS` / `_BADGE_VARIANT` を `_components/labels.ts` に定義、共通モジュールがあれば re-export）。

---

## 6. archive / restore / 物理削除（master-patterns §6 準拠・Product 流に調整）

Product はマスターの ACTIVE/PAUSED/ARCHIVED と異なり ProductStatus を使うため、以下に調整する。

- **archiveProduct**: status を `ARCHIVED` に変更（通常権限）。直前 status を ProductStatusHistory に記録（from=現在, to=ARCHIVED）。
- **restoreProduct（履歴ベース・確定方式）**: ProductStatusHistory を遡り、**ARCHIVED にする直前の status（最後の非 ARCHIVED toStatus）を復元先**とする。復元できる履歴が無い場合は PLANNING にフォールバック。復元も ProductStatusHistory に記録（from=ARCHIVED, to=復元先）。
- **checkProductUsage**: 物理削除前ガード。紐付き件数を確認（最低限 `skus`、存在すれば `statusHistory`・将来の sampleProductions / WO / PO 等。スナップショット時点の Product リレーションを grep で確認し、存在する子のみカウント）。
- **deleteProductPermanently**: MASTER_ADMIN のみ・status===ARCHIVED のみ・確認入力（`confirmationName === product.productName`）・checkUsage 0件。`runWithoutTenantContext` 内で子（ProductStatusHistory 等 onDelete:Cascade でないもの）を先に整理してから本体 delete。auditLog に DELETE 記録。既存マスターの物理削除を precedent に。

すべての関数で **auditLog 自動記録**（CREATE/UPDATE/ARCHIVE/RESTORE/DELETE）。update の AuditLog snapshot は、B-006/B-015 と同じく**業務スカラを網羅**し、`ProductScalarFieldEnum` ベース + `satisfies Record<…, unknown>` の型保険を入れて将来のスカラ追加漏れをコンパイルエラーで検知できるようにする（B-021 の横展開と整合）。

---

## 7. Server Action 8関数（`src/lib/actions/products.ts`）

master-patterns §5 準拠。`ActionResult<T>` = `{ ok, data } | { ok, error }`。

| 関数 | 役割 |
|---|---|
| `listProducts` | 一覧（検索・フィルタ・ページネーション） |
| `getProduct` | 詳細取得 |
| `createProduct` | 新規作成（社内品番採番 + ModelCode 自動発番 + 初期 status 履歴記録を**同一 transaction**） |
| `updateProduct` | 更新（status 変更時は履歴記録。AuditLog snapshot 網羅 + 型保険） |
| `archiveProduct` | status を ARCHIVED に + 履歴記録 |
| `restoreProduct` | 履歴ベースで直前 status に復元 + 履歴記録 |
| `checkProductUsage` | 物理削除前の紐付き確認 |
| `deleteProductPermanently` | 物理削除（MASTER_ADMIN・ARCHIVED・確認入力・usage0） |

検索（listProducts）の絞り込みは実務に合わせ **ブランド / 品名（productName 部分一致）/ 社内品番 / 先方品番 / season / status** を最低限サポート（ModelCode 検索は出さない）。

---

## 8. バリデータ（`src/lib/validators/product.ts`）

- `productInputSchema` / `ProductInput` / `ProductFormValues` / `productListParamsSchema` / `ProductListParams`。
- **必須**: productName, brandId, season, year, categoryId, status。
  - `categoryId` は schema 上 optional だが **Zod で必須**（採番に必要なため）。
- **任意**: clientProductCode, inquiryId, description, silhouette, 各数量, 納期, internalNotes 等。
- **clientId はフォーム入力させず、選択された brandId から導出**（`Brand.clientId`）。create/update の action 内で Brand を引いて clientId をセットする。フォームに clientId 欄は出さない。
- productCode（社内品番）と modelCodeId はフォーム入力させない（採番・自動発番）。

---

## 9. UI（`src/app/(app)/products/…`）

master-patterns §9 のフォーム構成・命名（単数/複数）に準拠。

- `_components/product-form.tsx`（新規・編集兼用。カード構成: 基本情報 / 品番・分類 / シーズン / 担当者 / 数量・納期 / メモ 等。価格カードは S-1 では出さないか最小）
- `_components/product-delete-button.tsx`
- `_components/products-table.tsx`（品番表示は §4 ヘルパー経由・status バッジ）
- `_components/products-search.tsx`
- `_components/products-pagination.tsx`
- `_components/labels.ts`（PRODUCT_STATUS_LABELS / _BADGE_VARIANT 等）
- `page.tsx`（一覧）/ `new/page.tsx`（新規）/ `[id]/page.tsx`（詳細）/ `[id]/edit/page.tsx`（編集）
- ナビゲーション（nav-items.ts）に「品番カルテ（Products）」を追加 or 既存項目を `enabled: true`。

採番プレビュー: Brand / season / category 選択時に社内品番プレビューを表示（保存時確定の注記つき）。ModelCode はUIに一切出さない。

---

## 10. 1A-12 手動採番UI の導線撤去（案2・可逆）

- **ModelCode 新規作成（`model-codes/new`）**: サイドバー等の導線（リンク/ボタン）を**非表示**。ページファイル・action は**削除しない**。直 URL 到達時は **MASTER_ADMIN ロールでガード**（非管理者は 403 または一覧へリダイレクト。既存の権限ガードのパターンを踏襲）。
- **ModelCode 一覧（`model-codes`）**: 前面ナビからは**下げる**（ModelCode は裏方の串でユーザーが回覧する対象でないため）。ファイルは温存。必要なら MASTER_ADMIN 限定で残す。
- コードに撤去理由のコメントを残す: 「S-1 で ModelCode は Product 作成時の裏側自動発番に移行。手動単独採番の導線は撤去（可逆）。完全削除は本番安定後に B 枠で別タスク。」
- 削除でなく無効化（このプロジェクトの DELETE 回避方針に準拠）。ビルドが壊れないよう参照を残す。

---

## 11. コミット・PR の流れ

1. **論理層コミット**: validators / labels / actions（8関数）/ 表示ヘルパー。`tsc` clean 確認後コミット。
2. **UI コミット**: form / table / search / pagination / delete-button / pages / nav。`tsc` clean 確認後コミット。
3. push → PR 作成（base: main, head: feature/s-1-product-crud-v2）。
4. PR 説明に: スコープ・schema 無変更（migration なし）・ModelCode 自動発番（A案）・1A-12 導線撤去（案2）・動作確認観点を記載。
5. **本指示書では push まで。マージは慎太郎さんの確認後**（dev 動作確認 → 本番 smoke test の段取りは別途）。

---

## 12. 動作確認（dev・PR マージ前にローカル/dev で）

接続先が dev（`hopper.proxy.rlwy.net:12921` / postgres-7492）であることを `grep -E '^DATABASE_URL' .env` のホストで確認してから実施。**本番（shuttle:16099）には触れない。**

1. 新規作成: Brand/season/category を選んで Product 1件作成 → 社内品番が `MK-26SS-TS-001` 形式で採番され、裏で ModelCode が自動発番・紐づく（DBで modelCodeId が埋まっていること、product_status_history に初期行が入ること）。
2. 詳細表示: 全フィールド表示。品番は主従ヘルパーで表示（clientProductCode 未入力なら社内品番が主）。
3. 一覧表示: ナビから遷移、作成分が表示。検索（品名・社内品番・先方品番・ブランド・status）が効く。
4. 編集: clientProductCode を入力して保存 → 一覧/詳細で主表示が先方品番に切替。status を変更 → product_status_history に追記。
5. アーカイブ: status→ARCHIVED、履歴記録。
6. 復元: 履歴ベースで直前 status に戻る。
7. 物理削除: テスト用 Product（ARCHIVED）で MASTER_ADMIN 確認入力 → checkUsage0 → 削除、auditLog に DELETE。
8. ModelCode 導線が前面から消えていること / `model-codes/new` 直URLが非 MASTER_ADMIN で弾かれること。

---

## 13. 完了報告に含めること

- 触ったファイル一覧、`tsc` 結果、migration を作っていないことの明示。
- dev での社内品番採番例・modelCodeId 自動発番の実値（DB プローブ結果）。
- スキーマ真値確認（§0-3）の結果（想定と一致したか／差異があれば内容）。
- 1A-12 導線撤去の実装箇所（どのファイルで導線を消し、どこに MASTER_ADMIN ガードを置いたか）。
