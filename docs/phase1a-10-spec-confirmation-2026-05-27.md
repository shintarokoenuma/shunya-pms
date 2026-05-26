
# Phase 1A-10（納品先）仕様確定議事録

**作成日**：2026-05-27
**作成者**：Shin（肥沼慎太郎）+ Claude
**ステータス**：確定
**前段引き継ぎ**：`docs/phase1a-8-completion-and-1a-11-handover.md` + Phase 1A-11 完遂時の引き継ぎ

---

## 1. 業務シナリオ（4 階層モデルの確認）

Phase 1A-11 で確定済みの 4 階層モデルを再確認した。Brand マスター（Phase 1A-2 で実装済み）の存在を踏まえると、shunya のデータモデルは 4 階層構造である。

```
Client（会社）
   ├─ Brand[]   （所有ブランド群、商品 identity）
   └─ Buyer[]  → DD[]  （発注主体・物理拠点）
```

### 各レイヤーの役割

| レイヤー | マスター | 役割 | 例 |
|---|---|---|---|
| 1 | Client | 支払主体（請求書発行先）、与信管理 | ABC 株式会社、BEAMS 本社 |
| 2a | Brand | 商品 identity（タグ、デザイン管理）| ALPHA、BETA、fennica |
| 2b | Buyer | 発注主体（PO / SO / DLV / INV の宛先）| ALPHA、BEAMS、BEAMS-DOM |
| 3 | DD | 物理拠点（実配送先）| ALPHA直営店、BEAMS渋谷店 |

### Brand と Buyer の関係

- Brand と Buyer は同じ Client 配下の異なるレイヤー
- 「Brand 名 = Buyer 名」のケースも OK（例：ALPHA というブランドの発注主体も「ALPHA」）
- 同名の場合の視覚的区別は buyerCode のサフィックス（`-DOM` 等）で対応（Phase 1A-11 命名規則）

### Case A / B の再掲（Phase 1A-11 議事録より）

#### Case A：ブランド OEM（メインケース）

```
shunya ← Client = MARKA  ← Buyer = BEAMS  ← DD = BEAMS渋谷店
       （MARKA が支払う）（MARKA の卸先）（実配送先）
```

#### Case B：直接 OEM（PB 生産）

```
shunya ← Client = BEAMS  ← Buyer = BEAMS 国内事業部 ← DD = BEAMS渋谷店
       （BEAMS が支払う）（BEAMS の発注組織単位）  （実配送先）
```

---

## 2. 仕様確定論点 13 件

| # | 論点 | 確定内容 |
|---|---|---|
| A-1 | status の enum 化方針 | `DeliveryDestinationStatus { ACTIVE / ARCHIVED }`（2 値、Buyer precedent 揃え）|
| A-2 | Contact モデル追加するか | 追加なし、元設計通り単一連絡先（contactPerson / phone / email）|
| A-3 | 住所フィールドの整合 | 5 分割 + addressLine2 追加、addressEn は Phase 2 送り |
| A-4 | 海外取引フィールド追加するか | timezone のみ追加、その他（chatTool / preferredLanguage 等）は Phase 2 送り |
| A-5 | 取引条件系フィールド | 追加なし（DD は支払い主体ではない）|
| B-1 | Buyer 詳細ページに「関連納品先」セクション追加 | 確定、Phase 1A-10 PR 内で同時実装 |
| B-2 | Client 詳細にも「関連納品先」を出すか | 方式 2（Buyer 一覧の各行に「納品先数」バッジ追加）、専用 DD セクションは作らない |
| C-1 | 標準カード構成 | 5 カード（基本 / 住所 / 連絡先 / 配送指示 / メモ）、timezone は配送指示カードに同居 |
| C-2 | destinationCode の命名規則 | `<buyerCode>-<location>` 形式を標準として推奨、master-naming-conventions.md に追記 |
| C-3 | preferredDeliveryDays / preferredDeliveryHours の UI | すべて自由入力、deliveryNotes は Textarea、days/hours は Input、timezone は TimezoneField |
| D-1 | CRUD パターン | master-patterns v1.2 標準の 8 関数構成、DD 固有は buyerId フィルタ追加のみ |
| D-2 | 一覧 UI のバイヤー絞り込み | Client + Buyer + Status の 3 フィルタ。Brand フィルタは future-features メモ化 |
| D-3 | Buyer アーカイブ時の DD の挙動 | パターン γ（警告 + ユーザー選択）、連鎖アーカイブのデフォルト ON、restore は独立 |

