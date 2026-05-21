# shunya マスター実装パターン

**バージョン**: v1.0 (ライブドキュメント、Phase 進行中も随時更新)
**最終更新**: 2026年5月21日 (Phase 1A-5 完了時点)
**確立元**: Phase 1A-1 〜 Phase 1A-5

---

## このドキュメントの目的

shunya 生産管理システムにおける**マスター CRUD 実装の標準パターン**を定義する。
新しいマスター（外注先・納品先・素材等）を実装する際、このパターンに従うことで：

- **命名・構造の一貫性**を保つ
- **デバッグ時の認知負荷**を下げる
- **共通モジュールの再利用率**を上げる
- **新人・AI アシスタントが迷わない**

---

## 1. 適用範囲

このパターンは shunya プロジェクトの**マスター CRUD 実装**に適用される。

### 対象マスター（Phase 1A-9 完了時点）

| マスター | 状態 | コード |
|---|---|---|
| Client（クライアント） | ✅ 実装済み | `/clients` |
| Brand（ブランド） | ✅ 実装済み | `/brands` |
| Supplier（仕入先） | ✅ 実装済み | `/suppliers` |
| Factory（工場） | ✅ 実装済み | `/factories` |
| Contractor（外注先） | ⬜ Phase 1A-6 | `/contractors` |
| DeliveryDestination（納品先） | ⬜ | `/delivery-destinations` |
| Material（素材） | ⬜ Phase 1A-? | `/materials` |
| Expense（諸経費） | ⬜ Phase 1A-? | `/expenses` |

### 非適用範囲

- 業務トランザクション（Inquiry / Project / Quotation / PO / WO / Invoice 等）
- 設定系（ユーザー管理 / 通知設定 / 為替レート等）

---

## 2. ファイル配置規約
### 命名の単数 / 複数ルール

- **ディレクトリ・URL**: 複数形（`/factories`、`/suppliers`）
- **モデル・型**: 単数形（`Factory`、`Supplier`）
- **フォーム / 削除ボタン**: 単数形（`factory-form.tsx`、`factory-delete-button.tsx`）
- **テーブル / 検索 / ページネーション**: 複数形（`factories-table.tsx`）

---

## 3. スキーマパターン（Prisma）

### 必須フィールド

```prisma
model <Master> {
  id        String @id @default(uuid())
  companyId String @map("company_id")

  // 識別
  <master>Code String @map("<master>_code") @db.VarChar(50)
  <master>Name String @map("<master>_name") @db.VarChar(255)
  <master>NameEn String? @map("<master>_name_en") @db.VarChar(255)

  // 連絡先（住所4分割）
  country      String  @default("JP") @db.VarChar(2)
  postalCode   String? @map("postal_code") @db.VarChar(20)
  prefecture   String? @db.VarChar(50)
  city         String? @db.VarChar(100)
  address      String? @db.Text
  addressLine2 String? @map("address_line2") @db.VarChar(255)
  addressEn    String? @map("address_en") @db.Text
  phone        String? @db.VarChar(50)
  fax          String? @db.VarChar(50)
  email        String? @db.VarChar(255)

  // 海外取引用
  chatTool          String?  @map("chat_tool") @db.VarChar(50)
  chatToolId        String?  @map("chat_tool_id") @db.VarChar(255)
  preferredLanguage Language @default(JA) @map("preferred_language")
  preferredCurrency Currency @default(JPY) @map("preferred_currency")
  timezone          String?  @db.VarChar(50)

  // 取引条件
  taxId                    String?         @map("tax_id") @db.VarChar(50)
  isQualifiedInvoiceIssuer Boolean         @default(true) @map("is_qualified_invoice_issuer")
  paymentTermType          PaymentTermType @default(MONTHLY_CLOSING) @map("payment_term_type")
  closingDay               Int?            @map("closing_day")
  paymentMonthOffset       Int?            @map("payment_month_offset")
  paymentDay               Int?            @map("payment_day")

  // 担当者・ステータス・メモ
  assignedToUserId String?       @map("assigned_to_user_id")
  status           <Master>Status @default(ACTIVE)
  notes            String?       @db.Text

  // タイムスタンプ
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  // リレーション
  contacts <Master>Contact[]

  @@unique([companyId, <master>Code])
  @@index([companyId, status])
  @@index([companyId, country])
  @@index([assignedToUserId])
  @@map("<masters>")
}

enum <Master>Status {
  ACTIVE
  PAUSED
  ARCHIVED
}

model <Master>Contact {
  id        String @id @default(uuid())
  companyId String @map("company_id")
  <master>Id String @map("<master>_id")

  firstName   String  @map("first_name") @db.VarChar(100)
  lastName    String  @map("last_name") @db.VarChar(100)
  displayName String? @map("display_name") @db.VarChar(200)
  jobTitle    String? @map("job_title") @db.VarChar(255)
  department  String? @db.VarChar(255)

  email  String? @db.VarChar(255)
  phone  String? @db.VarChar(50)
  mobile String? @db.VarChar(50)

  isPrimary         Boolean   @default(false) @map("is_primary")
  preferredLanguage Language?

  notes String? @db.Text

  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  <master> <Master> @relation(fields: [<master>Id], references: [id], onDelete: Cascade)

  @@index([<master>Id, isPrimary])
  @@map("<master>_contacts")
}
```

