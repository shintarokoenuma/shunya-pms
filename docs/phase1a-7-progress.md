# Phase 1A-7: 商品カテゴリ（ProductCategory）進捗メモ

**作成日**: 2026-05-23
**状態**: 仕様確定済み、実装未着手

---

## 1. 概要

shunya 生産管理システムの「商品カテゴリ」マスターを実装する。
品番カルテとモデルコードの分類軸として使用される、抽象的なマスター。

### 既存マスターとの違い

| 観点 | Factory / Contractor | ProductCategory |
|---|---|---|
| 物理的存在 | あり（会社・個人） | なし（抽象的な分類） |
| 連絡先・住所 | あり | なし |
| 担当者リレーション | あり | なし |
| 主担当の概念 | あり | なし |
| 階層構造 | なし | あり（3 階層、self-reference） |
| 標準値（業務支援） | なし | あり（用尺・ロス率・工賃） |
| 規模感 | 大規模（7+1カード） | 小規模（2〜3カード予定） |

---

## 2. 仕様確定事項（2026-05-23 議論結果）

### 2.1 階層レベル

**3 階層**: 大分類 → 中分類 → 小分類

例:
- レベル 1（大分類）: トップス
- レベル 2（中分類）: カットソー
- レベル 3（小分類）: 半袖カットソー

### 2.2 管理担当者

**マスター管理者で十分**（assignedToUserId は追加しない）

理由:
- カテゴリは全社共有マスター
- 特定担当者を紐付ける業務上の必要性が薄い

### 2.3 命名統一ルール

**Phase 1A-7 での対応**:
- `@@unique([companyId, categoryName])` 追加で完全一致重複を防止
- `docs/master-naming-conventions.md` で運用ガイドラインを文書化

**Phase 1B 以降の対応**:
- AI による類似カテゴリ提案（例: 「パンツ」を入力すると「ボトム」があれば警告）
- カテゴリ作成時に既存カテゴリと類似度チェック

### 2.4 標準値の使われ方

| 標準値 | Phase 1A-7 | Phase 1B 以降 |
|---|---|---|
| 標準用尺（standardFabricUsage） | UI で手動入力 | 生地幅やデザインで大きく異なるため自動入力は難しい |
| 標準ロス率（standardLossRate） | UI で手動入力 | - |
| 標準縫製工賃（standardSewingFee） | UI で手動入力 | 過去のアイテムや同ブランドのログから AI が参照工賃を提案 |

### 2.5 MOQ / サイズ JSON フィールド

| フィールド | スキーマ | UI |
|---|---|---|
| `defaultMoqTiers` | 残す（既存） | Phase 2 |
| `defaultSizeOptions` | 残す（既存） | Phase 2 |

Phase 1A-7 では JSON 編集 UI は実装しない。
見積もりエンジン（Phase 1B）で実装する方が、ニーズが明確な状態で良い UI が作れる。

### 2.6 ステータス enum

**`ProductCategoryStatus` を新設**

```prisma
enum ProductCategoryStatus {
  ACTIVE
  ARCHIVED
}
```

**2 段階**: Factory / Contractor の 3 段階（ACTIVE / PAUSED / ARCHIVED）と異なり、PAUSED は除外。

理由:
- カテゴリに「一時停止」の業務意味は弱い
- 「使う / 廃止」のシンプルな 2 値で十分

物理削除は別操作として実装（Factory / Contractor と同じ）。
紐づくデータがあれば `checkUsage` で削除拒否される機構を継承。

### 2.7 CSV インポート/エクスポート

**Phase 1A-7 では実装しない**

Phase 1A-14 で全マスター共通の汎用機能として一括実装する。
詳細は `docs/phase1a-14-csv-import-export-plan.md` を参照。

### 2.8 シードデータ

**初期データ投入なし**

各テナント（shunya 以外の将来顧客）でカテゴリは異なるため、固定の初期データは入れない。
shunya 用のカテゴリは Phase 1A-14 の CSV インポート機能で投入する。

