# Phase 1A-11（バイヤー）仕様確定議事録

**作成日**：2026-05-25
**作成者**：Shin（肥沼慎太郎）+ Claude
**前提**：`docs/phase1a-8-completion-and-1a-11-handover.md` §6.5 の論点 7 個に対する確定回答

---

## 1. 業務シナリオの確定

Phase 1A-11 着手前の議論で、Buyer の業務的役割について 3 ケースを検討し、**Case C（A + B 両方を扱う）** を採用と確定した。

### Case A：ブランド OEM（メインケース）

```
shunya ← Client = MARKA  ← Buyer = BEAMS  ← DeliveryDestination = BEAMS渋谷店
       （MARKA が支払う）（MARKA の販売先）（実配送先）
```

- shunya のクライアントはブランド（MARKA、KS 等）
- Buyer は Client の卸先（BEAMS、IF、Tomorrowland 等の小売・卸会社）
- DeliveryDestination は Buyer の各店舗・倉庫
- shunya は MARKA に請求、商品は Buyer の各店舗に分納

### Case B：直接 OEM（PB 生産）

```
shunya ← Client = BEAMS  ← Buyer = BEAMS 国内事業部 ← DeliveryDestination = BEAMS渋谷店
       （BEAMS が支払う）（BEAMS の発注組織単位）  （実配送先）
```

- shunya のクライアントは小売（BEAMS 等）の本社
- Buyer は Client の **発注組織単位（事業部）**
  - 例：BEAMS 国内事業部、BEAMS インターナショナル事業部、BEAMS PB 事業部
- 同一 Client（BEAMS 本社）の複数事業部を別 Buyer として登録
- 請求は Phase 1D の請求書発行ロジックで **Client 単位に合算**

### Case A / B のデータ構造上の違い

| 観点 | Case A | Case B |
|---|---|---|
| Buyer の意味 | Client の販売先（卸先会社） | Client の発注組織（事業部） |
| Buyer 例 | BEAMS、IF、Tomorrowland | BEAMS 国内事業部、BEAMS PB 事業部 |
| 請求先 | Client = MARKA | Client = BEAMS（複数事業部分を合算） |
| Phase 1A-11 でのスキーマ | 共通（同じ Buyer モデルで両対応） | 共通（同じ Buyer モデルで両対応） |

データモデル上は Buyer = 「Client に紐づく購買主体」として一律に扱い、Case A / B の差は運用上の意味付けで吸収する。

---

## 2. 仕様確定論点 7 件 + 業務ケース

| # | 論点 | 確定内容 | 補足 |
|---|---|---|---|
| 1 | `BuyerStatus` enum の値 | **`ACTIVE / ARCHIVED`** | 抽象マスター v2（ProductCategory / ExpenseCategory）と揃える。PAUSED は不要 |
| 2 | `clientId` を必須化するか | **optional のまま** | 仕様確定 v1.0 維持。Case A で BEAMS が複数 Client にまたがるシナリオを尊重 |
| 3 | 住所を 4 分割に揃えるか | **(b) 4 分割化** | 元設計の `address Text` 単一から、`postalCode / country / prefecture / city / address` の 5 フィールド構成に変更。`AddressFields` 共通コンポーネント流用 |
| 4 | Contact モデル追加するか | **追加なし** | 単一連絡先（`contactPerson / phone / email`）で MVP は十分 |
| 5 | 海外バイヤー対応（country / preferredLanguage / preferredCurrency） | **Phase 2 送り** | country は住所 4 分割化の一部として `String` 型で持つが、`Country` enum・preferredLanguage / preferredCurrency は MVP 外 |
| 6 | 検索仕様 | **buyerCode + buyerName 検索 + clientId フィルタ + status フィルタ** | Client 名称の join 検索は実装コスト割高のため不採用 |
| 7 | Client との関係を UI でどう見せるか | **(c) 双方向リンク** | Buyer 詳細 → Client へのリンク + Client 詳細 → 関連 Buyer 一覧 |
| 7c | 7(c) のスコープ | **(c-1) Phase 1A-11 内で同時実装** | Client 側 UI 改修も同一 PR で実装 |