---

## 3. A 系：構造系（Prisma スキーマ）

### A-1：status の enum 化（再確定）

**当初提案**：`ACTIVE / PAUSED / ARCHIVED`（3 値、master-patterns 標準）
**再確定**：`ACTIVE / ARCHIVED`（2 値）

#### 理由

- Buyer（親）が `ACTIVE / ARCHIVED` の 2 値で確定済み（Phase 1A-11）
- 親が 2 値で子が 3 値だと UI で「Buyer はアーカイブ済みだけど納品先は休止中」のような状態の組み合わせが増え、説明コストが積み上がる
- PAUSED 相当の状態（店舗改装・休業）は `notes` フィールドで表現可能
- shunya の「小規模業務マスター」グループ（ProductCategory / ExpenseCategory / Buyer / DD）が status 2 値で揃う

#### スキーマ

```prisma
enum DeliveryDestinationStatus {
  ACTIVE
  ARCHIVED
}
```

### A-2：Contact モデル追加なし

#### 理由

- Buyer precedent と整合（Buyer も Contact モデル追加なし）
- DD は物理拠点 = 連絡窓口が 1 人で足りる業務シナリオが圧倒的多数
- 複数連絡先が必要なケース（大型店舗など）は notes で対応
- 拡張余地は残す：将来 Buyer に Contact 追加するときに DD にも同時追加

#### フィールド

```prisma
contactPerson String? @map("contact_person") @db.VarChar(255)
phone         String? @db.VarChar(50)
email         String? @db.VarChar(255)
```

### A-3：住所フィールドの整合

**当初設計**：`postalCode / country / prefecture / city / address`（5 分割、addressLine2 なし）
**確定**：5 分割 + `addressLine2` 追加。addressEn は Phase 2 送り

#### 理由

- DD は配送先 = `addressLine2`（ビル名・階数）が業務上必須
- BEAMS渋谷店 3F、山田ビル B1F のような階数指定が配送精度を左右
- Buyer は会社所在地で addressLine2 なくても困らないが、DD は物理拠点なので必要
- AddressFields コンポーネント流用可能

#### スキーマ

```prisma
postalCode    String? @map("postal_code") @db.VarChar(20)
country       String  @default("JP") @db.VarChar(2)
prefecture    String? @db.VarChar(50)
city          String? @db.VarChar(100)
address       String? @db.Text
addressLine2  String? @map("address_line2") @db.VarChar(255)
```

### A-4：海外取引フィールド（timezone のみ追加）

**当初推奨**：すべて Phase 2 送り
**再確定**：timezone のみ追加。他（chatTool / chatToolId / preferredLanguage / preferredCurrency / addressEn）は Phase 2 送り

#### timezone 単独追加の正当化

- Buyer と DD の性格差：Buyer = 会社（業務時間曖昧）、DD = 物理拠点（配送時刻が業務的に重要）
- timezone は他フィールドと独立して意味を持つ：preferredLanguage や preferredCurrency は文化的コンテキストのセットだが、timezone は単独で物理的時間軸を表す
- preferredDeliveryHours の解釈曖昧性を解消：構造化された timezone で海外納品時の現地時間 vs JST の混乱を防げる
- 既存実装の流用可能：master-patterns v1.2 で TimezoneField コンポーネント確立済み

#### スキーマ

```prisma
timezone String? @db.VarChar(50)
```

### A-5：取引条件系フィールド追加なし

#### 理由

- DD は支払い主体ではない（支払うのは Buyer or Client）
- 適格請求書発行は会社単位（Buyer / Client のレイヤー）
- 締日・支払日も会社単位
- Buyer precedent と完全対称

---

## 4. B 系：リレーション

