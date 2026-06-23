# 引き継ぎメモ (2026-06-23 セッション11 / 宿題③カテゴリコード体系の確定・dev カテゴリ整備・シーズンのプルダウン化 PR#92 本番反映＋データ移行完了)

## ⓪ プロジェクト棲み分け（毎回必須）
- shunya-pms（shintarokoenuma/shunya-pms・~/shunya-production-system・shunya-pms-web-production.up.railway.app）と saagara-v2 は完全に別物。実装指示書は冒頭に【対象プロジェクト】ヘッダ固定。貼る前に ~/shunya-production-system を開いているか目視。
- docs/CLAUDE.md は別プロジェクト混入ファイル。無視。docs 整理は B-037。

## ⓪-2 PR URL 3点セット
- ① マージ前UI確認=ローカル(npm run dev→localhost:3000 / dev hopper:12921)。型/lintクリーンなら commit→push→PR open まで Claude Code 自走可。人が握るのは①ローカル目視と②マージ。
- ② マージ=GitHub PR→Railway自動デプロイ=本番反映(不可逆)。
- ③ マージ後=本番デプロイログ目視。migration入りPRは「Applying migration ...」行が③の本体。migrationなしPRは「No pending migrations to apply.」が正常。
- 【dev起動の罠】schema/migration変更後・新action/型追加後は lsof -ti:3000,3001 | xargs kill -9 → npx prisma generate → rm -rf .next → npm run dev。
- 【index-browser罠】"use client" が "use server"(prisma同梱)から型 import すると @prisma/client がブラウザに漏れる。対処=型/定数を中立モジュール(src/lib/types/* ・src/lib/constants/*)に逃がす。※今セッションの season-types.ts は constants/ に置き work-order-types.ts 流の中立構成にした。
- 【監査網羅型の罠】Product に scalar を足すと products.ts の監査 before/after が要求しビルド失敗。※今セッション seasonType 追加時も before/after に手当て済み(漏れると tsc 落ちる)。
- 【$transaction timeout の罠】ループ内 upsert を $transaction で回す action は { timeout: 15000, maxWait: 10000 } 必須(P2028)。
- 【本番確認の罠】データ依存UIは本番にデータ無いと変更が見えない＝バグでない。本番に検証データを入れない(本番 /products/new で保存しない＝Phase 1A-15 再発防止)。

## ① 本セッションの成果（宿題③ カテゴリ＋シーズン 完結）
### 1-1 確認書 v1.0 / v1.1（docs）
- category-code-spec-confirmation-v1_0（PR #d1c362b・docs/specs/ 保存済み）= カテゴリ軸のみ。
- category-code-spec-confirmation-v1_1（docs ルートに在席。品番フォーマットの思想統合＝カテゴリ＋シーズン）。最新の確定設計はこれ。本体仕様書 02_仕様書_Part2_ID体系 は repo 外(Notion 等)＝ポインタ追記は Notion 側で慎太郎さんが実施(repo 側不要)。

### 1-2 宿題③ カテゴリコード体系の確定（記憶で断定せず現物突き合わせから判断）
- 当初認識の訂正：「カテゴリコード長が dev/本番でズレ・本番だけ短い疑い」だったが、実態は「体系そのものが別物・本番が spec に忠実・dev が異端」。長短でなく軸の問題。
- 採番式 = {brandCode}-{season}-{categoryCode}-{連番3桁}。カテゴリ部 = ProductCategory.categoryCode そのもの(略号専用列なし・products.ts:158 productCodePrefix)。採番済み productCode は categoryId 変更でも不変(products.ts:679)。
- 本番カテゴリ=27件・階層方式(level1 性別 K/L/M/U＋level2 アイテム部位 M-TS 等・内部ハイフン有り・全件 company_id=shunya-master-tenant-id)。dev=CUT_SEWN/WOVEN の2件(製法フラット＝異端)。
- 決定 (a) 品番5段運用を正式採用。カテゴリ部が階層コード(M-TS)なら品番5段(IP-26AW-M-TS-001)。採番ロジック本体は無改修(本番運用に既に適合)＝spec(docs)更新のみ。

### 1-3 dev カテゴリ整備（実装①・dev DB のみ・migration なし・本番は SELECT のみ）
- 旧 dev テスト品番(AOI-26AW-CUT_SEWN-001/002・NMB-26SS-WOVEN-001)＋配下(colorways 6/skus 21/bom_item_colorways 8/status_history 3)を物理削除(全 FK CASCADE・阻害 FK なし・dry-run ROLLBACK→COMMIT)。旧カテゴリ CUT_SEWN/WOVEN も削除(products→product_categories の FK は無し・自己参照 parent のみ SET NULL)。
- 本番27件を dev に複製(分岐ア＝本番と同じ id・parent_category_id・company_id をそのまま INSERT＝親子張り直し不要)。psql で quote_literal 生成→dry-run→COMMIT。dev/本番カテゴリ体系が一致。
- ④テスト品番再作成は慎太郎さんが localhost 画面で実施(createProduct が採番＋ModelCode 発番＋status_history を transaction で束ねるため SQL 直 INSERT 不可)。M-TS で AOI-26SS-M-TS-001 を作成→カラーウェイ3本→サイズ展開(カテゴリ編集UIで S/M/L)→SKU生成→数量マトリクス編集まで素振り成功(北極星マトリクスがカテゴリ整備後も正常稼働を確認)。

### 1-4 シーズンのプルダウン化（実装②・PR #92・ef17bb7・migration 37本目・本番反映＋データ移行完了）
- 背景：season も year も手打ち Input(B-026 未着手箇所)。本番 26AW×year2026 / dev 旧 26AW×year2024 の食い違い＝season(年込み)と year(年単独)の二重持ちが破綻していた。
- 確定設計(案1・v1.1 §6)：
  - enum SeasonType(SS/AW/SP/SU/FA/WI/SPOT) 新設＋ Product.seasonType SeasonType?(nullable・@map season_type)。season String / year Int は無変更(season は seasonType×year の合成キャッシュとして残す＝論点1(I))。
  - 入力を year プルダウン(現在年-1〜+3・new Date().getFullYear() で動的・毎年自動更新)＋ seasonType プルダウン7択に。手打ち廃止。
  - season はサーバ側で composeSeason(year, seasonType)＝{year下2桁}{seasonType} で自動合成保存(例 2026+SS→26SS / 2026+SPOT→26SPOT＝6字・品番が伸びるが許容 §6.3)。
  - 採番・検索(where.season 完全一致)・一覧/詳細表示・PDF は無改修(season 文字列が従来通り入るため)。検索の seasonType フィルタ化は今回スコープ外＝別 backlog(論点3(あ))。
  - 7択フラット併存(決定Q)＝メイン SS/AW に加え夏展示会/店舗夏企画/立ち上がりスポット等の単独シーズンが実務に実在(表記揺れでなく意味的区別)。
- 新規モジュール src/lib/constants/season-types.ts(中立)：SEASON_TYPE_LABELS(Record<SeasonType,string> 7値網羅・春夏/秋冬/春/夏/秋/冬/スポット)・SEASON_TYPE_OPTIONS・composeSeason(year,seasonType)・parseSeasonType(season)＝末尾逆引き。
- validator：season 必須廃止・seasonType: z.nativeEnum 必須追加(season は server 合成)。products.ts：create/update で合成保存＋seasonType 保存・監査網羅型に seasonType・未使用化した normalizeSeason 除去。product-form：2プルダウン化・採番プレビュー依存配列を [brandId,categoryId,year,seasonType,mode] に。edit/page：seasonType 初期値(NULL 行は parseSeasonType で末尾逆引き)。
- P1(schema+migration 37本目・本番適用済み)→ P2(コード・PR #92 ef17bb7 マージ・本番デプロイで Applying migration 20260623000000_add_season_type 確認)→ P3(既存3行 seasonType 後埋め＝dev 1行 SS・本番2行 AW・dry-run ROLLBACK→COMMIT・三重ガード)。全環境 NULL 行ゼロ。
- 環境安全：ゲート①で作ったダミー AOI-26AW-M-TP-001 は dev に入っていた(本番一覧に不在)＝localhost が本番を向く事故(Phase 1A-15)は再発なし。

## ② 次セッション最優先（優先順は次回・慎太郎さん判断）
- 入口は次セッション冒頭で慎太郎さんが決定。私の memo は ② で B-067(数量→用尺→PO)最優先、Claude Code 版は ⑤ で B-063残(Sku色FK化=帳票)→B-065→QE-1 を優先順としていたが、齟齬ではなく「発注書に反映されればよし」発言の枠の取り方の差(私=大テーマ起票 / Claude Code=帳票フェーズの一連)。両方とも保存済みメモに記録あり・実害なし。
- B-067(数量→用尺→PO 一気通貫) と 帳票フェーズ(B-063残=Sku色FK化) は同じ「生産発注まわり」で隣接。次回 spec を読み直しながら順序を確定すれば十分(記憶で組まない)。
- B-067 に入るなら：spec Part3 §5.1(発注3タイプ)/§154(量産発注 自動連動)/§526(BOM連動 素材情報)・PO addendum §76・BomItem/PoItem/Sku の実スキーマを design-reread → 現状(数量マトリクス→PO の連結状況)の棚卸し → 設計確認書から。
- その他は ⑧ backlog から選択。

## ③ 新規起票（セッション11）
- B-067：数量→用尺→PO 連動（生産発注の一気通貫）。数量マトリクス(Sku.productionQuantity)× BomItem.usagePerUnit/totalUsagePerUnit → 資材発注数を自動計算し、工場発注書(WO・縫製仕様書＋数量明細)/仕様書発注(副資材 PO)に反映。spec Part3 §5.1(発注3タイプ)・§154(量産発注への自動連動)・§526(BOM連動 素材情報)、PO addendum §76(サイズ展開は Product/SKU 側が正)に設計意図あり＝材料(usagePerUnit/productionQuantity)は schema に既存だが計算・連動の実装は未着手。QE-1・B-057(BOM→PO draft)・B-047(CAD用尺)・B-039(規格/サイズ構造化)と統合検討。

## ④ Railway環境（唯一の正）
- 本番DB postgres-production/postgres-ab6d/shuttle:16099(migrate deploy・_prisma_migrations あり)。本番内部接続 postgres-ab6d.railway.internal:5432。本番ポート8080。公開プロキシ shuttle:16099 / DATABASE_PUBLIC_URL。
- dev DB postgres-development/hopper:12921(db push・_prisma_migrations 無し)。1往復≈1.8sと遅い(public proxy 経由)。
- migration 37本(#92 が 37本目 20260623000000_add_season_type・本番適用済み)。Prisma 6.19.3(7.x 案内は無視＝B-035)。本番 Next.js 16.2.6。GCS dev=...-dev/prod=...-prod。

## ⑤ dev DB（hopper:12921）
- product_categories=27件(本番複製済み・level1 K/L/M/U＋level2 23件・parent 正常・全件 company_id=shunya-master-tenant-id)。companies=1社(shunya-master-tenant-id「shunya」)。
- products=2件：AOI-26SS-M-TS-001(season_type=SS・カラーウェイ3本 A黒/B白/C柄BD-A・SKU 生成済み・数量マトリクス素振り済み)、AOI-26AW-M-TP-001(season_type=AW・④検証で作成)。
- colors=51件。柄種別=9件。柄=4件。

## ⑥ 確定設計（記憶で再構築しない・spec が正）
- 最新 spec：docs(specs)/category-code-spec-confirmation-v1_1-2026-06-22.md(カテゴリ＋シーズン統合)。v1.0(カテゴリのみ)は履歴。
- カテゴリコード：本番の階層方式(level1 性別＋level2 部位)が標準。品番5段許容(categoryCode は階層コード可)。採番ロジック本体は無改修。
- シーズン：year＋seasonType の構造化入力 → season 文字列はシステム合成(composeSeason)。season String は合成キャッシュとして残す。seasonType enum は正規列(検索/集計/将来 SO 連携用)。検索の seasonType フィルタ化は別 backlog。
- SKU = ProductColorway × サイズ(セッション10 で確定・sku-design-spec-confirmation-v1_1)。サイズの権威は ProductCategory.defaultSizeOptions。受注数(orderedQuantity)の正は将来 SalesOrder(フェーズ2)。フェーズ1は productionQuantity 手入力。

## ⑦ 本日マージされた PR / push
- d1c362b docs: カテゴリコード体系確認書 v1.0(docs/specs/ 保存・main 直 push)。
- PR #92(squash ef17bb7) = 実装② シーズンのプルダウン化。migration 37本目・本番適用済み・P3 データ移行済み。
- main 先頭：ef17bb7(#92) → d1c362b → e3d3623(docs セッション10) → 7cfd1ce(#91) → fb14760(#90)。
- 後始末済：feat/season-dropdown ブランチ削除・prune 済み。現在ローカル main のみクリーン。drift なし(No difference detected.)。
- 新規 spec/ブリーフ：category-code-spec-confirmation v1.0/v1.1(2026-06-22)。
- ※ dev カテゴリ整備・P3 データ移行は DB 操作のみ(コミット対象なし)。

## ⑧ 1ページ傘下 backlog（更新）
- 宿題③(品番カテゴリコード長)＝完結(カテゴリ体系確定＋シーズンのプルダウン化まで)。品番フォーマット(カテゴリ5段＋シーズン構造化)が整った。
- B-067(新規)＝数量→用尺→PO 連動(②③参照・次の大テーマ候補)。B-063残(帳票)と隣接・順序は次回 spec 読み直しで確定。
- フェーズ2(将来)：SalesOrder / SalesOrderItem(受注数=orderedQuantity の正)。入力経路 a/c/d。
- B-026(Season dropdown 標準化)＝実装②で実質消化(year＋seasonType プルダウン化・表記揺れ構造的解消)。残: 検索の seasonType フィルタ化(別 backlog 化)・Collection.season の同様化(今回スコープ外)。
- B-063残(colorNameEn/availableColors改訂/Sku色FK化/colorId FK正規化)=帳票フェーズ。
- B-065(発注引き当て時 C/# 自動反映)＋柄版。
- QE-1(量産見積もり)：北極星完成で着手可。B-067 と同領域。Excel2点(縫製仕様書・原価シート)を参照資料化・再添付依頼。カラーウェイ軸に合わせ見直し要。
- 宿題：本番絵型 smoke(sharp linux 実動作・セッション7から継続)。
- 継続: B-037(docs整理・docs ルートに category-code v1.0/v1.1 等 untracked が溜まっている。v1.0 は specs/ にも複製済み・ルート版は残置)／B-048／B-035(Prisma 7 メジャーアップ)／WorkOrder編集UI。
- 【UI将来要望】サイズマスター本格化・資材表の列順ドラッグ・絵型サムネ複数サイズ等は従来どおり必要が出たら別起票。

## ⑨ 次セッション冒頭の手順
1. このメモを貼り付け→状態復元。
2. git checkout main && git pull → git log origin/main --oneline -5(先頭 ef17bb7 #92・その下 d1c362b)。
3. drift 確認(migrate diff で No difference detected.)。
4. B-067(数量→用尺→PO) または B-063残(帳票)に入るなら、design-reread で spec Part3 §5.1/§154/§526・PO addendum・BomItem/PoItem/Sku の実スキーマを読み直してから(記憶で組まない)。現状の連結状況の棚卸し→設計確認書から。入口は冒頭で決定。
