# Phase 1A-8（諸経費カテゴリ）完遂報告 + Phase 1A-11（バイヤー）引き継ぎメモ

**作成日**：2026-05-25
**作成者**：Shin（肥沼慎太郎）+ Claude
**前セッション**：Phase 1A-8（諸経費カテゴリ）実装完遂
**次セッション**：Phase 1A-11（バイヤー）→ Phase 1A-10（納品先）の連続実装

---

## 1. 概要

### 1.1 完遂内容（Phase 1A-8）

Phase 1A-8 では **諸経費カテゴリ（ExpenseCategory）マスター** の CRUD 機能を実装し、本番デプロイまで完遂した。Phase 1A-7（商品カテゴリ）に続く 2 つ目の「抽象マスター」（連絡先・住所なし、enum で分類するシンプルなマスター）。

- PR #19（`feat/expense-category`）マージ済み（merge commit `643f05f`）
- 本番 URL `https://shunya-pms-web-production.up.railway.app/expense-categories` で動作確認 OK
- 動作確認 7 項目すべてクリア（残置データ：PATTERN_FEE 1 件）

### 1.2 次に着手する Phase の選択ロジック

Phase 1A の残りは `1A-9(為替レート)/ 1A-10(納品先)/ 1A-11(バイヤー)/ 1A-12(モデルコード)/ 1A-13(生地・副資材)/ 1A-14(CSV)`。番号順ではなく **Phase 1A-11（バイヤー）→ Phase 1A-10（納品先）** の順で着手する。理由：

| Phase | 順序を変える理由 |
|---|---|
| 1A-9 為替レート | 時系列データという特殊性により標準パターン外。設計議論からスタートする必要があり、別日のクリアな頭で取り組みたい。Phase 1B（見積もりエンジン）との結合が深いため、Phase 1A 末尾 or Phase 1B 突入直前にリスケ推奨 |
| 1A-10 納品先 | `DeliveryDestination.buyerId` が **必須 FK（`onDelete: Cascade`）** であるため、Buyer 未実装では新規作成テストすら通せない。**1A-11 完遂後の即着手が前提** |
| 1A-11 バイヤー | 単独で完結する小規模業務マスター（`Buyer.clientId` は optional のため Client さえあれば実装可能）。1A-10 の前提条件 |

→ **（B-1） スプリント = 1A-11 → 1A-10 連続実装** が今日の本実装。所要時間 4-5 時間想定。

---

## 2. Phase 1A-8 完遂報告

### 2.1 実装履歴（4 フェーズ・4 コミット）

| Phase | コミット SHA | 行数 | 内容 |
|---|---|---|---|
| Phase 1：スキーマ整合 | `49d41d5` | +47 / -6 | ExpenseCategory 仕様確定 v1.0 整合（`status` を `ExpenseCategoryStatus` enum 化 / `calculationType` 3 値化（FIXED/PER_UNIT/PERCENTAGE） / 名称 100 字に短縮）|
| Phase 2：論理層 | `793a174` | +829 | validator / labels / actions（8 関数 + `formatAmount` ヘルパー）|
| Phase 3：UI | `706b389` | +1,418 | 4 ページ + 5 コンポーネント + shadcn Alert 導入 + nav-items 更新 |
| Phase 4：PR & デプロイ | merge commit `643f05f`（PR #19）| - | main マージ・本番反映・動作確認 7 項目クリア |
| **合計** | - | **+2,294 行 / 14 ファイル** | - |

### 2.2 動作確認 7 項目

| # | 項目 | 結果 |
|---|---|---|
| 1 | 新規作成 | ✅ FIXED パターン（PATTERN_FEE / パターン代 / ¥30,000）+ PERCENTAGE パターン（ROYALTY / ロイヤリティ / 3%）|
| 2 | 詳細表示 | ✅ 全フィールド正しく表示、PERCENTAGE は「3%」表記 |
| 3 | 一覧表示 | ✅ 検索 + 費用種別フィルタ + クリア動作 |
| 4 | 編集 | ✅ |
| 5 | アーカイブ | ✅ |
| 6 | 復元 | ✅ |
| 7 | 物理削除 | ✅（MASTER_ADMIN 確認込み）|