### B-1：Buyer 詳細ページに「関連納品先」セクション追加

#### 仕様詳細

| 項目 | 仕様 |
|---|---|
| 表示位置 | Buyer 詳細ページの末尾セクション |
| 件数 | 全件表示（ページネーション不要、想定数 10〜30 程度）|
| 並び順 | destinationCode 昇順 |
| 表示カラム | destinationCode / destinationName / city（or prefecture）/ status |
| アーカイブ済み | デフォルトで非表示、トグル切り替えで表示 |
| アクション | 「＋新規納品先を追加」ボタン → `/delivery-destinations/new?buyerId=<id>` に遷移 |
| 各行クリック | DD 詳細ページに遷移 |
| 0 件の場合 | 空表示 + 「まだ納品先が登録されていません」メッセージ + 追加ボタン |
| 一覧導線 | セクション見出しに「一覧で見る →」リンク追加、`/delivery-destinations?buyerId=<id>` に遷移 |

#### スコープ

- Phase 1A-10 PR 内で同時実装
- Buyer マスター側のスキーマ変更は不要（既存の `Buyer.deliveryDestinations DeliveryDestination[]` リレーションがあるため）

### B-2：Client 詳細にも「関連納品先」を出すか

#### Phase 1A-11 の予約状態

`src/app/(app)/clients/[id]/page.tsx:438-439` に TODO コメント存在：

```
Phase 1A-10（DeliveryDestination）完成時、
同じ箇所に「関連納品先」セクションも追加予定。
```

#### 確定方式：方式 2（Buyer 一覧 + 納品先数バッジ）

```
┌─ Client 詳細：BEAMS ──────────────────────────┐
│  ...                                           │
├─ 関連バイヤー（3 件）─────────────────────────┤
│  BEAMS-DOM     国内事業部   納品先 3 件 →     │
│  BEAMS-INTL    海外事業部   納品先 1 件 →     │
│  BEAMS-PB      PB事業部     納品先 0 件       │
└────────────────────────────────────────────────┘
```

#### 理由

- 階層構造の保護：Client → Buyer → DD という業務的階層が UI でも自然に表現される
- 認知負荷が低い：Client 詳細ページが情報過多にならない
- 業務シナリオに合致：Client 単位の納品先全体把握は Buyer 単位で粒度が揃った方が分かりやすい
- 実装コストが軽い：既存の Buyer 一覧 SELECT に `_count.deliveryDestinations` を追加するだけ

#### Phase 1A-10 PR 内の作業

- 該当箇所の TODO コメントを削除
- 既存の「関連 Buyer」セクションを改修 → 各行に「納品先数」バッジ追加
- 専用の DD セクションは新規追加せず
- 一覧導線（「全納品先を一覧で見る →」リンク）も Client 詳細から追加：`/delivery-destinations?clientId=<id>`

#### コミットメッセージへの注記

```
Note: Phase 1A-11 時点で予約されていた「専用の DD セクション」案は
      Phase 1A-10 仕様確定議論（B-2）で「方式 2＝Buyer 一覧バッジ」に変更。
      情報量過多と階層構造保護のトレードオフで方式 2 採用。
```

---

## 5. C 系：UI

### C-1：標準カード構成（5 カード）

```
┌─ カード 1：基本情報 ─────────────────┐
│  buyerId (Select、必須)             │
│  destinationCode (必須)             │
│  destinationName (必須)             │
│  status                             │
└──────────────────────────────────────┘
┌─ カード 2：住所 ─────────────────────┐
│  AddressFields（addressLine2 表示） │
└──────────────────────────────────────┘
┌─ カード 3：連絡先 ───────────────────┐
│  contactPerson / phone / email      │
└──────────────────────────────────────┘
┌─ カード 4：配送指示 ─────────────────┐
│  deliveryNotes (Textarea、3 行)     │
│  preferredDeliveryDays (Input)      │
│  preferredDeliveryHours (Input)     │
│  timezone (TimezoneField)           │
└──────────────────────────────────────┘
┌─ カード 5：メモ ─────────────────────┐
│  notes                              │
└──────────────────────────────────────┘
```