### マスター固有フィールドの追加

各マスター固有の要素は、上記の共通フィールドの後に追加する：

- Supplier: `supplierType[]`（複数選択可）
- Factory: `factoryTypes[]` + `contractTypes[]` + 製造キャパシティ3項目
- Contractor: 個人/法人フラグ + 専門分野 + 料金体系 + ロイヤリティ

---

## 4. 命名規約

### Server Action

```typescript
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export async function create<Master>(input: <Master>Input): Promise<ActionResult<{ id: string }>> {
  // ...
}
```

すべて `{ ok, error }` レスポンス。Brand 系のパターンに統一。

### バリデータ

| 用途 | 命名 |
|---|---|
| 入力スキーマ | `<master>InputSchema` |
| 入力型 | `<Master>Input` |
| フォーム値型 | `<Master>FormValues` |
| 検索パラメータ | `<master>ListParamsSchema` / `<Master>ListParams` |

### ラベル（labels.ts）

| サフィックス | 用途 | 型 |
|---|---|---|
| `_OPTIONS` | Select 用 | `Array<{ value, label }>` |
| `_LABELS` | バッジ等の表示用 | `Record<enum, string>` |
| `_PRESETS` | リテラル配列（チャットツール等） | `readonly string[]` |
| `_BADGE_VARIANT` | shadcn Badge variant マッピング | `Record<enum, "default" \| "secondary" \| "outline" \| "destructive">` |

### ステータスバッジの統一色

```typescript
ACTIVE:   "default"     // 塗りつぶし（強調）
PAUSED:   "outline"     // 枠線のみ（控えめ）
ARCHIVED: "secondary"   // 薄塗り（ぼんやり灰色）
```

### ステータスの日本語ラベル
---

## 5. Server Action 8関数構成

すべてのマスターで以下8関数を実装する：

| 関数 | 役割 |
|---|---|
| `list<Masters>` | 一覧（検索・フィルタ・ページネーション） |
| `get<Master>` | 詳細取得 |
| `create<Master>` | 新規作成（主担当 Contact 同時作成） |
| `update<Master>` | 更新（主担当も同時更新） |
| `archive<Master>` | アーカイブ（status を ARCHIVED に） |
| `restore<Master>` | アーカイブから復元（status を ACTIVE に） |
| `check<Master>Usage` | 紐付き確認（物理削除前のガード） |
| `delete<Master>Permanently` | 物理削除（MASTER_ADMIN のみ） |

すべて auditLog 自動記録。

---

## 6. archive / restore / permanent delete 分離

### archive（論理削除）

- `status` を `ARCHIVED` に変更
- データ自体は残る
- 通常権限で実行可
- 一覧では「アーカイブ」絞り込みで再表示可能

### restore（復元）

- `ARCHIVED` → `ACTIVE`
- 通常権限で実行可

### permanent delete（物理削除）

**ガード条件**:
1. `tenantType === "MASTER_ADMIN"` のみ実行可
2. `status === "ARCHIVED"` 状態のみ実行可
3. 確認のためマスター名を入力（`confirmationName === entity.<master>Name`）
4. `checkUsage()` で紐付きデータ0件確認

**実行内容**:
- `runWithoutTenantContext` 内で実行（テナント境界を一時的に外す）
- `<Master>Contact` は `deleteMany` で先に削除
- `<Master>` 本体を `delete`
- auditLog に DELETE 記録

---

## 7. バリデーション

### country === "JP" のときの追加チェック（superRefine 内）

```typescript
if (data.country === "JP") {
  // 1. 郵便番号 7桁数字必須
  if (!/^\d{3}-?\d{4}$/.test(data.postalCode)) {
    ctx.addIssue({ path: ["postalCode"], message: "郵便番号は7桁..." })
  }
  // 2. 都道府県必須
  if (data.prefecture === "") {
    ctx.addIssue({ path: ["prefecture"], message: "都道府県は必須です" })
  }
  // 3. taxId は T + 13桁必須
  if (!/^T\d{13}$/.test(data.taxId)) {
    ctx.addIssue({ path: ["taxId"], message: "T で始まる13桁..." })
  }
}
```