---

## 3. スキーマ変更内容

### 3.1 元設計（`prisma/schema.prisma` の現状）

```prisma
model Buyer {
  id        String  @id @default(uuid())
  companyId String  @map("company_id")
  clientId  String? @map("client_id")

  buyerCode   String  @map("buyer_code") @db.VarChar(50)
  buyerName   String  @map("buyer_name") @db.VarChar(255)
  buyerNameEn String? @map("buyer_name_en") @db.VarChar(255)

  // 連絡先
  address String? @db.Text   // ← 全文住所（単一フィールド）
  phone   String? @db.VarChar(50)
  email   String? @db.VarChar(255)

  notes String? @db.Text

  status String @default("ACTIVE") @db.VarChar(20)   // ← String、要 enum 化

  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  deliveryDestinations DeliveryDestination[]

  @@unique([companyId, buyerCode])
  @@index([companyId, clientId])
  @@map("buyers")
}
```

### 3.2 確定後（Phase 1A-11 で実装する形）

```prisma
model Buyer {
  id        String  @id @default(uuid())
  companyId String  @map("company_id")
  clientId  String? @map("client_id")   // optional のまま維持

  buyerCode   String  @map("buyer_code") @db.VarChar(50)
  buyerName   String  @map("buyer_name") @db.VarChar(255)
  buyerNameEn String? @map("buyer_name_en") @db.VarChar(255)

  // 連絡先（4 分割住所 + 個別連絡先）
  postalCode    String? @map("postal_code") @db.VarChar(20)
  country       String  @default("JP") @db.VarChar(2)
  prefecture    String? @db.VarChar(50)
  city          String? @db.VarChar(100)
  address       String? @db.Text    // ← 意味変更：「番地・建物名等」
  contactPerson String? @map("contact_person") @db.VarChar(255)
  phone         String? @db.VarChar(50)
  email         String? @db.VarChar(255)

  notes String? @db.Text

  status BuyerStatus @default(ACTIVE)   // ← enum 化

  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  client               Client?               @relation(fields: [clientId], references: [id])
  deliveryDestinations DeliveryDestination[]

  @@unique([companyId, buyerCode])
  @@index([companyId, clientId])
  @@index([companyId, status])
  @@map("buyers")
}

enum BuyerStatus {
  ACTIVE
  ARCHIVED
}
```

### 3.3 元設計からの逸脱箇所（明示）

| 項目 | 元設計 v1.0 | Phase 1A-11 確定版 | 理由 |
|---|---|---|---|
| 住所 | `address Text` 単一 | 5 分割（`postalCode / country / prefecture / city / address`） | shunya-master-patterns v1.2 §9「標準マスター」の `AddressFields` を流用、検索・配送指示の精度確保 |
| 連絡先 | `phone / email` 単独 | `contactPerson / phone / email`（担当者名追加） | バイヤー側担当者名の保持ニーズ |
| status | `String @default("ACTIVE")` | `BuyerStatus enum` | shunya-master-patterns 標準（status は必ず enum 化） |
| Client リレーション宣言 | 未宣言（FK のみ） | `client Client? @relation(...)` 明示 | join 検索・Client 詳細での Buyer 一覧表示に必要 |
| status インデックス | なし | `@@index([companyId, status])` | 一覧画面のフィルタ性能 |

### 3.4 既存データの状況

確認日：2026-05-25
- ローカル DB：**Buyer = 0 件**
- 本番 DB（Railway）：**Buyer = 0 件**
- seed.ts：Buyer 投入処理**なし**

→ Migration は **新カラム追加のみ** で済む。既存 `address` データを 4 分割に分解する処理は不要（データが存在しないため）。

---

## 4. UI 仕様

### 4.1 Buyer 一覧ページ（`/buyers`）

- 検索：`buyerCode + buyerName`（部分一致 OR）
- フィルタ：`clientId` セレクト（「指定なし」可、関連 Client 名表示） + `status` セレクト
- 表示列：`buyerCode / buyerName / Client名（join）/ status / 操作`

### 4.2 Buyer 詳細ページ（`/buyers/[id]`）

