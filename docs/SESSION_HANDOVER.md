# 引き継ぎメモ (2026-06-16 セッション5 / B-062 β 完了 PR #83・#84 本番反映済み)

## ⓪ プロジェクト棲み分け（毎回必須）
- shunya-pms（shintarokoenuma/shunya-pms・~/shunya-production-system・shunya-pms-web-production.up.railway.app）と saagara-v2 は完全に別物。実装指示書は冒頭に【対象プロジェクト】ヘッダ固定。貼る前に ~/shunya-production-system を開いているか目視。
- docs/CLAUDE.md は別プロジェクト混入ファイル。無視。docs 整理は B-037。

## ⓪-2 PR URL 3点セット
- ① マージ前UI確認=ローカル(npm run dev→localhost:3000 / dev hopper:12921)。型/lintクリーンなら commit→push→PR open まで Claude Code 自走可。人が握るのは①ローカル目視と②マージ。
- ② マージ=GitHub PR→Railway自動デプロイ=本番反映(不可逆)。
- ③ マージ後=本番URL + デプロイログ目視。migration入りPRは「Applying migration ...」行が③の本体。migration なしPRは「No pending migrations to apply.」が正常（エラーではない）。
- 【dev起動の罠】schema/migration変更後に dev が古いプロセスを掴むと prisma.<新model> が undefined → findFirst / Internal Server Error。対処: lsof -ti:3000,3001 | xargs kill -9 → npx prisma generate → rm -rf .next → npm run dev。起動ポートが3001にズレてないか必ず確認。
- 【本番確認の罠】カラーウェイ等「データ0件なら列を出さない」系UIは、本番にデータが無いと変更が見えない＝バグではない。本番反映の確認は「データ非依存の変更点」で見る（例: 列順変更は全品番に効く）。本番に検証データを入れて確認しない。

## ① 本セッションの成果（B-062 β 完了）
- PR #83（squash f654ce5）= β 先行: ProductColorway + BomItemColorway 2テーブル新設（migration 32本目）＋ProductColorway CRUD＋品番カルテ「カラー展開」カード。本番 migration 適用確認済み（前セッション末）。
- PR #84（squash 41f8096）= β 次PR: 資材表(BOM)に BomItemColorway インライン編集。migration なし（テーブルは#83済）。本番反映確認済み（列順が新並びになっているのが反映の証拠）。
- #84 で4回の追加修正を反映: ①C/#接頭辞の正規化ガード（normalizeSupplierColorCode・validator transform + client保存前・冪等・大文字C/#も剥がす・英字番号C99/D21/M003は保護） ②B案=カラーウェイ列群に「先方カラー No.（C/#）」を colSpan でまたぐ2段グループヘッダ・セルは番号のみ表示 ③列順=区分→品目→[カラーウェイ列群]→用尺→単価→1着概算→ロス率→調達 ④dev既存データ正規化（保存時normalizeで既に番号化済み・要修正0件で実害なし）。

## ② β 設計の確定事項（v0.4・実装で確定）
- カラーウェイの実体 = ProductColorway（SKUの親・SKU非依存・品番内ローカルマスター）。SP単位ではない（軸はカラーウェイ）。全社の色辞書 Color マスターとは別レイヤー（橋渡しは colorId 配線=B-063）。
- 資材×カラーウェイの C/# = BomItemColorway 子テーブル（ProductColorway を FK 参照）。BomItemColorway に companyId 列なし→親(bomItem→bom)経由で companyId 検証。
- 既存 BomItem 単色列（colorCode/colorName/pantone）は併存（全色共通資材=芯地等の受け皿）。「色変動品=BomItemColorway / 全色共通品=本体単色列」の二段構え。
- C/# はデータには番号のみ保存（先方カラー番号は番号のみが前提）。「C/#」接頭辞は表示専用で、列群グループ見出しに1回だけ出す。入力で接頭辞を打たれても normalize で剥がして番号保存。
- ProductColorway.colorId? は #83 で列だけ作成済み・β では未配線。Color マスター連携・色名解決・Sku色FK化は B-063。

## ③ Railway環境（唯一の正）
- 本番DB postgres-production/postgres-ab6d/shuttle:16099（migrate deploy・_prisma_migrations あり）。
- dev DB postgres-development/hopper:12921（db push・_prisma_migrations 無し・migrate系打たない）。
- migration 32本（本セッションで増減なし。#84 は migration なし）。GCS dev=...-dev / prod=...-prod。
- Prisma 6.19.3→7.8.0 のメジャーアップ案内がデプロイログに出るが未対応・今は無視。アップは別途検討（バックログ候補）。