### 取引条件プリセット整合性チェック

```typescript
if (data.paymentTermType === PaymentTermType.MONTHLY_CLOSING) {
  // closingDay / paymentMonthOffset / paymentDay すべて必須
  // closingDay: 1-31
  // paymentDay: 1-31
}
```

---

## 8. 共通モジュール（src/lib/constants/）

### 既存モジュール（Phase 1A-5 時点）

| ファイル | 中身 |
|---|---|
| `payment-presets.ts` | 取引条件プリセット4種類（月末締翌月末 / 翌々月末 / 20日締翌月末 / 20日締翌月10日）|
| `chat-tools.ts` | チャットツール8種類（WeChat / LINE / Zalo / WhatsApp / KakaoTalk / Telegram / Signal / Other）|
| `currencies.ts` | Prisma 真値の通貨5種類（JPY / USD / CNY / VND / EUR）|
| `languages.ts` | Prisma 真値の言語4種類（JA / EN / ZH / VI）|
| `payment-term-types.ts` | 支払条件6種類（MONTHLY_CLOSING / DEPOSIT_COD / ADVANCE_PAYMENT / CASH_ON_DELIVERY / LETTER_OF_CREDIT / CUSTOM）|
| `countries.ts` | 20カ国 |
| `prefectures.ts` | 47都道府県 |
| `timezones.ts` | 16タイムゾーン + Other |

### labels.ts での re-export パターン

```typescript
// マスター固有のラベルだけ定義
export const <MASTER>_TYPE_OPTIONS = [...]
export const <MASTER>_STATUS_OPTIONS = [...]

// 共通モジュールは re-export
export { COUNTRY_OPTIONS, type CountryOption } from "@/lib/constants/countries"
export { CHAT_TOOL_PRESETS } from "@/lib/constants/chat-tools"
export { CURRENCY_OPTIONS } from "@/lib/constants/currencies"
export { LANGUAGE_OPTIONS, LANGUAGE_LABELS } from "@/lib/constants/languages"
export { PAYMENT_TERM_TYPE_OPTIONS, PAYMENT_TERM_TYPE_LABELS } from "@/lib/constants/payment-term-types"
export { PAYMENT_PRESETS, type PaymentPreset } from "@/lib/constants/payment-presets"
```

---

## 9. フォーム構成（標準7-8カード）
### 共通コンポーネント

- `AddressFields`: 国別ラベル切り替え（JP/海外）+ 都道府県 Select（JP のみ）
- `TimezoneField`: 16種類 Select + Other 自由入力

### 主担当（PrimaryContact）のフィールド構成

7フィールド: firstName / lastName / jobTitle / department / email / phone / mobile

---

## 10. Phase 2 に回す判定基準

以下は MVP では UI 非表示、DB 列だけ残す：

- **国際送金情報**: bankName / bankSwiftCode / bankIban / bankAccountInfo
- **評価項目**: qualityRating / deliveryRating / priceRating / defectRate
- **複雑な JSON フィールド**: カテゴリマスター未整備のもの（例: standardLaborRates）

### 判定理由

- 国際送金情報: SWIFT/IBAN は実運用上、ファイル添付（PDF）で受け取ることが多く、入力 UI 整備の優先度が低い
- 評価項目: 運用ルール（誰が何を基準に何点付けるか）が未確定
- JSON フィールド: 関連マスター（アイテムカテゴリ等）が未整備

---

## 11. 動作確認 7 項目

新しいマスター実装時、本番デプロイ後に以下7項目を確認する：

1. **新規作成** - サンプルデータで1件作成
2. **詳細表示** - 作成した詳細画面が全フィールド正しく表示される
3. **一覧表示** - サイドバーから一覧に遷移、新規作成したものが表示される
4. **編集** - 任意のフィールドを変更して保存、反映される
5. **アーカイブ** - 操作 → アーカイブ
6. **復元** - ステータス絞り込み「アーカイブ」→ 操作 → 復元
7. **物理削除** - テスト用マスターで本削除確認（要 MASTER_ADMIN）

---

## 12. 実装手順（チェックリスト）

新しいマスター実装時の標準フロー：

### Phase 1: スキーマ
- [ ] Prisma スキーマに必要な列を追加・調整
- [ ] `<Master>Status` enum 新設
- [ ] `<Master>Contact` モデルに `companyId` + `department` がある確認
- [ ] マイグレーション実行（事前に件数確認）

