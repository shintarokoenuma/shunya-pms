# 引き継ぎメモ (2026-06-21 セッション10 / SKU設計 PR1(#90)＋PR2(#91) 本番反映完了・北極星マトリクス開通・品番カテゴリコード長の宿題起票)

## ⓪ プロジェクト棲み分け（毎回必須）
- shunya-pms（shintarokoenuma/shunya-pms・~/shunya-production-system・shunya-pms-web-production.up.railway.app）と saagara-v2 は完全に別物。実装指示書は冒頭に【対象プロジェクト】ヘッダ固定。貼る前に ~/shunya-production-system を開いているか目視。
- docs/CLAUDE.md は別プロジェクト（shunya-ivr）混入ファイル。無視。docs 整理は B-037。
- git add は明示パスのみ（git add -A / git add . 禁止）。一時 script はコミットしない。docs/files */・*.zip・skill/・docs/CLAUDE.md はステージしない。

## ⓪-2 PR URL 3点セット
- ① マージ前UI確認=ローカル(npm run dev→localhost:3000 / dev hopper:12921)。型/lintクリーンなら commit→push→PR open まで Claude Code 自走可。人が握るのは①ローカル目視と②マージ。
- ② マージ=GitHub PR→Railway自動デプロイ=本番反映(不可逆)。
- ③ マージ後=本番URL + デプロイログ目視。migration入りPRは「Applying migration ...」行が③の本体。migrationなしPRは「No pending migrations to apply.」が正常。
- 【dev起動の罠】schema/migration変更後に dev が古いプロセスを掴むと prisma.<新model> が undefined → Internal Server Error。対処: lsof -ti:3000,3001 | xargs kill -9 → npx prisma generate → rm -rf .next → npm run dev。
- 【index-browser罠】"use client" が "use server"（prisma同梱）から型 import すると @prisma/client がブラウザに漏れる。対処=型を中立モジュール（src/lib/types/*.ts・prisma非依存）に逃がす。SKU系は src/lib/types/sku.ts（SkuRow）。
- 【監査網羅型の罠】Product に scalar を足すと products.ts の ProductAuditField が要求しビルド失敗。※ProductColorway/TextilePattern/Sku/ProductCategory は手書き afterData 方式なので非該当。
- 【★新・transaction timeout 罠（P2028）】ループ内で tx.* を逐次 await する $transaction はデフォルト5sで期限切れ→実行中クエリが P2028（Transaction already closed/expired）。dev は hopper public proxy 経由でラウンドトリップが重く特に出やすい。対処=第2引数に { timeout: 15000, maxWait: 10000 }（purchase-orders.ts:523,693 / work-orders.ts:747,933 / skus.ts createSkusForProduct が同方式）。
- 【★新・set-state-in-effect 罠】useEffect 内で同期 setState は eslint エラー。サーバ値で再同期したいときは useEffect ではなく key に値を含めて remount（matrix の EditableProductionQty は key=`${id}:${productionQuantity}` で router.refresh 後に初期値同期）。
- 【本番確認の罠】「データ0件なら出さない/データ依存」系UIは本番にデータが無いと変更が見えない＝バグではない。本番に検証データを入れない。

## ① 本セッションの成果（SKU 設計 PR1＋PR2＝SKU 生成導線 開通）
- **PR #90（squash fb14760）= SKU 設計 PR1**：Sku を ProductColorway×サイズ軸へ。
  - Sku に colorwayId String 増設（@relation ProductColorway・onDelete:Cascade・@@index）。既存 colorCode/colorName/colorHex/pantone は後方互換で温存。
  - migration 36本目 20260621000000_sku_colorway_id（ADD COLUMN colorway_id NOT NULL ＋ index ＋ FK・**skus 0件で安全**＝dev/本番とも事前に0件確認）。**本番 migrate deploy 適用済み**。
  - 中立型 src/lib/types/sku.ts（SkuRow）。skus.ts に listSkusForProduct（colorway join・colorway.sortOrder→sizeOrder→size 順）＋ createSkusForProduct（ACTIVE カラーウェイ×サイズ直積を skuCode 冪等 upsert）。
  - quantity-matrix-section.tsx を colorwayId 軸に改修（cellMap key=`${colorwayId}|${size}`）。
- **PR #91（squash 7cfd1ce）= SKU 生成 UI PR2（＋拡張＋マージ前修正・全部入り）**：
  - 生成ダイアログ sku-generate-dialog.tsx（サイズ複数選択→createSkusForProduct）＋ 量産発注数の下段インライン編集（updateSkuQuantity・受注数は read-only・AuditLog 手書き）。
  - サイズの権威化：ProductCategory.defaultSizeOptions を validator/create/update に配線（UIなし方針を撤回）。カテゴリ編集フォームに「サイズ展開」並べ替えUI（Input＋↑↓＋削除＋追加・string[] は useFieldArray を使わず watch+setValue 自前管理）。
  - **マトリクスのサイズ列順を defaultSizeOptions の index 参照に＝(B) 即追従**（SKU.sizeOrder の生成時値に依存しない。カテゴリの並びを変えて保存→品番マトリクス再読込で再生成せず列順が追従）。
  - カラー行ラベルを「C ブラック」（colorwayCode 先頭強調・展開表と統一）。
  - ダイアログ UX：初期チェック=既存サイズのみ（SKU0件=全OFF）／候補=カテゴリ順＋候補外の既存サイズを末尾温存／**手入力追加は廃止**（権威一本化）／「サイズ候補を編集（商品カテゴリ）」リンク（別タブ・categoryId 無し品番は非表示）。
  - **timeout 修正**：createSkusForProduct の $transaction に { timeout: 15000, maxWait: 10000 }（cw×size 逐次 upsert が P2028 で落ちていた根因を解消）。
  - UIのみ＝**migration なし**（③は「No pending migrations to apply.」が正常）。
- 全コミットで tsc0 / build成功 / lint 変更分の新規指摘なし。dev 目視（生成→マトリクス→インライン編集→カテゴリ即追従）用に dev skus を temp script で都度クリア（非コミット）。
- 後始末：#90・#91 ともローカル/リモート feat 削除・fetch --prune 済み。現在ローカル main のみ・クリーン。

## ② 本セッションで確定/再確認した設計（記憶で再構築しない）
- **SKU 軸＝ProductColorway × サイズ で確定**（旧 handover ⑥の「色軸合流」決定）。Sku.colorwayId を正とし、色文字列直持ち（colorCode等）は後方互換キャッシュとして温存。
- **サイズの権威＝ProductCategory.defaultSizeOptions で確定**。独立サイズマスターは作らない（サイズは品種=カテゴリ依存で Color のように汎用化できない）。defaultMoqTiers は引き続き UI なし（Phase 2）。
- **(A) 量産発注数のみ画面編集／(B) サイズ列順はカテゴリ即追従**で確定。受注数(orderedQuantity)は受注側の値＝マトリクスでは read-only。
- 生成ダイアログのサイズ追加は**カテゴリ編集に一本化**（ダイアログ内手入力は廃止）。shadcn に multi-select プリミティブ無し→チェックボックス＋チップで複数選択。
- skuCode 採番＝`${productCode}-${colorwayCode}-${size}`・@@unique([companyId, skuCode]) で冪等。

## ③ Railway環境（唯一の正）
- 本番DB postgres-production/postgres-ab6d/shuttle:16099（migrate deploy・_prisma_migrations あり）。本番アプリ内部接続は postgres-ab6d.railway.internal:5432（ローカル不可・公開プロキシ shuttle:16099 / DATABASE_PUBLIC_URL を使う）。本番アプリのポートは8080。
- dev DB postgres-development/hopper:12921（db push・_prisma_migrations 無し・migrate系打たない）。
- migration 36本（#90 が 36本目 20260621000000_sku_colorway_id・本番適用済み）。GCS dev=...-dev / prod=...-prod。
- Prisma 6.19.3（7.x 案内は無視）。Next.js 16.2.6。
- drift 確認（動く形）：`npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code`（0=No difference）。※ `--to-database --shadow-database-url "$DATABASE_URL"` は $DATABASE_URL がシェルに無く失敗するので使わない（prisma.config が env を読まない）。DBURL は .env から `grep -E '^DATABASE_URL=' .env | sed ...` で取り出す。

## ④ dev DB（hopper:12921）
- colors=51件 / 柄種別 textile_pattern_types=9件 / 柄 textile_patterns=4件。本番 textile_patterns=0件・本番 skus=0件（PR1 マージ前確認）。
- テスト品番 7671eb90-4bc8-46e0-996b-2e119550be80（ACTIVE カラーウェイ4本／ARCHIVED1本）を SKU 生成・インライン編集・カテゴリ即追従の目視に使用。dev skus は目視のたび temp script でクリア（最終件数は不定・データ消失ではない）。

## ⑤ 次セッション優先順
1. **B-063残（colorNameEn/availableColors改訂/Sku色FK化/colorId FK正規化）＝帳票フェーズ**。SKU 軸が ProductColorway に揃ったので Sku色FK化は自然な次手（colorCode等の後方互換キャッシュを colorwayId 正規化に寄せる）。
2. **B-065（発注引き当て時 C/# 自動反映）＋柄版**（先方デザイン番号の自動反映）。
3. **QE-1（量産見積もり）**：北極星マトリクスに実データが載る土台が出来たので着手余地拡大。Excel2点(縫製仕様書・原価シート)を参照資料化・再添付依頼。QE-1仕様書は Specification経由BOM前提で古い＝カラーウェイ軸に合わせ見直し要。B-057(BOM→PO下書き)はQE-1後。
4. **【新・宿題】品番カテゴリコード長 × skuCode 桁あふれ**（⑥-3）。

## ⑥ SKU 設計の到達点（旧 handover ⑥を更新＝開通済み）
- **SKU 生成導線 開通**：skus.ts に listSkusForProduct / createSkusForProduct / updateSkuQuantity / getDefaultSizesForProduct が揃い、UI（生成ダイアログ＋インライン編集）から SKU を作成・編集できる。旧 handover の「create/upsert/update 皆無＝作る手段がアプリに無い」は解消。
- **北極星マトリクス開通**：B-064 の「箱だけ」だった数量マトリクスに、生成導線で実データが載るようになった。サイズ列順はカテゴリ defaultSizeOptions に即追従、量産発注数はインライン編集可。
- 残課題は色の正規化（⑤1・Sku色FK化）と数量の出どころ（受注数の自動流入＝saagara-v2連携/CSV/先方入力のどれか・将来テーマ。今は手入力＝orderedQuantity 生成時0・productionQuantity をマトリクスで手編集）。

## ⑥-2 1ページ傘下 backlog（更新）
- 北極星5要素 完成（B-062β/B-063/B-027/B-066柄/B-064マトリクス）＋柄マスター完結＋**SKU 生成導線 開通（#90/#91）**。
- B-063残（colorNameEn/availableColors改訂/Sku色FK化/colorId FK正規化）=帳票フェーズ。
- B-065（発注引き当て時C/#自動反映）＋柄版。
- 継続: B-048 / WorkOrder編集UI / B-037(docs整理＋古いremote branch掃除)。
- 【宿題・未消化】本番の絵型アップロード smoke（sharp linux ビルド実動作確認・セッション7から継続）。
- 【UI将来要望】資材表の列順ドラッグ並び替え＋ユーザーごと列順保存。絵型サムネ複数サイズ/圧縮/HEIC/GCS孤児掃除/DesignVersion三位一体統合。付属/数量マトリクス列見出しの truncate＋ツールチップ。柄ダイアログへの代表色 Popover（案B拡張・要 popover.tsx 導入）。defaultMoqTiers 編集UI（Phase 2）。

## ⑥-3 【新・宿題】品番カテゴリコード長 × skuCode 桁あふれ
- skuCode=`${productCode}-${colorwayCode}-${size}`、productCode=`{brandCode}-{season}-{categoryCode}-{連番3桁}`。Sku.skuCode は @db.VarChar(100)。
- categoryCode は validator 上限 50字。極端に長い categoryCode だと productCode が伸び、skuCode が 100字を超え得る（通常運用では余裕だが上限ガードが無い）。
- TODO：実害条件の確認（実カテゴリコードの最大長）と、必要なら (a) categoryCode 実用上限の引き下げ or (b) skuCode 桁拡張 or (c) 生成時の長さバリデーション、のどれかを設計。今は起票のみ・着手は B-063残/帳票フェーズと一緒に判断。

## ⑦ 本日マージされた PR / push
- PR #90（squash fb14760）: SKU設計 PR1（Sku.colorwayId・migration 36本目・本番適用済み）。
- PR #91（squash 7cfd1ce）: SKU生成UI PR2（生成ダイアログ＋インライン編集＋defaultSizeOptions権威化＋並べ替えUI＋カテゴリ即追従＋timeout修正・migrationなし）。
- main 先頭: 7cfd1ce(#91) → fb14760(#90) → 5d60da5(docs セッション9)。
- 後始末：両 PR とも feat ブランチ ローカル/リモート削除・fetch --prune 済み。現在ローカル main のみ・クリーン。

## ⑧ 次セッション冒頭の手順
1. このメモを貼り付け→状態復元。
2. git checkout main && git pull → git log origin/main --oneline -5 で先頭が 7cfd1ce(#91) か確認。
3. drift 確認（③の動く形コマンドで No difference）。
4. 次テーマ（B-063残/帳票・Sku色FK化 等）に入るなら design-reread で関連 spec/現物を読み直してから（記憶で組まない）。新マスター/新配線の着手前は「色側に倣う」現物確認を先に。

## ⑨ スキル化候補（継続・skill-packager で起こす）
- **shunya-prior-phase-pitfall-review（仮）**：design-reread が「設計意図」を spec から戻すのに対し、これは「実装の罠」を最も近い既存フェーズの実装/seed ブリーフから grep して移植する。今回 PR1/PR2 でも「色側に倣う」現物確認（listActiveColorsForPicker/listColorways/PO・WO の transaction timeout 作法）を着手前に回せた動きを定着。新マスター/新配線の着手前に発動。
