# 引き継ぎメモ (2026-06-14 設計セッション2 / 1ページ構想の未決5点を全確定・コード変更なし)

## ⓪ プロジェクト棲み分け（毎回必須）
- shunya-pms（shintarokoenuma/shunya-pms・~/shunya-production-system・shunya-pms-web-production.up.railway.app）と saagara-v2 は完全に別物。実装指示書は冒頭に【対象プロジェクト】ヘッダ固定。貼る前に ~/shunya-production-system を開いているか目視。
- docs/CLAUDE.md は別プロジェクト混入ファイル。無視。docs 整理は B-037。

## ⓪-2 PR URL 3点セット
- ① マージ前UI確認=ローカル(npm run dev→localhost:3000 / dev hopper:12921)
- ② マージ=GitHub PR→Railway自動デプロイ=本番反映(不可逆)
- ③ マージ後=本番URL + Railwayデプロイログ目視

## ① 本セッションの成果（コード変更なし・設計確定）
- v0.1 §7 の未決点5つ（実装順・北極星vsQE-1・BOM寄せ方・改訂2点・B方針）を全確定。
- 仕様確認書 v0.2（決定差分）= docs/specs/product-overview-one-page-spec-confirmation-v0_2-2026-06-14.md（新規）。要件本体は v0.1 が正。
- 根拠資料を読み直して確定（記憶でなく）: 見積エンジン仕様書 v1.0 / 2026-05-16 BOM設計 / product-sample 仕様書 v1.0(2026-06-06) / color-master 仕様書(2026-06-01)。

## ② 確定事項（5決定）
- 決定1: 北極星(1ページ)先行・QE-1 は1ページ完了後。QE-1 入力は BOM 数値のみで色名/βに非依存。QE-1 仕様書は Specification 経由 BOM 前提で古く、決定2を先に整える。
- 決定2: BOM は Product 直結を正系に・Specification 経由は option で残す（破壊的 migration なし）。specificationId は三位一体復活余地として optional 化のみ。現 nullability 未確認（着手時 live grep）。
- 決定3: 実装順 = B-064 数量マトリクス表示 → ③+B-062 β → B-063 色名供給 → B-027 絵型。B-064 先頭=スキーマ変更ゼロ・視覚アンカー。③ は B-062 の最初のサブステップ。依存鎖「③→B-062→B-063」一本鎖、B-064・B-027 独立。
- 決定4: Material.availableColors を {colorNumber(自社), supplierColorCode(先方C/#・結合キー必須), supplierColorName(任意)} へ（Json=migration不要）。Color に colorNameEn 追加（実装形は Color build 済みかで変わる・着手時 live grep。Zh/Vi 保留）。【B-063 スコープ大】(i) color-master 仕様書は仮置き/要レビュー→未 build なら色マスター確定+build を内包。(ii) カラーウェイ⇔マスター色 必須紐付け=Sku 色 FK 化（Phase 1B 送り）の前倒し。
- 決定5: B-060(SPタイトル) 方針①（バリデータのみ・migration なし）。categoryId と同じ確立パターン。北極星鎖に挿さず次の SP 作業に相乗り。SP title は仕様書(2026-06-06)に無い後付け・現 nullable のはず（着手時 live grep）。

## ③ Railway環境（前回継続）
- 本番DB postgres-production/postgres-ab6d/shuttle:16099（migrate deploy・_prisma_migrations あり）
- dev DB postgres-development/hopper:12921（db push・_prisma_migrations 無し・migrate系打たない）
- migration 31本（増減なし）。GCS dev=...-dev / prod=...-prod。

## ④ dev DB（hopper:12921・変化なし）
- bom_items=5 / po_items=5 / テスト品番 AOI-26AW-CUT_SEWN-001（id 7671eb90-4bc8-46e0-996b-2e119550be80）温存。

## ⑤ 次セッション優先順
1. B-064 数量マトリクス表示の実装指示書作成（最初の実装）。着手前 live grep: Sku の色×サイズ現フィールド／products/[id] ページ骨格／既存描画。スキーマ変更ゼロ見込み＝dev 確認・本番 smoke test。
2. ③+B-062 β の設計詳細。着手前 live grep: Bom.specificationId/productId の現 nullability・BomItem 現フィールド・調達カラーの持ち方（新テーブル or JSON）。migration あり＝三重ガード。
3. B-063 スコープ確定。着手前 live grep: model Color の存在・colorNameEn の有無・Sku 色列の現状。未 build なら色マスター確定+build を内包。
4. B-027 絵型は最後。
5. B-060 は方針①で次の SP 作業時に相乗り。

## ⑥ 1ページ傘下 backlog
- B-064 数量マトリクス表示 / B-062 β / B-063 色名解決 / B-027 絵型
- B-061(C)=不要クローズ / B-060(B=SPタイトル)=方針①で相乗り
- 継続: B-048 / WorkOrder編集UI / B-037
- QE-1 は北極星完了後（再開時に Excel2点を参照資料化・再添付依頼。QE-1 仕様書は Specification 経由 BOM 前提で古い=決定2に合わせ見直し）。B-057 は QE-1 後。逆転記(A)は不要確定。

## ⑦ 本日マージされた PR
- なし（設計セッション）。docs: 仕様確認書 v0.2 追加 + handover 更新（main 直push）。

## ⑧ 次セッション冒頭の手順
1. このメモを貼り付け→状態復元
2. shunya-design-reread スキルで、着手機能の spec を読み直してから設計を語る（記憶で組み立てない）。B-064 着手なら ⑤-1 の live grep 項目を先に潰す。
3. git log origin/main --oneline -5 で先頭確認
4. ⑤-1（B-064 実装指示書）から着手