- 基本情報カード（コード / 名称 / 英名）
- 関連クライアントカード（clientId があれば Client へのリンク、なければ「指定なし」表示）
- 連絡先カード（住所 4 分割 + 担当者名 + 電話 + メール）
- メモカード
- ステータスバッジ
- 関連 DeliveryDestination 一覧（Phase 1A-10 完遂後に追加表示）

### 4.3 Buyer 新規 / 編集フォーム

- カード 4 つ構成：
  1. 基本情報（buyerCode / buyerName / buyerNameEn）
  2. 関連クライアント（Client コンボボックス、「指定なし」可）
  3. 連絡先（`AddressFields` + contactPerson / phone / email）
  4. メモ + ステータス

### 4.4 Client 詳細ページの改修（同 PR で実施）

- 既存の Client 詳細ページに **「関連 Buyer 一覧」セクション** を追加
- buyerCode / buyerName / status を表で表示、各行から Buyer 詳細ページへリンク
- Phase 1A-10 完遂時、同じ箇所に「関連 DeliveryDestination 一覧」も追加予定（本 PR では Buyer のみ）

---

## 5. 命名規則：buyerCode 形式

Case B（事業部単位の Buyer 登録）を念頭に、buyerCode に運用ルールを設ける：

```
buyerCode = <Client略号>-<事業部略号>
```

### 例

| Client | Buyer 事業部 | buyerCode |
|---|---|---|
| BEAMS | 国内事業部 | `BEAMS-DOM` |
| BEAMS | インターナショナル事業部 | `BEAMS-INTL` |
| BEAMS | PB 事業部 | `BEAMS-PB` |
| United Arrows | 国内事業部 | `UA-DOM` |

### Case A（ブランド OEM）の場合

Client の事業部を分ける必要がないため、Buyer 自体の名前で命名：

| Client | Buyer | buyerCode |
|---|---|---|
| MARKA | BEAMS | `BEAMS` または `MARKA-BEAMS`（紐付け明示時）|
| MARKA | IF | `IF` |

詳細は `docs/master-naming-conventions.md` を参照。

---

## 6. 実装手順サマリー

`docs/shunya-master-patterns.md` v1.2 §12 のチェックリストに従う：

```
Phase 1: スキーマ
  □ BuyerStatus enum 新設（ACTIVE / ARCHIVED）
  □ Buyer モデルを確定版に更新（4 分割住所、status enum 化、Client リレーション明示、index 追加）
  □ npx prisma migrate dev --name phase1a_11_buyer_address_split_and_status_enum
  □ tsc clean 確認

Phase 2: 論理層
  □ src/lib/validators/buyer.ts
  □ src/app/(app)/buyers/_components/labels.ts
  □ src/lib/actions/buyers.ts（8 関数）
  □ tsc clean 確認 → 論理層コミット

Phase 3: UI
  □ shadcn コンポーネント事前確認（ls src/components/ui/）
  □ buyer-form.tsx（4 カード構成、AddressFields 流用）
  □ buyer-delete-button.tsx
  □ buyers-table.tsx
  □ buyers-search.tsx + buyers-pagination.tsx
  □ buyers/page.tsx, new/page.tsx, [id]/page.tsx, [id]/edit/page.tsx
  □ Client 詳細ページに「関連 Buyer 一覧」セクション追加
  □ nav-items.ts 更新（「バイヤー」エントリ）
  □ tsc clean 確認 → UI コミット

Phase 4: PR & デプロイ
  □ push → PR #22 想定
  □ マージ → 本番反映
  □ 動作確認 7 項目 + Client 側双方向リンクの確認
```

---

## 7. 関連ドキュメント

- `docs/phase1a-8-completion-and-1a-11-handover.md`：本議事録の前段（論点 7 個の提示）
- `docs/shunya-master-patterns.md` v1.2：実装パターン集
- `docs/master-naming-conventions.md`：命名規則の本拠地（buyerCode 形式を別途追記）
- `docs/phase-strategy-confirmation-2026-05-23.md`：Phase 戦略確認（シナリオ A）

---

**次セッション**：本議事録のマージ後、`feat/buyer` ブランチで Phase 1（スキーマ）から実装着手。