### 2.3 残置データ

- PATTERN_FEE（パターン代 / ¥30,000）1 件を本番に残置
- 理由：Phase 1A-14（CSV インポート機能）の動作確認時にサンプルとして活用
- ROYALTY（3%）は物理削除済み

---

## 3. 本セッションで確立されたパターン

Phase 1A-8 では、Phase 1A-7（商品カテゴリ）で確立した「抽象マスター」パターンを 2 例目として量産する過程で、以下の 5 つの新パターンが確立された。

### 3.1 抽象マスター v2（ProductCategory + ExpenseCategory）

「連絡先・住所なし、enum で分類するシンプルなマスター」のテンプレートが 2 例で確立した。今後の小規模マスター（Material のカテゴリ系等）はこれを土台に量産可能。

### 3.2 Decimal の型ガード `"toNumber" in amount`

```typescript
function formatAmount(
  amount: Prisma.Decimal | number | null | undefined,
  currency: Currency
) {
  if (amount == null) return "-"
  const num = typeof amount === "number"
    ? amount
    : "toNumber" in amount
      ? amount.toNumber()
      : Number(amount)
  // ...
}
```

**ポイント**：Prisma.Decimal とプレーン number の両方を受けるユーティリティで、Decimal 型ガードに `instanceof` ではなく `"toNumber" in amount` を使うことで、TS の型推論が一発で通る（Server Action から渡ってくる時にプレーン化されているケースを安全にハンドル）。

### 3.3 PERCENTAGE 連動 UI（form.watch + 動的ラベル + Select disabled）

```typescript
const calculationType = form.watch("calculationType")
const isPercentage = calculationType === "PERCENTAGE"

// ラベル:「標準金額」⇄「標準金額 (%)」
// 通貨 Select:isPercentage 時 disabled
```

**ポイント**：入力 UI の整合性を form 側で吸収（バックエンドのバリデーション任せにせず、ユーザー入力時点で誤入力を防ぐ）。同パターンは将来 `calculationType` を持つ他マスターでも再利用可能。

### 3.4 shadcn Alert 初導入

`expense-category-delete-button.tsx` で参照件数アラートを表示するために `npx shadcn@latest add alert` を初導入。Claude Code が事前確認して自動 add してくれたが、**手動実装時には `ls src/components/ui/` で導入済みコンポーネントを事前確認するステップ** を推奨に追加。

→ `shunya-master-patterns.md` v1.2 改訂候補（後述）。

### 3.5 Railway 自動 `prisma migrate deploy` 検知

Phase 1A-7 では migration 自動実行で詰まったと記録していたが、Phase 1A-8 では問題なく適用されたことから、**Railway 側（Railpack の Node ビルド検出）が `prisma migrate deploy` を自動実行している** と確定。

- ビルドログには明示されない
- 結果として本番 DB に確実に反映される
- 手動 `DATABASE_URL=... npx prisma migrate deploy` は緊急時のみで OK

---

## 4. shunya-master-patterns.md v1.2 改訂候補

本セッション完遂後、（D）ステップで実施予定の改訂項目（軽量・30 分想定）：

| 追加先 | 内容 |
|---|---|
| §2 ファイル配置規約 | 抽象マスター（連絡先なし）の場合の簡略構造を明示（Contact 関連ファイル不要）|
| §3 スキーマパターン | 「抽象マスターの場合」セクション追加（id / companyId / `<master>Code` / `<master>Name` / `<master>NameEn` / status / タイムスタンプ + 固有 enum）|
| §8 共通モジュール | 抽象マスターでも `labels.ts` で共通モジュール re-export を徹底する原則（変えない）|
| §9 フォーム構成 | 抽象マスターは標準 7-8 カードではなく **2-4 カード** に簡略化可（基本情報 / 分類 / 金額・計算方法 / メモ）|
| §10 Phase 2 判定基準 | Decimal の `formatAmount` ヘルパーパターンを §3 or §9 に追加 |
| §12 実装手順 | shadcn コンポーネント事前確認ステップを Phase 3（UI）の最初に挿入 |
| §13 拡張ニーズ | Railway 自動 migrate deploy 検知の運用ルールを追記（緊急時の手動 deploy 手順含む）|
| §15 参考実装 | ExpenseCategory の各ファイルへの参照を追加（抽象マスターのお手本として）|
| 改訂履歴 | v1.2（2026-05-25 / Phase 1A-7 + 1A-8 完遂を反映）|