## ④ dev DB（hopper:12921）
- テスト品番 AOI-26AW-CUT_SEWN-001（id 7671eb90-4bc8-46e0-996b-2e119550be80）にカラーウェイ A(ブラック)/B(ベージュ)、BomItemColorway 8行（017/020/512/510/M003/001/D001/D21 等・全て番号のみクリーン）を検証投入。bom_items=5 / po_items=5 / skus=0。
- 本番(shuttle:16099)は #83 検証時の ProductColorway を前セッションで物理削除済み記録＝クリーンのはず。次セッション開始時に本番カラー展開が0件か念のため確認。本番 BomItemColorway は0件。

## ⑤ 次セッション優先順
1. B-063 色名供給（β の次・色名解決トラック）。実体: ①Color データ投入（50色・seed未投入・dev/本番件数未確認→着手前に colors テーブル件数を dev/本番で確認） ②Color.colorNameEn 追加 migration ③Material.availableColors 改訂1（{colorNumber, supplierColorCode, supplierColorName}へ・JSON ゆえ migration不要） ④ProductColorway.colorId 配線＋Sku 色 FK 化。color-master §6 未確定7点の解決を含む。着手前に shunya-design-reread で color-master spec(2026-06-01) と v0.4 §4 を読み直す。
2. B-065（新規）= 発注引き当て時の C/# 自動反映。現状「発注から取り込む/引き当て」はコスト・単価のみ反映でカラーウェイ別 C/# は反映しない（β スコープ外で確定）。着手前に PoItem が先方カラー番号フィールドを持つか live grep（持っていなければ設計から）。B-063 と並走で設計検討。
3. B-027 絵型（北極星5要素の最後・画像アップロード基盤・GCS 既存）。
4. B-060 SPタイトルは方針①で次の SP 作業に相乗り。

## ⑥ 1ページ傘下 backlog
- B-064 数量マトリクス表示=完了(#82) / B-062 β=完了(#83先行+#84次PR) / B-063 色名解決=次 / B-027 絵型。
- B-061(C)=不要クローズ / B-060(B=SPタイトル)=方針①で相乗り。
- B-065（新規）= 発注引き当て時 C/# 自動反映（⑤-2）。
- 継続: B-048 / WorkOrder編集UI / B-037(docs整理) / SKU 生成導線（希望数の出どころ確定後・別タスク）。
- 【UI将来要望】資材表の列順をドラッグで並び替え＋ユーザーごと列順保存。今回は固定順で対応。別タスク化（列順の永続化が要る）。
- 【B-037 メモ】git status に未追跡ファイル大量散乱（docs/CLAUDE.md・docs/files 9〜12/・各種zip・skill/・files.zip 等）。後日まとめて整理。3群仕分け: (a)gitignore行き=zip/skill/files系 (b)中身照合してから add/破棄=docs直下の spec 群 (c)削除候補=docs/CLAUDE.md。read-only調査から。物理削除は不可逆ゆえ慎重に。
- QE-1 は北極星完了後（Excel2点を参照資料化・再添付依頼。QE-1仕様書は Specification 経由BOM前提で古い=決定2に合わせ見直し）。B-057 は QE-1後。逆転記(A)不要確定。

## ⑦ 本日マージされた PR / push
- PR #83: B-062 β 先行（squash f654ce5）※前セッション末にマージ・本番migration適用済み。
- PR #84: B-062 β 次PR（squash 41f8096）BomItemColorway インライン編集＋正規化ガード＋B案2段ヘッダ＋列順。migration なし。本番反映確認済み（列順で確認）。
- docs: 本メモ更新（main 直push）。
- main 先頭: 41f8096（#84）→ ... → f654ce5（#83）。
- 後始末: ローカル feat/b062-beta-bom-item-colorway 削除済み。

## ⑧ 次セッション冒頭の手順
1. このメモを貼り付け→状態復元
2. git log origin/main --oneline -5 で先頭が 41f8096 か確認
3. ④の本番カラー展開が0件か念のため確認（前セッションで物理削除済みのはず）
4. shunya-design-reread スキルで B-063 の spec（color-master 2026-06-01 §5/§6・v0.4 §4）を読み直してから設計（記憶で組み立てない・色マスターの轍）
5. ⑤-1（B-063 色名供給）着手。着手前 live grep: colors テーブル件数(dev/本番)・Color.colorNameEn・Material.availableColors の現形・Sku 色列の FK 状況