### C-2：destinationCode の命名規則

`<buyerCode>-<location>` 形式を標準として推奨。`master-naming-conventions.md` に追記（強制せず、DB 制約は `@@unique` のみ）。

#### 命名例

| Buyer | DD | destinationCode |
|---|---|---|
| BEAMS-DOM | 渋谷店 | `BEAMS-DOM-SHIBUYA` |
| BEAMS-DOM | 原宿店 | `BEAMS-DOM-HARAJUKU` |
| BEAMS-INTL | LA 店 | `BEAMS-INTL-LA` |
| BEAMS-PB | 倉庫 1 | `BEAMS-PB-WH01` |
| ALPHA（Case A 型）| 直営店 | `ALPHA-FLAGSHIP` |

#### location 略号の標準セット

| 種別 | 略号パターン |
|---|---|
| 国内店舗 | 区市町村 or 都市の英字略号（SHIBUYA / HARAJUKU / GINZA / OSAKA / NAGOYA）|
| 海外店舗 | 都市略号（LA / NYC / PARIS / SEOUL）|
| フラッグシップ | FLAGSHIP |
| 倉庫 | WH + 連番（WH01 / WH02）|
| 物流センター | DC + 識別子（DC-NARITA / DC01）|
| 配送センター | LC + 識別子（LC-CHIBA）|
| ポップアップ | POP- + 地名（POP-OMOTESANDO）|

#### Brand の取り扱い

destinationCode には Brand 情報は混ぜない。1 つの DD で複数 Brand の商品を受け入れるケースがあるため、Brand と DD はレイヤーが違う。

### C-3：配送指示の UI

| フィールド | UI | プレースホルダ |
|---|---|---|
| deliveryNotes | Textarea（3 行）| 例：搬入口は裏口、エレベーター 3 号機使用。事前連絡必須。 |
| preferredDeliveryDays | Input（1 行）| 例：火・木 / 平日のみ / 月-金 |
| preferredDeliveryHours | Input（1 行）| 例：10:00-15:00 / 午前中 / 9-12 時または 14-17 時 |
| timezone | TimezoneField（既存 Select）| 国内は未入力可（自動 JST 解釈）|

#### 設計判断

- 曜日構造化（チェックボックス）はしない：第2第4水曜、祝日対応など複雑ケースに対応できない
- 時間帯構造化（HH:MM 入力 2 つ）はしない：分割時間帯、曖昧表現に対応できない
- 自由テキストの方が運用柔軟性が高い

---

## 6. D 系：CRUD パターン

### D-1：8 関数構成（master-patterns v1.2 標準準拠）

```typescript
// src/lib/actions/delivery-destinations.ts

listDeliveryDestinations(params: {
  search?: string                        // destinationCode + destinationName
  status?: DeliveryDestinationStatus     // ACTIVE / ARCHIVED
  buyerId?: string                       // ★DD 固有のフィルタ
  clientId?: string                      // ★DD 固有のフィルタ（buyer.client_id 経由 join）
  page?: number
  pageSize?: number
})
getDeliveryDestination(id: string)
createDeliveryDestination(data: CreateDeliveryDestinationInput)
updateDeliveryDestination(id: string, data: UpdateDeliveryDestinationInput)
archiveDeliveryDestination(id: string)
restoreDeliveryDestination(id: string)
checkDeliveryDestinationUsage(id: string)
deleteDeliveryDestinationPermanently(id: string, confirmationName: string)
```

#### Phase 1A 時点の checkUsage

業務トランザクション（PO / SO / DLV / INV 等）が未実装のため、checkUsage は常に `isUsed: false` を返す。Phase 1B 以降で SO / DLV 等が実装されたら、その時点で拡張。

### D-2：一覧フィルタ（Client + Buyer + Status）

| フィルタ | UI | DB 経路 |
|---|---|---|
| Client | 通常 Select、`clientCode（clientName）`形式 | DD → Buyer → Client の join |
| Buyer | 通常 Select、`buyerCode（buyerName）`形式 | DD → Buyer の直接 FK |
| Status | Select（ACTIVE / ARCHIVED）| 直接 |