---

## 5. Phase 1A 進捗状況

```
✅ 1A-1  クライアント        (Client + Contact)
✅ 1A-2  ブランド            (Brand)
✅ 1A-3  仕入先              (Supplier + Contact)
✅ 1A-5  工場                (Factory + Contact)
✅ 1A-6  外注先              (Contractor + Contact)
✅ 1A-7  商品カテゴリ        (ProductCategory、抽象マスター)
✅ 1A-8  諸経費カテゴリ      (ExpenseCategory、抽象マスター)← 本セッション完遂

⏳ 1A-11 バイヤー            ← 次セッション着手(小規模業務マスター)
⏳ 1A-10 納品先              ← 1A-11 完遂後の即着手
⏳ 1A-9  為替レート          ← 別日リスケ(標準パターン外、要設計議論)
⏳ 1A-12 モデルコード        ← 中規模、案件側に近づく
⏳ 1A-13 生地・副資材        ← 大規模(HS コード・組成・原産国含む)
⏳ 1A-14 CSV 一括機能        ← 全マスターをまとめて
```

進捗 **7/13（54%）** → 1A-11 + 1A-10 連続実装完遂で **9/13（69%）** 見込み。

---

## 6. Phase 1A-11（バイヤー）着手方針

### 6.1 元設計（`02_masters.prisma` 610-644 行）

```prisma
/// バイヤー(小売・卸の会社)
model Buyer {
  id        String @id @default(uuid())
  companyId String @map("company_id")

  // 関連クライアント(このバイヤーがクライアントの取引先)
  clientId  String? @map("client_id")  // ← OPTIONAL (任意紐付け)

  // 基本情報
  buyerCode   String  @map("buyer_code") @db.VarChar(50)
  buyerName   String  @map("buyer_name") @db.VarChar(255)
  buyerNameEn String? @map("buyer_name_en") @db.VarChar(255)

  // 連絡先(単一フィールド、4分割なし)
  address String? @db.Text
  phone   String? @db.VarChar(50)
  email   String? @db.VarChar(255)

  // メモ
  notes String? @db.Text

  // ステータス(String のまま、要 enum 化)
  status String @default("ACTIVE") @db.VarChar(20)

  // タイムスタンプ
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  // リレーション
  deliveryDestinations DeliveryDestination[]

  @@unique([companyId, buyerCode])
  @@index([companyId, clientId])
  @@map("buyers")
}
```

### 6.2 ⚠️ 重要：`clientId` は optional

元設計では `clientId String?`（optional）。これは仕様確定 v1.0 で意図された設計で、以下のような業務シナリオを想定している：

- **大手バイヤー（例：BEAMS）が複数 Client にまたがって存在しうる**：MARKA でも他クライアントでも同じバイヤーが買い手になるケース
- **クライアント未紐付けのバイヤーを先行登録**：Client と Buyer の登録順序を強制しない

→ Phase 1A-11 実装時はこの設計意図を尊重し、optional のまま実装。**仕様確定議論で「必須化するか?」は論点として扱う**（推奨：optional のまま）。

**事前確認事項（Phase 1 着手前に）**：
```bash
grep -A 5 "^model Buyer" prisma/schema.prisma | head -15
# clientId が String? のままか、または String に変更されているかを確認
# Phase 1A-1 (Client) 実装時に変更された可能性は低いが念のため
```

### 6.3 既実装マスターとの対比

