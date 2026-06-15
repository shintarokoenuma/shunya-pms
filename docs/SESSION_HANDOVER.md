# 引き継ぎメモ (2026-06-15 セッション4 / B-062 β 先行 PR #83 本番反映済み)

## ⓪ プロジェクト棲み分け（毎回必須）
- shunya-pms（shintarokoenuma/shunya-pms・~/shunya-production-system・shunya-pms-web-production.up.railway.app）と saagara-v2 は完全に別物。実装指示書は冒頭に【対象プロジェクト】ヘッダ固定。貼る前に ~/shunya-production-system を開いているか目視。
- docs/CLAUDE.md は別プロジェクト混入ファイル。無視。docs 整理は B-037。

## ⓪-2 PR URL 3点セット
- ① マージ前UI確認=ローカル(npm run dev→localhost:3000 / dev hopper:12921)。コード含むPRは必須。型/lintクリーンなら commit→push→PR open まで Claude Code 自走可。人が握るのは①ローカル目視と②マージの2点。
- ② マージ=GitHub PR→Railway自動デプロイ=本番反映(不可逆)。
- ③ マージ後=本番URL + デプロイログ目視。migration入りPRは「Applying migration ...」行の目視が③の本体。
- 【dev起動の罠・本セッションで遭遇】schema/migration変更後に dev が古いプロセスを掴むと prisma.<新model> が undefined → findFirst エラー / Internal Server Error。対処: 旧プロセスを lsof -ti:3000/3001 | xargs kill -9 で完全停止 → npx prisma generate → rm -rf .next → npm run dev で 3000 起動を確認。ポートが3001にズレてないか必ず確認。

## ① 本セッションの成果
- B-062 β 先行 PR #83（squash f654ce5）マージ済み・本番反映確認済み（デプロイログ「Applying migration 20260615000000_b062_beta_product_colorway」「All migrations have been successfully applied.」目視・本番画面でカラー展開カード動作OK）。
- 設計確定: v0.4 仕様確認書を docs/specs/product-overview-one-page-spec-confirmation-v0_4-2026-06-15.md に保存（commit 6309de3）。
- 実装内容: ProductColorway + BomItemColorway 2テーブル新設（migration 32本目・CREATE TABLE 2本・ADD のみ非破壊）＋逆リレーション2行（Product.colorways / BomItem.colorways）＋ProductColorway CRUD（colors.ts 流儀）＋品番カルテ「カラー展開」カード（数量マトリクスの前）。

## ② β 設計の確定事項（v0.4・live grep 裏取り済み）
- カラーウェイの実体 = ProductColorway 新設（SKU の親・SKU 非依存）。Sku 由来は不採用（SKU 0件・生成導線なしのため北極星を縛らせない）。
- 資材×カラーウェイの C/# = BomItemColorway 子テーブル（ProductColorway を FK 参照）。JSON 案は B-063 の FK 化を阻むので不採用。
- 既存 BomItem 単色列（colorCode/colorName/pantone）は併存（全色共通資材=芯地等の受け皿）。「色変動品=BomItemColorway / 全色共通品=本体単色列」の二段構え。
- colorId? 列は ProductColorway に作成済みだが β では未配線。Color マスター連携・色名解決・Sku 色 FK 化は B-063。
- live grep 確定: Bom.specificationId/productId は既に nullable（決定2=③ は migration 不要・規約整理のみ）。Color マスターは CRUD フル build 済み（8 export）=B-063 大幅減量。Color に colorNameEn 列なし（grep が拾うのは Sku 側）=改訂2 は新規列 migration（B-063）。Material.availableColors は現状 [{name,code,hex}]・改訂1 未適用（JSON ゆえ migration 不要・B-063）。

## ③ Railway環境（唯一の正）
- 本番DB postgres-production/postgres-ab6d/shuttle:16099（migrate deploy・_prisma_migrations あり）。本セッションで postgres-ab6d.railway.internal:5432 経由の migrate deploy 成功を確認。
- dev DB postgres-development/hopper:12921（db push・_prisma_migrations 無し・migrate系打たない）。
- migration 32本（本セッションで +1: 20260615000000_b062_beta_product_colorway）。GCS dev=...-dev / prod=...-prod。

