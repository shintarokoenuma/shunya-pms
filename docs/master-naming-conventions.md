# shunya マスターデータ命名規則

**作成日**: 2026-05-23
**バージョン**: v1.0
**対象**: マスター管理者（Shin および shunya 社内スタッフ）

---

## 目的

shunya 生産管理システムのマスターデータを **一貫した命名** で運用するためのガイドライン。
同義語が乱立することを防ぎ、検索性・選択性を高める。

例:
- ❌ 「パンツ」と「ボトム」と「ボトムス」が混在
- ❌ 「シャツ」と「Shirt」と「上着」が混在
- ✅ 「パンツ」「シャツ」など、shunya 標準の用語に統一

---

## 1. 基本原則

### 原則 1: 日本語を正、英語は補助

- マスター名の主言語は **日本語**
- 英語名（`xxxNameEn`）は補助情報として記録
- 検索・選択時は日本語で行う

### 原則 2: shunya 標準用語に統一

- 同義語がある場合は、shunya での標準呼称を採用
- 業界での一般的な呼称ではなく、shunya での運用上の呼称を優先

### 原則 3: 命名は短く明確に

- カテゴリ名は 10 文字程度を目安
- 略称は使わない（例: ✕「ＴS」 ✓「Tシャツ」）

### 原則 4: ステータスは具体的・明確に

- 同義語・類義語のリストアップを心がける
- 不明な場合は本ドキュメントを更新してから登録

---

## 2. 商品カテゴリ命名規則

### 2.1 階層構造

shunya では商品カテゴリを **3 階層** で管理する:

```
レベル 1: 大分類    ← 商品の大きな分類（5〜10 種類程度）
  ↓
レベル 2: 中分類    ← 大分類の中の細分類
  ↓
レベル 3: 小分類    ← 中分類の中の具体的なアイテム種別
```

### 2.2 大分類（レベル 1）の標準セット

【TODO: Shin さんに確定してもらう】

候補例:
- トップス
- ボトムス（※「パンツ」ではなく「ボトムス」を採用するか要確認）
- アウター
- ワンピース
- セットアップ
- 小物
- アクセサリー

### 2.3 中分類（レベル 2）の例

【TODO: Shin さんに確定してもらう】

トップス配下の例:
- カットソー
- シャツ
- ニット
- ブラウス
- ジャケット

### 2.4 小分類（レベル 3）の例

【TODO: Shin さんに確定してもらう】

カットソー配下の例:
- 半袖カットソー
- 長袖カットソー
- ノースリーブカットソー

---

## 3. 同義語マッピング

shunya 標準呼称 ⇔ 一般的な呼称

| shunya 標準 | 同義語 / 関連語 | 採用理由 |
|---|---|---|
| 【TODO】 | 【TODO】 | 【TODO】 |

【TODO: Shin さんに記入してもらう】

例:
| shunya 標準 | 同義語 / 関連語 | 採用理由 |
|---|---|---|
| パンツ | ボトム、ボトムス | shunya 社内での慣習 |
| Tシャツ | カットソー、半袖シャツ | カットソーは別カテゴリで定義 |

---

## 4. カテゴリコード命名規則

### 4.1 基本ルール

- 英大文字、数字、ハイフン、アンダースコアのみ使用
- 最大 10 文字（DB の VARCHAR(10) 制約）
- 階層を反映させる（推奨）

### 4.2 推奨パターン

【TODO: 推奨パターンの具体例を Shin さんに確定してもらう】

代替パターン（連番方式）:

```
大分類: CAT-001 ～ CAT-099
中分類: CAT-101 ～ CAT-999
小分類: CAT-1001 ～
```

【TODO: どちらのパターンを採用するか Shin さんに確定してもらう】

---

## 5. その他マスターの命名規則

### 5.1 クライアント・ブランド・仕入先・工場・外注先

法人名は **正式名称** を使用:
- ✓ 「株式会社サンプル」
- ✕ 「サンプル株式会社」（語順注意）
- ✕ 「サンプル」（略称）

英語名は登記英語名:
- ✓ 「Sample Co., Ltd.」

### 5.2 諸経費カテゴリ

【TODO: Phase 1A-8 実装時に追記】

### 5.3 納品先・バイヤー

【TODO: Phase 1A-10 / 1A-11 実装時に追記】

### 5.4 モデルコード

【TODO: Phase 1A-12 実装時に追記】

### 5.5 生地・副資材

【TODO: Phase 1A-13 実装時に追記】

業界用語マスター（`industry_term`）を活用し、生地名の同義語を統一する仕組みを検討。

---

## 6. 命名のチェックリスト

新規マスターデータを登録する際に確認:

- [ ] 既存マスターに類似名がないか検索した
- [ ] 同義語マッピング表（本ドキュメント 3 章）を確認した
- [ ] 日本語名が shunya 標準呼称になっている
- [ ] 英語名は登記英語名 or 業界標準英訳になっている
- [ ] コード（categoryCode 等）が命名規則に従っている
- [ ] 階層がある場合、適切な親カテゴリに紐付けている

---

## 7. 本ドキュメントの更新ルール

- マスターを実装するたびに該当セクションを更新
- 同義語が新たに発覚した場合は 3 章のマッピング表に追記
- Shin さんが最終承認

---

## 8. 関連ドキュメント

- マスター実装パターン: `docs/shunya-master-patterns.md`
- 商品カテゴリ仕様: `docs/phase1a-7-progress.md`
- 戦略再確認メモ: `docs/phase-strategy-confirmation-2026-05-23.md`

---

## 9. 将来構想

Phase 1B 以降で実装予定:

- AI による類似カテゴリ提案
  - カテゴリ登録時に既存カテゴリと類似度チェック
  - 「『パンツ』を登録しようとしていますが『ボトムス』が既にあります」のような警告
- 業界用語マスター（`industry_term`）の本格活用
  - 同義語マッピングを DB 化
  - 多言語翻訳の精度向上

---

## Buyer マスターの buyerCode 命名規則

（2026-05-25 追記、Phase 1A-11 仕様確定議論より）

Buyer は業務シナリオによって 2 種類の意味を持つため、buyerCode の付け方も使い分ける。

### Case A：ブランド OEM の卸先として登録

Buyer 自身の名前を使う：

| Client | Buyer | buyerCode |
|---|---|---|
| MARKA | BEAMS | `BEAMS` |
| MARKA | IF | `IF` |

Client 紐付けを buyerCode に明示したい場合は `<Client略号>-<Buyer略号>` も可：

| Client | Buyer | buyerCode |
|---|---|---|
| MARKA | BEAMS | `MARKA-BEAMS` |

### Case B：直接 OEM の事業部単位として登録

`<Client略号>-<事業部略号>` 形式：

| Client | 事業部 | buyerCode |
|---|---|---|
| BEAMS | 国内事業部 | `BEAMS-DOM` |
| BEAMS | インターナショナル事業部 | `BEAMS-INTL` |
| BEAMS | PB 事業部 | `BEAMS-PB` |
| United Arrows | 国内事業部 | `UA-DOM` |

### 略号の付け方の目安

- Client 略号：大文字英字 2-8 文字（`BEAMS`、`MARKA`、`UA` など）
- 事業部略号（Case B）：以下の標準語を推奨
  - `DOM`：国内事業部（Domestic）
  - `INTL`：海外・インターナショナル事業部
  - `PB`：プライベートブランド事業部
  - `EC`：EC・オンライン事業部
  - `WHO`：卸事業部
  - 上記に当てはまらない場合は事業部名の英字略号（最大 8 文字）

詳細な議論経緯は `docs/phase1a-11-spec-confirmation-2026-05-25.md` を参照。

---

## DeliveryDestination マスターの destinationCode 命名規則

（2026-05-27 追記、Phase 1A-10 仕様確定議論より）

DeliveryDestination は Buyer の物理拠点（店舗・倉庫・物流センター等）。
基本パターンは `<buyerCode>-<location>` 形式。強制ではなく推奨（DB 制約は `@@unique([companyId, destinationCode])` のみ）。

### 標準パターン：`<buyerCode>-<location>`

| Buyer | DD | destinationCode |
|---|---|---|
| BEAMS-DOM | 渋谷店 | `BEAMS-DOM-SHIBUYA` |
| BEAMS-DOM | 原宿店 | `BEAMS-DOM-HARAJUKU` |
| BEAMS-DOM | 新宿店 | `BEAMS-DOM-SHINJUKU` |
| BEAMS-INTL | LA 店 | `BEAMS-INTL-LA` |
| BEAMS-PB | 倉庫 1 | `BEAMS-PB-WH01` |
| ALPHA（Case A 型 Buyer）| 直営店 | `ALPHA-FLAGSHIP` |
| ALPHA | 表参道店 | `ALPHA-OMOTESANDO` |
| MARKA-BEAMS | 渋谷店 | `MARKA-BEAMS-SHIBUYA` |

### location 部分の付け方の目安

| 種別 | 略号パターン | 例 |
|---|---|---|
| 国内店舗 | 区市町村 or 都市の英字略号 | `SHIBUYA / HARAJUKU / SHINJUKU / GINZA / OSAKA / NAGOYA` |
| 海外店舗 | 都市略号（IATA 3 文字コードでも可）| `LA / NYC / PARIS / SEOUL / TYO` |
| フラッグシップ | `FLAGSHIP` | `ALPHA-FLAGSHIP` |
| 倉庫 | `WH` + 連番 | `WH01 / WH02` |
| 物流センター | `DC` + 識別子（Distribution Center）| `DC-NARITA / DC01` |
| 配送センター | `LC` + 識別子（Logistics Center）| `LC-CHIBA` |
| ポップアップ | `POP-` + 地名 | `POP-OMOTESANDO` |

### 略号の付け方ルール

- 大文字英数字 + ハイフン
- 最大 50 文字（schema 制約：`@db.VarChar(50)`）
- buyerCode をプレフィックスにすることで一意性を自然に担保
- ハイフンが重なる視認的混乱は問題なし（`BEAMS-DOM-SHIBUYA` でトークン構造が明瞭）

### Brand との関係

destinationCode には Brand 情報は混ぜない。理由：

- 1 つの DD で複数 Brand の商品を受け入れるケースがある（BEAMS渋谷店で ALPHA も BETA も受け取る）
- Brand は商品 identity、DD は物理拠点、レイヤーが違う
- buyerCode に Brand 情報が必要なら、それは buyerCode の命名で対応済み（Phase 1A-11）

destinationCode は「どの Buyer のどの物理拠点か」だけを表現。Brand とは独立。

### 例外パターン

業務上の都合で標準パターンから外れる場合：

| ケース | destinationCode 例 |
|---|---|
| Buyer 紐付きが薄い拠点 | `BEAMS-CENTRAL-WH` |
| 複数 Buyer 共用倉庫 | `JOINT-WH-NARITA` |
| 一時的なポップアップ拠点 | `BEAMS-POP-OMOTESANDO` |

詳細な議論経緯は `docs/phase1a-10-spec-confirmation-2026-05-27.md` を参照。