| 観点 | Client / Supplier / Factory / Contractor | ProductCategory / ExpenseCategory | **Buyer** |
|---|---|---|---|
| 抽象 / 業務 | 業務 | 抽象（分類用） | **業務（小規模）** |
| Contact モデル | あり | なし | **なし**（連絡先は単一フィールド）|
| 住所 | 4分割（country / postalCode / prefecture / city / address）| なし | **Text 単一**（要議論）|
| FK | なし（または親なし）| なし | **clientId（任意）** |
| status | enum 化済 | enum 化済（v2 で確立）| **String のまま** → enum 化必要 |
| chatTool / preferredLang | あり | なし | **なし**（海外バイヤーは Phase 2 想定）|
| 取引条件 | あり（PaymentTermType 等）| なし | **なし**（バイヤーは取引主体ではなく「納品先候補」役）|

### 6.4 Phase 1A-8 からの引き継ぎポイント

- **status enum 化必須**（Phase 1A-8 と同じ手当、`BuyerStatus` 新設）
- **抽象マスター v2 テンプレートは部分流用可**：Contact なし、住所なし（単一 Text）、chatTool なし、取引条件なし、というシンプルさは類似
- **業務マスター要素**：clientId FK（optional）、検索時の Client 名称参照（join）

### 6.5 仕様確定議論の論点（次セッション冒頭で）

| # | 論点 | 選択肢 |
|---|---|---|
| 1 | `BuyerStatus` enum の値 | （a） `ACTIVE / ARCHIVED`（ExpenseCategory 踏襲）/ （b） `ACTIVE / PAUSED / ARCHIVED`（Supplier 踏襲）|
| 2 | `clientId` を必須化するか | （a） **optional のまま**（仕様確定 v1.0 維持）/ （b） 必須化（schema 変更）|
| 3 | 住所を 4分割に揃えるか | （a） Text 単一のまま（仕様確定 v1.0 維持・最短）/ （b） 4 分割化（shunya-master-patterns 整合・schema 変更）|
| 4 | Contact モデル追加するか | （a） なし（単一連絡先想定）/ （b） BuyerContact モデル新設（複数担当者対応）→ MVP では （a） が妥当 |
| 5 | 海外バイヤー対応（country / preferredLanguage / preferredCurrency）| （a） Phase 2 送り（仕様確定 v1.0 維持）/ （b） 今追加 |
| 6 | 検索仕様 | （a） buyerCode + buyerName のみ / （b） Client 名称も join 検索対象 / （c） clientId フィルタ追加 |
| 7 | Client との関係を UI でどう見せるか | （a） Buyer 詳細ページに Client へのリンクのみ / （b） Client 詳細ページに Buyer 一覧表示 / （c） 両方 |

**事前の私の推奨**：
- 1：**（a） `ACTIVE / ARCHIVED`**（抽象マスター v2 と揃える、シンプル原則）
- 2：**（a） optional のまま**（仕様確定 v1.0 維持、業務シナリオ尊重）
- 3：**（a） Text 単一のまま**（仕様確定 v1.0 維持、Phase 2 で 4 分割化検討）
- 4：**（a） なし**（小規模業務マスター原則）
- 5：**（a） Phase 2 送り**
- 6：**（a） + （c）**（buyerCode + buyerName 検索 + clientId フィルタ）
- 7：**（a） Buyer 詳細 → Client へのリンク**（Client 詳細の Buyer 一覧は 1A-10 完遂後の Phase 1B 突入時に検討）

→ 議論時間 30 分目安、その後実装着手で 1A-11 全体は 2-2.5 時間想定。

### 6.6 実装手順（標準フロー）

shunya-master-patterns.md §12 のチェックリストに従う：

```
Phase 1: スキーマ
  □ BuyerStatus enum 新設(ACTIVE / ARCHIVED)
  □ status カラムを String → BuyerStatus enum 化
  □ Buyer.clientId は optional のまま維持(要確認)
  □ マイグレーション実行(既存件数確認)

Phase 2: 論理層
  □ src/lib/validators/buyer.ts
  □ src/app/(app)/buyers/_components/labels.ts
  □ src/lib/actions/buyers.ts(8 関数)
  □ tsc clean 確認
  □ 論理層コミット

Phase 3: UI
  □ buyer-form.tsx(4 カード想定:基本情報 / 関連クライアント / 連絡先 / メモ)
    - Client 選択:コンボボックス(既存パターン踏襲)、「指定なし」可
  □ buyer-delete-button.tsx
    - 参照件数:deliveryDestinations[] のカウント
  □ buyers-table.tsx
    - 表示列:buyerCode / buyerName / Client名(join)/ status / 操作
  □ buyers-search.tsx + buyers-pagination.tsx
    - 検索:buyerCode + buyerName / フィルタ:clientId + status
  □ page.tsx / new/page.tsx / [id]/page.tsx / [id]/edit/page.tsx
  □ nav-items.ts 更新(「バイヤー」エントリ、アイコン候補:Store / ShoppingBag / UsersRound)
  □ tsc clean 確認
  □ UI コミット

Phase 4: PR & デプロイ
  □ push → PR #20 想定
  □ マージ → 本番反映
  □ 動作確認 7 項目
```