## ④ dev DB（hopper:12921）
- db push で product_colorways / bom_item_colorways 反映済み。テスト品番 AOI-26AW-CUT_SEWN-001（id 7671eb90-4bc8-46e0-996b-2e119550be80）にカラーウェイ A(ブラック)/B(ベージュ) を検証投入。bom_items=5 / po_items=5 / skus=0 は変化なし。
- ✅【クローズ・2026-06-15 セッション5】本番(shuttle:16099)に検証で投入していた ProductColorway A/B（id ef88999f… / f3535fc5…）を物理削除・COMMIT 済み。id 限定2件・ドライラン(ROLLBACK)検証後に本実行・連鎖被害なし（bom_item_colorways=0）。本番 product_colorways=0 を別接続および本番画面で確認済み。本件クローズ。
- dev DB(hopper:12921) 側の検証カラーウェイ A/B は dev のため残置（検証用・実害なし）。

## ⑤ 次セッション優先順
1. β 次 PR: BomItemColorway 編集 UI（付属マトリクスのカラーウェイ×C/# 入力）。着手前に colorway-section.tsx / bom-section.tsx の現状と BomItem 編集導線を live grep。schema は本セッションで作成済み=この PR は migration なし（UI/actions のみ）。
2. B-063 色名供給。実体は ①Color データ投入(50色・seed に未投入・dev/本番件数未確認) ②Color.colorNameEn 追加 migration ③Material.availableColors 改訂1 ④ProductColorway.colorId 配線＋Sku 色 FK 化。color-master §6 未確定7点の解決を含む。着手前に colors テーブル件数を dev/本番で確認。
3. B-027 絵型（最後・画像アップロード基盤・GCS 既存）。
4. B-060 SPタイトルは方針①で次の SP 作業に相乗り。

## ⑥ 1ページ傘下 backlog
- B-064 数量マトリクス表示=完了(#82) / B-062 β=先行PR #83 完了・次PR(BomItemColorway UI)残 / B-063 色名解決 / B-027 絵型。
- B-061(C)=不要クローズ / B-060(B=SPタイトル)=方針①で相乗り。
- 継続: B-048 / WorkOrder編集UI / B-037(docs整理) / SKU 生成導線（希望数の出どころ確定後・別タスク）。
- 【B-037 メモ】git status に未追跡ファイルが大量に散らかっている（docs/CLAUDE.md・docs/files 9〜12/・各種zip・skill/・files.zip 等）。後日まとめて整理する。3群に仕分け: (a)gitignore行き=zip/skill/files系（消さず .gitignore 追記で隠す） (b)中身照合してから add/破棄=docs直下に落ちた spec 群（docs/specs/ 正規版と重複確認） (c)削除候補=docs/CLAUDE.md（別プロジェクト混入）。read-only 調査（各ファイル素性を grep/diff）から始める。物理削除は不可逆ゆえ慎重に。
- QE-1 は北極星完了後（Excel2点を参照資料化・再添付依頼。QE-1 仕様書は Specification 経由 BOM 前提で古い=決定2に合わせ見直し）。B-057 は QE-1 後。逆転記(A)不要確定。

## ⑦ 本日マージされた PR / push
- PR #83: B-062 β 先行（ProductColorway 管理）squash f654ce5・マージ済み・本番 migration 適用確認済み。
- docs: v0.4 仕様確認書 6309de3（main 直push・docs単独）。
- main 先頭: f654ce5 → 6309de3 → 20734c4。
- 後始末: ローカル feat/b062-beta-product-colorway 削除済み。

## ⑧ 次セッション冒頭の手順
1. このメモを貼り付け→状態復元
2. shunya-design-reread スキルで β 次 PR の spec（v0.4 §2・§4）を読み直してから設計
3. git log origin/main --oneline -5 で先頭確認
4. ⑤-1（BomItemColorway 編集 UI）から着手。着手前 live grep
