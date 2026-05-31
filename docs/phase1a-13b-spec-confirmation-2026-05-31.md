# Phase 1A-13b Material（素材マスター）生地仕様・規格・貿易データ UI 化 仕様確定議事録

**作成日**: 2026年5月31日
**バージョン**: v1.0（確定・実装着手可）
**ステータス**: 設計確定
**前提環境**: dev DB（`postgres-development`）優先、本番は smoke test のみ

---

## 1. 目的

1A-13a で実装済みの Material マスターのプレースホルダ（「後続フェーズで追加予定」カード）を、
生地特有・規格・貿易データの実フィールドで置き換える。DB 列は全て既存のため **migration 不要**、
本番 DB スキーマは変更しない（PR #44 自動 migrate の対象外）。

---

## 2. 現状確認（Claude Code read-only で確定）

| 項目 | 確定事実 |
|---|---|
| DB 列 | 生地系・規格・貿易・画像の全列が現行 schema に存在（migration 不要） |
| status | `MaterialStatus` enum 化済み（4値） |
| 1A-13a-fix | `primarySupplierId` 必須 + relation、複合 unique `[companyId, primarySupplierId, materialCode]` |
| 現行フォーム | 4カード ＋プレースホルダカード（473行）|
| バリデータ | 生地系フィールド未定義（grep 0件）＝今回の追加対象 |

---

## 3. 確定事項

| # | 論点 | 決定 |
|---|---|---|
| A-1 | 実装層 | バリデータ + UI（フォーム・詳細）のみ。schema 変更なし |
| A-2 | カード構成 | 基本情報 → 分類・仕入先 →【生地仕様】→【規格・標準】→ 単価 →【貿易】→ メモ・ステータス。プレースホルダ撤去 |
| A-3 | 出し分け | **なし（常時全表示）**。materialType による条件表示はしない |
| B-1 | fabricWeight 目付 | g/m²・Decimal(8,2)・任意・0超 |
| B-2 | fabricWidth 生地巾 | cm・Decimal(8,2)・任意・0超 |
| B-3 | composition 組成 | テキスト・任意 |
| B-4 | swatchImageUrl 生地見本 | URL テキスト・任意・http(s) 形式チェック |
| B-5 | standardUsage 標準用尺 | m/枚・Decimal(8,4)・任意・0超 |
| B-6 | standardLossRate 標準ロス率 | %・Decimal(5,2)・任意・0〜100 |
| C-1 | hsCode HSコード | テキスト・任意・形式は緩め（厳密検証なし）|
| C-2 | originCountry 原産国 | 既存 `countries.ts` の Select 流用・任意 |
| C-3 | imageUrl 代表画像 | URL テキスト・任意・基本情報カード末尾・http(s) 形式チェック |
| D-1 | JSON 2列 | `compositionData` / `availableColors` は **Phase 2 送り**（繊維・色マスター未整備）|
| D-2 | 一覧テーブル | 既存（名称→コード列順）据え置き。生地系は詳細でのみ表示 |
| D-3 | 多言語名 | 既存踏襲（列のみ）|

---

## 4. 実装手順（patterns §12 準拠・Phase 2/3 のみ）

1. 論理層: `src/lib/validators/material.ts` に9フィールド追加（§3 B-1〜B-6 + C-1〜C-3）→ tsc clean → **論理層コミット**
2. UI 層: `material-form.tsx`（3カード追加・imageUrl 追加・プレースホルダ撤去）/ `actions/materials.ts`（create/update 受け渡し）/ 詳細ページ / 編集ページ → tsc clean → **UI コミット**
3. PR: push → PR → マージ（**migration 非含・本番 DB 非接触**）→ デプロイ確認 → dev で動作確認7項目

---

## 5. Phase 2 申し送り

- `compositionData`（構造化組成）UI 化 ← 繊維マスター整備後
- `availableColors`（色展開）UI 化 ← 色マスター整備後
- 画像のファイルアップロード化（現状は URL テキスト手入力）← ストレージ整備後

---

## 6. 改訂履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-05-31 | v0.1 | 初版ドラフト・要確認3点 |
| 2026-05-31 | v1.0 | Q1=出し分けなし / Q2=URL入力 / Q3=JSON Phase2 を確定。実装着手可 |
| 2026-05-31 | v1.1 | §4 「8フィールド」→「9フィールド」訂正 (§3 表の機械的集計 = B-1〜B-6 + C-1〜C-3 = 9) |