---

## 7. Phase 1A-10（納品先）への接続

1A-11（Buyer）完遂後、即座に 1A-10（DeliveryDestination）に着手。

### 7.1 元設計（`02_masters.prisma` 647-687 行）

```prisma
/// 納品先(バイヤーの店舗・倉庫等)
model DeliveryDestination {
  id        String @id @default(uuid())
  companyId String @map("company_id")
  buyerId   String @map("buyer_id")  // ← 1A-11 で実装した Buyer に依存(NOT NULL)

  destinationCode String @map("destination_code") @db.VarChar(50)
  destinationName String @map("destination_name") @db.VarChar(255)  // 例:BEAMS渋谷店

  // 住所(4分割)
  postalCode String? @map("postal_code") @db.VarChar(20)
  country    String  @default("JP") @db.VarChar(2)
  prefecture String? @db.VarChar(50)
  city       String? @db.VarChar(100)
  address    String? @db.Text

  // 連絡先
  contactPerson String? @map("contact_person") @db.VarChar(255)
  phone         String? @db.VarChar(50)
  email         String? @db.VarChar(255)

  // 配送指示
  deliveryNotes          String? @map("delivery_notes") @db.Text
  preferredDeliveryDays  String? @map("preferred_delivery_days") @db.VarChar(255)  // 例:火・木
  preferredDeliveryHours String? @map("preferred_delivery_hours") @db.VarChar(255)  // 例:10:00-15:00

  // ステータス(String のまま、要 enum 化)
  status String @default("ACTIVE") @db.VarChar(20)

  // ...

  buyer Buyer @relation(fields: [buyerId], references: [id], onDelete: Cascade)

  @@unique([companyId, destinationCode])
  @@index([companyId, buyerId])
  @@map("delivery_destinations")
}
```

### 7.2 Buyer との非対称性に注目

- Buyer：住所 Text 単一 / 配送指示なし
- DeliveryDestination：住所 **4分割あり** / 配送指示あり

→ 「Buyer は連絡先まとめ役、DeliveryDestination は実配送先」という業務的役割の違いが反映されている。これは仕様確定 v1.0 のまま維持で OK と判断。`AddressFields` 共通コンポーネントは流用可能。

### 7.3 1A-10 着手時の主な論点

| # | 論点 | 推奨 |
|---|---|---|
| 1 | `DeliveryDestinationStatus` enum | `ACTIVE / ARCHIVED` |
| 2 | Buyer 選択 UI（コンボボックス / モーダル / リンク先で作成）| コンボボックス（既存パターン踏襲）|
| 3 | 配送指示 3 フィールドの UI | 1 カードにまとめる |
| 4 | 配送日 / 配送時間帯の入力形式 | フリーテキスト（仕様確定 v1.0 通り、Phase 2 で改善）|
| 5 | 物理削除時の警告 | DeliveryNote から参照されている場合の表示（Phase 1D で本格的にチェック）|

### 7.4 想定所要時間

実装パターンが Buyer と類似（連絡先まとめ系、Contact モデルなし）かつ、4分割住所 UI は `AddressFields` 共通コンポーネントで吸収可能なため **2-2.5 時間** 想定。

---

## 8. Phase 1A-9（為替レート）の位置づけ（参考）

本セッションでは着手しない。理由を記録：