---

## 3. 既存スキーマからの変更点

### 3.1 enum 新設

```prisma
enum ProductCategoryStatus {
  ACTIVE
  ARCHIVED
}
```

### 3.2 ProductCategory モデルの変更

| フィールド | Before | After |
|---|---|---|
| `status` | `String @default("ACTIVE") @db.VarChar(20)` | `ProductCategoryStatus @default(ACTIVE)` |
| `categoryName` | UNIQUE なし | `@@unique([companyId, categoryName])` 追加 |
| `level` | デフォルト 1 | 1〜3 のバリデーション（Zod 側で）|

### 3.3 追加するインデックス

```prisma
@@index([companyId, status])
@@index([companyId, level])
```

### 3.4 既存フィールドで変更しないもの

- 階層構造（parentCategoryId、self-relation）はそのまま
- 標準値（standardFabricUsage / standardLossRate / standardSewingFee）はそのまま
- JSON フィールド（defaultMoqTiers / defaultSizeOptions）はスキーマに残すが UI は Phase 2

---

## 4. 実装手順（shunya-master-patterns v1.1 準拠）

### Phase 1: スキーマ
- [ ] ProductCategoryStatus enum 新設
- [ ] status を String → ProductCategoryStatus に変更
- [ ] `@@unique([companyId, categoryName])` 追加
- [ ] `@@index([companyId, status])` 追加
- [ ] `@@index([companyId, level])` 追加
- [ ] migration 作成 + 適用
- [ ] tsc clean 確認
- [ ] Phase 1 コミット

### Phase 2: 論理層
- [ ] `src/lib/validators/product-category.ts` 作成
  - level は 1〜3 のバリデーション
  - 階層整合性チェック（parentCategoryId が指す親の level + 1 == 自分の level）
- [ ] `src/app/(app)/product-categories/_components/labels.ts` 作成
- [ ] `src/lib/actions/product-categories.ts` 作成（8 関数構成）
  - 一覧時に親子情報を含めて取得
  - 削除時の checkUsage（Product / ModelCode から参照されているか確認）
- [ ] tsc clean 確認
- [ ] Phase 2 コミット

### Phase 3: UI
- [ ] form / delete-button / table / search / pagination 作成
- [ ] ページ群（page / new / [id] / [id]/edit）作成
- [ ] **階層 UI の検討必要**: 一覧でツリー表示か、フラット + 階層パス表示か
  - 推奨: フラット + 「親カテゴリ」列で表示
- [ ] nav-items.ts に追加（既に enabled: true で登録されているか要確認）
- [ ] tsc clean 確認
- [ ] Phase 3 コミット

### Phase 4: PR & デプロイ
- [ ] push → PR 作成
- [ ] PR マージ
- [ ] main 最新化 + ブランチ削除
- [ ] 本番デプロイ完了確認
- [ ] 動作確認 7 項目

---

## 5. 次セッションでの再開ポイント

次セッション開始時の最初のアクション:

```bash
# 1. メインブランチ最新化
git checkout main
git pull origin main

# 2. 本ドキュメントを再確認
cat docs/phase1a-7-progress.md

# 3. 関連ドキュメント確認
cat docs/master-naming-conventions.md
cat docs/phase1a-14-csv-import-export-plan.md

# 4. 既存 ProductCategory スキーマ確認
grep -A 50 "^model ProductCategory" prisma/schema.prisma

# 5. ブランチを切る
git checkout -b feat/product-category

# 6. Phase 1（スキーマ）から開始
```

---

## 6. 参照

- 設計書: `docs/20260516_03_仕様書_Part3_機能要件.md`
- マスター実装パターン: `docs/shunya-master-patterns.md` v1.1
- 戦略再確認メモ: `docs/phase-strategy-confirmation-2026-05-23.md`
- 命名規則: `docs/master-naming-conventions.md`
- Phase 1A-14 計画: `docs/phase1a-14-csv-import-export-plan.md`
