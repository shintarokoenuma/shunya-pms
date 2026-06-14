# 製品概要1ページ構想 仕様確認書 v0.2（決定差分・2026-06-14 設計セッション2）

- ステータス: 設計確定（コード変更なし）
- 位置づけ: **本書は v0.1 §7 の未決点5つに対する「決定差分」のみ。要件本体は v0.1 が正**（docs/specs/product-overview-one-page-spec-confirmation-v0_1-2026-06-14.md）。
- 根拠資料を読み直して確定（記憶でなく）: 見積エンジン仕様書 v1.0 / 2026-05-16 BOM設計 / product-sample 仕様書 v1.0(2026-06-06) / color-master 仕様書(2026-06-01)。

## 決定1 — 北極星(1ページ)先行・QE-1 は1ページ完了後
- 1ページ構想を先に実装し、QE-1（量産見積・取り切り）は1ページ完了後に着手。
- 理由: QE-1 の入力は BOM の数値のみで、色名/付属マトリクス(β)に非依存。器が揃ってからの方が QE-1 入力が明確。
- QE-1 仕様書（見積エンジン v1.0）は **Specification 経由 BOM 前提で古い** → 決定2を先に整えてから見直す。

## 決定2 — BOM は Product 直結を正系に
- Product 直結 BOM（productId）を正系とする。Specification 経由 BOM（specificationId）は option として残す（**破壊的 migration なし**）。
- specificationId は三位一体（仕様/パターン/デザイン）復活の余地として **optional 化のみ**。
- ⚠️ 現 nullability は未確認 → **着手時に live grep**（Bom.specificationId / productId の実 nullability）。

## 決定3 — 実装順（依存鎖）
- 順序: **B-064 数量マトリクス表示 → ③＋B-062 β → B-063 色名供給 → B-027 絵型**。
- B-064 を先頭にする理由: スキーマ変更ゼロ・視覚アンカーになる。
- ③ は B-062 の最初のサブステップ。
- 依存鎖: 「③→B-062→B-063」は一本鎖。B-064 と B-027 は独立。

## 決定4 — 色名供給（B-063 の中身）
- **Material.availableColors** を `{ colorNumber(自社), supplierColorCode(先方C/#・結合キー必須), supplierColorName(任意) }` 形へ（Json のため **migration 不要**）。
- **Color マスターに colorNameEn 追加**（下げ札・輸出向け）。実装形は Color が build 済みかで変わる → **着手時 live grep**。Zh/Vi は保留。
- **B-063 スコープが大きい**:
  - (i) color-master 仕様書は仮置き/要レビュー → **未 build なら色マスター確定＋build を内包**。
  - (ii) カラーウェイ⇔マスター色の必須紐付け = **Sku 色の FK 化**（本来 Phase 1B 送り）の前倒し。

## 決定5 — B-060（SPタイトル）は方針①
- 方針①（**バリデータのみ必須化・migration なし**）を採用。categoryId と同じ確立パターン。
- 北極星の依存鎖には挿さず、**次の SP 作業に相乗り**。
- SP title は product-sample 仕様書(2026-06-06)に無い後付け・**現 nullable のはず** → 着手時 live grep。

## 着手時 live grep チェックリスト（決定に紐づく未確認点の集約）
- Bom.specificationId / productId の現 nullability（決定2）
- model Color の存在・build 状況・colorNameEn の有無（決定4）
- Sku 色列（colorCode/colorName/colorHex/pantone）の現状・FK 化の余地（決定4-ii）
- SampleProduction.title の現 nullable 状態（決定5）
- Sku の色×サイズ現フィールド・products/[id] ページ骨格・既存描画（決定3 / B-064）

## backlog 反映（v0.1 §6 からの更新なし・確認のみ）
- B-064 数量マトリクス表示 / B-062 β / B-063 色名解決 / B-027 絵型
- B-061(C)=不要クローズ / B-060(B=SPタイトル)=方針①で相乗り