- **時系列データのマスター**：ExchangeRate は `(baseCurrency, targetCurrency, rateDate, source)` のユニーク制約を持つ。1 レートを「編集」というより、新しい日付で「追加」する運用が基本
- **CRUD パターンが標準と異なる**：「アーカイブ / 復元」概念が薄く、削除も慎重（過去レートは見積もり履歴と紐づく可能性が高い）
- **外部 API 連携が前提**：日銀公示レート（BOJ）の自動取得を Phase 1B で実装する設計。手動入力 UI だけ先行実装するか、API 連携と同時にやるかの判断が必要
- **Phase 1B 見積もりエンジンとの結合度が高い**：見積もり作成時の `exchangeRateAtCreation` 記録、為替変動 ±5% 検知などが Phase 1B 主要ロジック。為替マスター単独で完遂しても価値が薄い

→ **Phase 1A-13 完了後、Phase 1B 突入直前に「為替レート + 為替モニタ + BOJ API 連携」をセットで着手** する想定にリスケ決定。本 PR で `docs/phase-strategy-confirmation-2026-05-23.md` の Phase 1A 残作業表も同時更新し、1A-9 を末尾（実装順 7 番）に移動。同時に 1A-10 / 1A-11 の順序固定（FK 依存）も明文化した。

---

## 9. 関連ドキュメント

| パス | 内容 | このセッションで参照する箇所 |
|---|---|---|
| `docs/shunya-master-patterns.md` | マスター実装パターン集（v1.1 → v1.2 改訂予定）| §3 スキーマパターン / §12 実装手順 |
| `docs/master-naming-conventions.md` | 命名規則 | URL / モデル / コンポーネントの単複ルール |
| `docs/phase1a-7-completion-and-1a-8-handover.md` | 前回引き継ぎ（テンプレートとして参照）| 構成・記述粒度の参考 |
| `docs/phase1a-14-csv-import-export-plan.md` | CSV 一括機能計画 | Buyer / DeliveryDestination の CSV 対象判定（Phase 1A-14 で対応）|
| `docs/phase-strategy-confirmation-2026-05-23.md` | Phase 戦略確認（シナリオ A 採用）| マスター量産路線の根拠 / **本 PR で 1A-9 / 1A-10 / 1A-11 の順序を更新** |

---

## 10. 次セッション開始時のチェックリスト

次セッションを開始するときに最初にやること：

```bash
# ローカル状態確認
cd ~/shunya-production-system
git checkout main
git pull origin main
git log -3 --oneline
git status

# 期待値:
# - HEAD: 本ドキュメントの PR がマージされたコミット
# - ワーキングツリー: clean
```

### 着手フロー

1. 本ドキュメント §6.5 の論点 7 個を上から順に確定（30 分目安）
2. 確定したら `feat/buyer` ブランチを切る
3. shunya-master-patterns.md §12 のチェックリストに従い 4 フェーズ実装
4. PR #20 想定で main に反映
5. 動作確認 7 項目
6. 完遂後、即 1A-10（DeliveryDestination）に着手 → ブランチ `feat/delivery-destination`
7. すべて完遂後、本ドキュメントと同じ形式で `docs/phase1a-11-and-1a-10-completion-and-1a-12-handover.md` を作成

---

## 11. 本セッションのハイライト（記録用）

| トピック | 内容 |
|---|---|
| 完遂時間 | Phase 1A-8 全体で約 5-6 時間（仕様議論 1h + 実装 4-5h）|
| コード品質 | 全フェーズで tsc 一発通過、retry なし |
| 設計再利用率 | ProductCategory（1A-7）から 8 関数 + 4 カード Form がほぼ流用 |
| 新パターン確立 | PERCENTAGE 連動 UI / Decimal 型ガード / SelectGroup グルーピング / shadcn Alert 初導入 |
| 想定外の発見 | DeliveryDestination の buyerId 必須 FK（次セッション着手前に判明、1A-10 の単独実装が不可能と確定）|
| 仕様 v1.0 の再発見 | Buyer.clientId が optional であることを再確認、業務シナリオの設計意図を尊重した実装方針 |

---

**おつかれさまでした 🎉**
**次セッションでは Phase 1A-11（バイヤー）の仕様確定議論から再開します。**
