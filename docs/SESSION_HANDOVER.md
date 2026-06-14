# 引き継ぎメモ (2026-06-14 設計セッション / 製品概要1ページ構想を北極星化・コード変更なし)

## ⓪ プロジェクト棲み分け（毎回必須）
- shunya-pms（shintarokoenuma/shunya-pms・~/shunya-production-system・shunya-pms-web-production.up.railway.app）と saagara-v2 は完全に別物。実装指示書は冒頭に【対象プロジェクト】ヘッダ固定。貼る前に ~/shunya-production-system を開いているか目視。
- docs/CLAUDE.md は別プロジェクト混入ファイル。無視。docs 整理は B-037。

## ⓪-2 PR URL 3点セット
- ① マージ前UI確認=ローカル(npm run dev→localhost:3000 / dev hopper:12921)※プロジェクトroot で実行
- ② マージ=GitHub PR→Railway自動デプロイ=本番反映(不可逆)
- ③ マージ後=本番URL + Railwayデプロイログ目視（migration入りPRは Applying migration 行が③の本体）

## ① 本セッションの成果（コード変更なし・設計確定）
- 慎太郎さんの「品番カルテ1ページに 絵型・品番・数量・付属(マトリクス)・カラー が揃うのが理想」を北極星として確定。代表仕様書 f24-so08（両面ファーパーカー量産仕様書）を読み解いて要件化。
- 仕様確認書 v0.1 を docs/specs/product-overview-one-page-spec-confirmation-v0_1-2026-06-14.md に保存（本セッションで新規）。
- 実スキーマ確認済み: Product / Sku / Bom / BomItem / SampleProduction / Specification / Material / Color（記憶でなく live grep + color-master 仕様確認書 2026-06-01 の読み直しで設計確定）。

## ② 確定事項
- 北極星=製品概要1ページ。5要素=品番/数量マトリクス(色×サイズ)/カラー展開/付属マトリクス/絵型。器(縦積みカード)は既存、欠落=数量マトリクス表示・付属マトリクス(β)・色名供給・絵型 の4点。
- C(BOM⇔SP紐付け)=不要確定(取り下げ)。軸はカラーウェイであってSPでない（運用/理想像/ページ構造の3方向で裏付け）。B-061(C)はクローズ。
- 色の二層モデル: 仕入色(先方C/#)はマスター化しない=BOM/POが文字列保持(調達カラー)。Colorマスター=認識・色名の権威源泉でサンプル指示書/量産仕様書/工場指示書/下げ札の4帳票で色名必須。橋渡しは素材ごと一度(Material.availableColors)。色名解決点=製品カラーウェイ⇔マスター色の必須紐付け(カラーウェイ実体は現状Sku色次元)。
- 付属マトリクス列=使用箇所/仕入先品番/サイズ・用尺/先方カラー品番(C/#)×カラーウェイ。左3列は色共通ベース、C/#のみカラーウェイ別=βのデータ構造を裏づけ。実スキーマ対応: 仕入先品番→BomItem.supplierItemCode・サイズ→sizeValue/sizeUnit・用尺→usagePerUnit/unit・先方カラー品番→調達カラー(β新設部分)。
- 改訂提案2点(要確定): (1)Material.availableColors を仕入先「番号」写像へ([{colorNumber自社, supplierColorCode先方}]) (2)Colorマスターに colorNameEn 追加(下げ札輸出向け)。

## ③ Railway環境マッピング（前回 §③ 継続・唯一の正）
- 本番DB: postgres-production / postgres-ab6d / shuttle.proxy.rlwy.net:16099（migrate deploy 運用・_prisma_migrations あり）
- dev DB: postgres-development / hopper.proxy.rlwy.net:12921（db push 運用・_prisma_migrations 無し・migrate dev/deploy は打たない）
- migration ファイル=31本（QE-0d 適用後・本セッションで増減なし）
- GCS: dev=shunya-pms-documents-dev / prod=shunya-pms-documents-prod

## ④ dev DB 状態（hopper:12921・前回から変化なし）
- bom_items=5 / po_items=5 / テスト品番 AOI-26AW-CUT_SEWN-001（id 7671eb90-4bc8-46e0-996b-2e119550be80）温存。マスター類・SP-2026-0001 等も従来どおり。

## ⑤ 次セッションの優先順（＝未決点）
1. 実装順の確定（素案: B-064 数量マトリクス表示 → B-062 β → B-063 色名供給 → B-027 絵型）。色名供給を β 直後に置く理由=βセルに色名が乗って初めて4帳票の必須要件を満たせる。
2. 北極星 vs QE-1 の優先（推奨: 1ページ先行。量産見積は数値計算で色名不要、器が揃ってからの方が QE-1 入力が明確）。
3. BOM 2系統（Product直結 / Specification経由）の寄せ方。製品ページに付属マトリクスを出すなら Product 直結に寄せるのが素直。
4. 改訂提案2点（§②）の確定。
5. B（SPタイトル）: 方針①(バリデータ必須化のみ・migrationなし／推奨) か ②(DB NOT NULL化・既存NULLバックフィル＋migration要) か、そもそも今やるか。

## ⑥ 1ページ傘下 backlog（再編後）
- B-062 β（付属マトリクス＝カラーウェイ×資材色）/ B-063 色名解決トラック / B-027 絵型(画像アップロード基盤) / B-064 数量マトリクス表示(新規)
- B-061(C)=不要クローズ / B-060(B=SPタイトル)=QE-0e小タスクとして存続
- 従来backlog継続: B-048(PO採番リトライP2002限定)/WorkOrder編集UI/B-037(docs整理)
- QE-1(量産見積・取り切り)は北極星 vs QE-1 の優先決定後。冒頭でExcel2点(27SS各プラント_サンプル品番 / INSONNIA_SMASHING_25SS_コスト)を読み解き参照資料化(チャット再添付依頼)。
- B-057(BOM→PO 下書き・量産方向)は QE-1 後。サンプル方向の逆転記(A)は不要確定済み。

## ⑦ 本日マージされた PR
- なし（設計セッション・コード変更なし）。
- docs: 製品概要1ページ 仕様確認書 v0.1 を docs/specs/ に追加 + 本 handover 更新（docs単独のため main 直push）。

## ⑧ 次セッション冒頭の手順
1. このメモを貼り付け→状態復元
2. shunya-design-reread スキルに沿って、着手機能の spec を読み直してから設計を語る（記憶で組み立てない。色マスターの轍）
3. git log origin/main --oneline -5 で先頭確認
4. ⑤の未決点（実装順・北極星vsQE-1・BOM寄せ方・改訂2点・B方針）から着手
