# 製品概要1ページ構想 仕様確認書 v0.2 — 決定差分（2026-06-14 セッション2）

- ステータス: 設計確定（コード変更なし）。v0.1 §7 の未決点5つを全確定。
- ベース: product-overview-one-page-spec-confirmation-v0_1-2026-06-14.md（要件・5要素・付属マトリクス列構成・色二層モデルは v0.1 が正）。本書は v0.1 §7 の未決点に対する決定と設計根拠のみを記録する。
- 根拠資料（記憶でなく読み直して確定）: 見積エンジン仕様書 v1.0(2026-05-15) / 2026-05-16 BOM設計(.prisma) / product-sample 仕様確認書 v1.0(2026-06-06) / color-master 仕様確認書(2026-06-01)。

## 決定1（v0.1 §7-2 北極星 vs QE-1）: 1ページ先行
- 北極星(1ページ)を先行。QE-1 は1ページ完了後。
- 根拠: QE-1 の入力は BOM 由来の数値（usagePerUnit/lossRate/unitPrice/currency）＋数量＋マージン率のみ。色名(Colorマスター)もカラーウェイ別調達カラー(β)も入力に現れない。色名が要るのは4帳票であって見積計算ではない → QE-1 と B-062/B-063 は計算上独立。
- ただし QE-1 仕様書は `bom.version`「仕様書バージョンに紐付く BOM」を前提に書かれており、Specification 経由の旧設計に対して書かれている＝Product 直結の現実に対して古い。1ページ先行はこの前提(=決定2)を先に整える。

## 決定2（v0.1 §5 / §7-3 BOM 2系統）: Product 直結を正系に・Specification 経由は option で残す
- 2系統の正体（2026-05-16 設計を読み直して確認）: 元設計は BOM が Specification 経由の1本のみ（Bom.specificationId 必須リレーション・Specification と 1:1）。BomItem の色は colorCode/colorName/pantone の単色1組でカラーウェイ軸なし。QE-0 で Bom.productId（Product 直結）が後付けされ併存。Product 直結が足された理由は Specification モデルが休眠中だから。
- 決定: Product 直結を正系に寄せる。specificationId 列は消さない（三位一体管理 仕様書v_n↔パターンv_n↔デザインv_n を将来復活させる余地）。optional 化に留め、破壊的 migration はしない。
- 注意: 現在 specificationId が既に nullable か NOT NULL のままかは未確認（2026-05-16 設計では NOT NULL）。migration を伴うなら着手前に live grep。

## 決定3（v0.1 §7-1 実装順）
- B-064 数量マトリクス表示 → ③(BOM寄せ)+B-062 β → B-063 色名供給 → B-027 絵型。
- B-064 を先頭に置く理由: スキーマ変更ゼロ（既存 Sku 色×サイズの描画のみ）・最低リスクで前進・カラーウェイ軸を画面に先に可視化（β が鍵にする軸の視覚アンカー）。
- ③ を B-062 の最初のサブステップに畳む（どちらも BOM を触るので migration を2回に割らない）。
- 依存鎖「③→B-062→B-063」は一本鎖。B-064・B-027 は独立。

## 決定4（v0.1 §3-1 改訂2点）
- 改訂1 採用: Material.availableColors を { colorNumber(自社), supplierColorCode(先方C/#・結合キー・必須), supplierColorName(人が読むメモ・任意) } へ。
  - 根拠: β の調達カラー(C/#)とマスター色を B-063 で機械的に解決(C/#→自社番号→色名)するには、availableColors 側にも同じ番号(C/#)が無いと join できない。色名だけだと共通キーが無く解決不能。
  - availableColors は Json 列なのでこの変更は migration 不要（アプリ側の形＋バリデータ＋既存データバックフィルのみ）。
- 改訂2 採用: Color マスターに colorNameEn 追加。
  - 根拠: 色名必須の4帳票のうち下げ札は完成品に付き消費者に渡る→輸出・英語圏向けに英語色名の実需。工場指示書も海外工場なら英語が効く。
  - 実装形は Color マスターが build 済みかで変わる: 未 build なら初期スキーマに畳む(別 migration 不要)、build 済みなら新規列追加=migration。着手前に live grep。
  - Zh/Vi は中国/ベトナム工場帳票の実需が固まるまで保留（列パターンか ColorMultilingual 別テーブルかはその時点で判断）。
- B-063 スコープの発見（重要・着手時にスコープを切る前提）:
  - (i) B-063 は Color マスターが存在することを前提にしているが、color-master 仕様書(2026-06-01)はまだ「仮置き/要レビュー」（50色叩き台・§6 未確定7点）。未 build なら B-063 は「色マスターを確定して build する」（50色レビュー→未確定7点解決→migration→seed→CRUD UI）を実質内包する＝単なる紐付け1本より大きい。
  - (ii) v0.1 §3「製品カラーウェイ⇔マスター色の必須紐付け」は、カラーウェイ実体が現状 Sku 色次元なので Sku 色列の FK 化を意味する。color-master 仕様書 §5 は「SKU 等インライン色列の FK 化は Phase 1B 以降」と明示的に後回しにしている＝B-063 は Phase 1B 送りの Sku 色 FK 化をカラーウェイ次元に限り前倒しする。

## 決定5（v0.1 §7-5 B-060 SPタイトル必須化）
- 方針①（バリデータ必須化のみ・migration なし）で確定。
  - 根拠: プロジェクトの確立した型。SP 仕様書 §4-2 で categoryId を同じく「Zod で必須化・schema は optional のまま・migration 不要」で処理済み。SP の構造的識別キーは sampleNumber(SP-2026-xxxx)であり title は人が読むラベル→DB NOT NULL 化不要。① は既存データに触らず済む（既存 SP の NULL は放置可・② は人為的 backfill が必要で不自然）。
- タイミング: 北極星依存鎖に専用ステップを挿さない。次に SampleProduction のフォーム/actions を触る作業に相乗り。B-064 を遅らせない。
- 注意: SP title フィールドは SP 仕様書(2026-06-06)に出てこない＝QE-0e 検討中に後付けされたもの。②の「既存 NULL バックフィル」の文言から、title 列は既に存在し現在 nullable のはず。正確なフィールド名・nullability・既存バリデータ有無は指示書を書く前に live grep。

## 着手時 live grep チェックリスト（決定に紐づく未確認点の集約）
- Bom.specificationId / productId の現 nullability（決定2）
- model Color の存在・build 状況・colorNameEn の有無（決定4）
- Sku 色列（colorCode/colorName/colorHex/pantone）の現状・FK 化の余地（決定4-ii）
- SampleProduction.title の現 nullable 状態（決定5）
- Sku の色×サイズ現フィールド・products/[id] ページ骨格・既存描画（決定3 / B-064）

## backlog 反映（v0.1 §6 からの更新なし・確認のみ）
- B-064 数量マトリクス表示 / B-062 β / B-063 色名解決 / B-027 絵型
- B-061(C)=不要クローズ / B-060(B=SPタイトル)=方針①で相乗り