#### 検索 + 双方向リンク

- URL パラメータ連動：`?clientId=xxx` / `?buyerId=xxx` で自動フィルタ設定
- Buyer 詳細 → 一覧導線：「関連納品先」セクション見出しに「一覧で見る →」リンク
- Client 詳細 → 一覧導線：「全納品先を一覧で見る →」リンク

#### 一覧カラム

| カラム | 内容 |
|---|---|
| destinationCode | コード |
| destinationName | 名前 |
| Client | `clientCode（clientName）`（リンク付き）|
| Buyer | `buyerCode（buyerName）`（リンク付き）|
| 都道府県 / 国 | JP なら都道府県、他は国名 |
| status | ACTIVE / ARCHIVED バッジ |
| 操作 | 詳細 / 編集 / アーカイブ等のメニュー |

#### Brand フィルタを Phase 1A-10 では追加しない理由

- Brand ↔ DD のリレーションが未設計（スキーマ追加が必要）
- 「ALPHA ブランドの納品先」は Phase 1A では Client 経由で間接的に到達可能
- DD ↔ Brand の N:N は Phase 1B（業務トランザクション）で実態を見てから設計する方が業務感覚に合う
- 詳細は `docs/future-features/brand-buyer-relationship.md` に保留

### D-3：Buyer アーカイブ時の DD の挙動

#### パターン γ：警告 + ユーザー選択

##### archive 時

1. Buyer の archive ボタン押下
2. 配下に ACTIVE な DD が **0 件** の場合：通常の archive 確認ダイアログ（DD の話題なし）
3. 配下に ACTIVE な DD が **1 件以上** の場合：
   - 確認ダイアログに「配下 ACTIVE な DD: N 件」を表示
   - 「☑ 配下の DD も同時にアーカイブする」**チェックボックス（デフォルト ON）**
   - 配下 DD のリスト（最大 5 件 + "他 X 件"）を表示
   - [キャンセル] [アーカイブ実行] ボタン
4. 実行：
   - チェック ON → Buyer + 該当 DD を同一トランザクションで archive
   - チェック OFF → Buyer のみ archive

##### restore 時

- Buyer のみ復元、配下 DD の復元は別途ユーザー判断
- 「N 件の DD が ARCHIVED 状態です」とアナウンス
- 配下 DD は一覧で個別 restore

##### 物理削除時

`onDelete: Cascade` 維持（既存設計通り）。MASTER_ADMIN 限定 + 確認名入力 + 紐付き 0 件チェックの 3 重ガードで安全担保。

##### 実装方針

```typescript
async function archiveBuyer(id: string, options: {
  cascadeArchiveDestinations: boolean  // ★追加パラメータ
}): Promise<{ buyer: Buyer, cascadedCount: number }> {
  return await prisma.$transaction(async (tx) => {
    const buyer = await tx.buyer.update({
      where: { id },
      data: { status: BuyerStatus.ARCHIVED }
    })
    let cascadedCount = 0
    if (options.cascadeArchiveDestinations) {
      const result = await tx.deliveryDestination.updateMany({
        where: { buyerId: id, status: DeliveryDestinationStatus.ACTIVE },
        data: { status: DeliveryDestinationStatus.ARCHIVED }
      })
      cascadedCount = result.count
    }
    await tx.auditLog.create({ /* archive 記録 + cascade 情報 */ })
    return { buyer, cascadedCount }
  })
}
```

#### shunya-master-patterns v1.3 への昇格候補

「親 archive 時、配下のアクティブな子の連鎖は警告 + ユーザー選択（デフォルト ON）」は将来の Phase 1A-12（ModelCode → Product）以降にも適用できるパターン。`docs/future-features/parent-child-archive-cascade-pattern.md` に記録し、Phase 1A-10 完了時に master-patterns 改訂で正式追加するか別判断。

---

## 7. 確定スキーマ（最終版）