### Phase 2: 論理層
- [ ] `src/lib/validators/<master>.ts` 作成
- [ ] `src/app/(app)/<masters>/_components/labels.ts` 作成（共通モジュール re-export 中心）
- [ ] `src/lib/actions/<masters>.ts` 作成（8関数）
- [ ] tsc clean 確認
- [ ] **論理層コミット**

### Phase 3: UI
- [ ] `<master>-form.tsx` 作成（7-8カード）
- [ ] `<master>-delete-button.tsx` 作成
- [ ] `<masters>-table.tsx` 作成
- [ ] `<masters>-search.tsx` 作成
- [ ] `<masters>-pagination.tsx` 作成
- [ ] `page.tsx` / `new/page.tsx` / `[id]/page.tsx` / `[id]/edit/page.tsx` 作成
- [ ] tsc clean 確認
- [ ] ナビゲーション（nav-items.ts）に追加 / または既存項目の `enabled: true` 確認
- [ ] **UI コミット**

### Phase 4: PR & デプロイ
- [ ] push → PR 作成
- [ ] PR マージ
- [ ] main 最新化 + ブランチ削除
- [ ] 本番デプロイ完了確認
- [ ] **動作確認7項目**

---

## 13. Phase 1A-9 候補（既知の拡張ニーズ）

### Currency enum 拡張
現状: `JPY / USD / CNY / VND / EUR`

将来候補: `KRW / THB / INR / TRY / GBP`
- トリガー: 韓国・タイ・インド・トルコ・英国の取引先/工場が登録される直前

### Language enum 拡張
現状: `JA / EN / ZH / VI`

将来候補: `KO`（韓国語）
- トリガー: 韓国系取引先と本格運用開始時

### SupplierType マスター化
現状: enum 9種類

将来候補: `SupplierTypeMaster` テーブル化（テナントごとに種類を管理）
- トリガー: shunya 以外のテナントが利用を始める時

---

## 14. アンチパターン（やってはいけないこと）

### ❌ マスターごとに命名を変える

```typescript
// 悪い例: マスターごとに違う命名
src/app/(app)/suppliers/_components/labels.ts: export const CHAT_TOOL_OPTIONS = [...]
src/app/(app)/factories/_components/labels.ts: export const CHAT_TOOL_PRESETS = [...]
```

→ 共通モジュールから re-export することで自動的に統一される。

### ❌ Prisma に存在しない enum 値を使う

```typescript
// 悪い例: Prisma 真値を確認せずに書く
const CURRENCY_OPTIONS = [
  { value: "KRW", ... },  // Prisma の enum Currency に KRW がない！
]
```

→ 必ず `grep -A 20 "^enum <Name>" prisma/schema.prisma` で真値を確認してから書く。

### ❌ form.tsx に共通ロジックをハードコード

```typescript
// 悪い例
const PAYMENT_PRESETS = [
  { label: "月末締翌月末払", closingDay: 31, ... },  // フォーム内に直書き
]
```

→ `src/lib/constants/payment-presets.ts` に移動。

### ❌ form の primaryContact に多くのフィールドを持たせる

主担当は **7フィールド** に絞る（firstName / lastName / jobTitle / department / email / phone / mobile）。
displayName / preferredLanguage / notes 等は最小限の主担当作成時には含めない。
これらが必要なら、別途「担当者追加」UI で対応する想定。

### ❌ status を String のまま放置

```prisma
// 悪い例
status String @default("ACTIVE") @db.VarChar(20)
```

→ 必ず enum 化（`<Master>Status` 型）。タイプセーフ + 値の制約が効く。

---

## 15. 参考実装

完全な実装例として以下を参照：

- **Server Action**: `src/lib/actions/factories.ts` (609行)
- **バリデータ**: `src/lib/validators/factory.ts` (228行)
- **フォーム**: `src/app/(app)/factories/_components/factory-form.tsx` (1002行)
- **削除ボタン**: `src/app/(app)/factories/_components/factory-delete-button.tsx` (300行)
- **詳細ページ**: `src/app/(app)/factories/[id]/page.tsx` (384行)
- **編集ページ**: `src/app/(app)/factories/[id]/edit/page.tsx` (89行)

これらは Phase 1A-5 完了時点での「shunya 流のお手本」として機能する。

---

## 改訂履歴

| バージョン | 日付 | 内容 |
|---|---|---|
| v1.0 | 2026-05-21 | 初版（Phase 1A-1 〜 1A-5 のパターンを言語化）|

---

## このドキュメントの運用

- **更新タイミング**: 各 Phase 完了時に新しい知見を追記
- **更新方法**: ブランチ作成 → 修正 → PR → マージ
- **AI アシスタント連携**: claude.ai のプロジェクトナレッジに同ファイルをアップロード、Claude が自動参照