```prisma
model DeliveryDestination {
  id        String @id @default(uuid())
  companyId String @map("company_id")
  buyerId   String @map("buyer_id")

  // 識別
  destinationCode String @map("destination_code") @db.VarChar(50)
  destinationName String @map("destination_name") @db.VarChar(255)

  // 住所（A-3）
  postalCode    String? @map("postal_code") @db.VarChar(20)
  country       String  @default("JP") @db.VarChar(2)
  prefecture    String? @db.VarChar(50)
  city          String? @db.VarChar(100)
  address       String? @db.Text
  addressLine2  String? @map("address_line2") @db.VarChar(255)

  // 連絡先（A-2）
  contactPerson String? @map("contact_person") @db.VarChar(255)
  phone         String? @db.VarChar(50)
  email         String? @db.VarChar(255)

  // 配送指示（C-3）
  deliveryNotes          String? @map("delivery_notes") @db.Text
  preferredDeliveryDays  String? @map("preferred_delivery_days") @db.VarChar(255)
  preferredDeliveryHours String? @map("preferred_delivery_hours") @db.VarChar(255)

  // 海外取引（A-4：timezone のみ）
  timezone      String? @db.VarChar(50)

  // ステータス（A-1）
  status        DeliveryDestinationStatus @default(ACTIVE)

  // メモ
  notes         String? @db.Text

  // タイムスタンプ
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  // リレーション
  buyer Buyer @relation(fields: [buyerId], references: [id], onDelete: Cascade)

  @@unique([companyId, destinationCode])
  @@index([companyId, buyerId])
  @@index([companyId, status])
  @@map("delivery_destinations")
}

enum DeliveryDestinationStatus {
  ACTIVE
  ARCHIVED
}
```

---

## 8. 既存データ状況（実装影響）

- 本番環境の `delivery_destinations` テーブル：データ 0 件想定（Phase 1A-10 未着手のため）
- マイグレーションは新カラム追加（addressLine2 / contactPerson / timezone / notes）+ status 型変更（String → enum）で済む
- 既存データ移行不要（0 件のため）

**Phase 1 スキーマ作業前のチェック**：本番 DB の件数を確認（`SELECT count(*) FROM delivery_destinations`）して 0 件確認後、`prisma migrate dev` を実行。

---

## 9. Phase 1A-10 完了後のフォローアップ

### 9.1 future-features メモ作成（別 PR）

| ファイル | 内容 |
|---|---|
| `docs/future-features/brand-buyer-relationship.md` | Brand ↔ Buyer / DD の N:N リレーション設計案 |
| `docs/future-features/material-product-search.md` | 素材 → 品番検索（BOM 経由）|
| `docs/future-features/invoice-matching-workflow.md` | 請求書 ↔ 発注 突合ワークフロー（State 1〜4 + 一括承認）|
| `docs/future-features/role-based-navigation.md` | サイドバーのロール別グルーピング |
| `docs/future-features/parent-child-archive-cascade-pattern.md` | 親 archive 時の子連鎖パターン（v1.3 候補）|

### 9.2 Phase 1A-12（ModelCode）仕様確定議論で考慮すべき論点

- Brand FK を必須化（生産管理視点で品番から Brand へ即到達）
- 検索フィルタに Brand / シーズン / 衣料カテゴリを必須化
- ModelCode は「リピート系譜の起点」、FK 設計が後の検索性を決定

### 9.3 Phase 1A-13（Material）仕様確定議論で考慮すべき論点

- 「使用品番」プレースホルダセクションを予約（Phase 1B で BOM 実装後に有効化）
- Supplier FK は単一 or 複数（同じ素材を複数 Supplier から仕入れる可能性）
- categoryCode の親子構造（ProductCategory パターンの流用）

---

## 10. 関連ドキュメント

- `docs/phase1a-11-spec-confirmation-2026-05-25.md`：Phase 1A-11 議事録（参考）
- `docs/shunya-master-patterns.md` v1.2：実装パターン集
- `docs/master-naming-conventions.md`：命名規則の本拠地（destinationCode 形式を本 PR で追記）
- `docs/phase-strategy-confirmation-2026-05-23.md`：Phase 戦略確認（シナリオ A）

---

**次セッション**：本議事録のマージ後、`feat/delivery-destination` ブランチで Phase 1（スキーマ）から実装着手。
