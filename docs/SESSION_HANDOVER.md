# 引き継ぎメモ (2026-06-17 セッション8 / B-066 柄マスター層2 完了 PR #88 本番反映済み・層1 7種整理済み)

## ⓪ プロジェクト棲み分け（毎回必須）
- shunya-pms（shintarokoenuma/shunya-pms・~/shunya-production-system・shunya-pms-web-production.up.railway.app）と saagara-v2 は完全に別物。実装指示書は冒頭に【対象プロジェクト】ヘッダ固定。貼る前に ~/shunya-production-system を開いているか目視。
- docs/CLAUDE.md は別プロジェクト混入ファイル。無視。docs 整理は B-037。

## ⓪-2 PR URL 3点セット
- ① マージ前UI確認=ローカル(npm run dev→localhost:3000 / dev hopper:12921)。型/lintクリーンなら commit→push→PR open まで Claude Code 自走可。人が握るのは①ローカル目視と②マージ。
- ② マージ=GitHub PR→Railway自動デプロイ=本番反映(不可逆)。
- ③ マージ後=本番URL + デプロイログ目視。migration入りPRは「Applying migration ...」行が③の本体。migration なしPRは「No pending migrations to apply.」が正常。
- 【dev起動の罠】schema/migration変更後に dev が古いプロセスを掴むと prisma.<新model> が undefined → Internal Server Error。対処: lsof -ti:3000,3001 | xargs kill -9 → npx prisma generate → rm -rf .next → npm run dev。
- 【index-browser罠】"use client" が "use server"（prisma同梱）から型 import すると @prisma/client がブラウザに漏れ index-browser 解決エラー。対処=型を中立モジュール（src/lib/types/*.ts・prisma非依存）に逃がす。今回 src/lib/types/textile-pattern.ts で踏襲。
- 【監査網羅型の罠】Product に scalar を足すと products.ts の ProductAuditField がそのフィールドを要求しビルド失敗。※ProductColorway/TextilePattern は手書き afterData 方式なので非該当（colorId #85 で実証済み）。③で ProductColorway に patternId を足す時も非該当。
- 【set-state-in-effect罠】delete-button で useEffect 内の同期 setState は eslint error（cascading renders）。対処=本削除メニュー click 時に usage 取得。B-064・今回 #88 で踏襲。
- 【本番確認の罠】「データ0件なら出さない/データ依存」系UIは本番にデータが無いと変更が見えない＝バグではない。本番に検証データを入れない。今回③本番確認は「柄マスター一覧が全0件で正常表示＝テーブル存在＝migration適用済み」で確認した。

## ① 本セッションの成果（B-066-② 柄マスター層2 完了・層1 7種整理 完了）
- PR #88（squash df5de6f）= B-066-②：柄マスター 層2 TextilePattern 新設（schema＋migration34本目 CREATE TABLE 1本・非破壊・CRUD8関数・UI一式・サイドバー導線）＋ seed定義から DT/SOLID 削除（種別7種化）。tsc0/eslint0/build成功。本番反映確認済み（本番 /textile-patterns が全0件で正常表示・テーブル存在確認）。
- 層1 柄種別の本番整理：本番 /textile-pattern-types 画面で DT(ドット)・SOLID(無地) を UI アーカイブ。本番は ACTIVE 7種(BD/ST/CK/PR/AO/ML/OT)＋ARCHIVED 2件。dev も同様に7種。
- docs: b-066-textile-pattern-master-spec-confirmation-v1_1-2026-06-17.md（0c4cd58・main直push）。

## ② B-066 設計の確定事項（今日のセッションで確定・記憶で再構築しない）
- 柄の分類：織り柄(生地の組織)=BD/ST/CK。プリント(PR)=図案・ドット内包。無地=カラーで対応(柄マスター対象外)。迷彩=当面AO総柄に寄せる(独立CF種別は要れば層1に1件seed追加・別対応)。蛍光/メタリック=特殊単色で柄でない=対象外。
- 二層構造：層1 TextilePatternType(種別・既存#52・本番7種)／層2 TextilePattern(具体的な1柄・今回#88新設)。
- 層2 TextilePattern が持つもの（軽量・確定）：patternNumber(D#・"BD-A"形式=種別プレフィックス＋英字枝番A/B/C・手振り・VarChar10) / patternName(手入力呼称・VarChar100) / typeId(層1への緩い参照・純scalar・@relationなし) / sortOrder / status(VarChar20)。
- 持たない（確定）：構成色(Color番号) / parameters(ピッチ・格子サイズ)。理由=マルチボーダー/マルチストライプは色番号で割り切れない・色の実指定は発注書側(先方デザイン番号)に乗る。
- 柄プレビュー作らない（確定）：構成色を持たないため縞色を描けない。D#＋種別バッジ表示のみ。
- 採番思想：Colorの「十の位=色相系統＋一の位=個体」と同じ2層思想。ただし表記は色=数字／柄=英字BD-A(種別が読める・枝番は単なる識別子)。見た目で役割が区別でき混同しない。
- C/#との対称（重要）：自社Color=57/自社柄=BD-A は社内共通言語。先方C/#=001/先方デザイン番号=D001 は取引先指定・マスター化しない・発注書/BOM側に文字列で乗る。柄も色と完全対称。
- ProductColorway 配線（③で実装）：patternId String?(colorId の隣・純scalar・緩い参照・null=従来単色)。無地は patternId=null(colorIdのみ)。BomItemColorway・C/#マトリクスは変更不要。
- 付属マトリクス列見出し：上段 colorwayCode(BD-A が入る・90px収まる)/下段 colorwayName(手入力)。呼称が長いと90pxはみ出す既存挙動→truncate＋ツールチップは別課題。

## ③ Railway環境（唯一の正）
- 本番DB postgres-production/postgres-ab6d/shuttle:16099（migrate deploy・_prisma_migrations あり）。本番アプリ内部接続は postgres-ab6d.railway.internal:5432（ローカル不可・公開プロキシ shuttle:16099 / DATABASE_PUBLIC_URL）。本番アプリのポートは8080（正常）。
- dev DB postgres-development/hopper:12921（db push・_prisma_migrations 無し・migrate系打たない）。
- migration 34本（#88 が +1＝34本目 20260617010000_b066_textile_pattern）。GCS dev=...-dev / prod=...-prod。
- Prisma 6.19.3。7.x メジャーアップ案内は未対応・今は無視。

## ④ dev DB（hopper:12921）
- colors=51件。柄種別 textile_pattern_types=9件(ACTIVE7/ARCHIVED2=DT,SOLID)。柄 textile_patterns=ローカル目視で BD-A を1件作成した可能性あり(dev のみ・本番は0件)。
- 本番 textile_patterns=0件（クリーン・検証データ未投入）。

## ⑤ 次セッション優先順
1. B-066-③（ProductColorway に patternId 増設＋pattern-picker）＝柄マスターをカルテで実際に使う仕上げ。migration1本(ADD COLUMN・非破壊)。着手時 read-only調査(ProductColorway現況・colorway-section の color-picker隣接構造)から。checkTextilePatternUsage の参照0固定を productColorway.count({where:{patternId:id}}) に置換(②コード冒頭コメントに申し送り済み)。pattern-picker は color-picker の隣・柄選択時プレビューなし(D#＋バッジ)。
2. SKU 設計（重要・腰を据えて）＝下記⑥。柄③の後にやると今日決定。
3. B-065（発注引き当て時 C/# 自動反映）。柄版は別タスク。
4. QE-1（量産見積もり）：北極星完成で着手可能。Excel2点(縫製仕様書・原価シート)を参照資料化・再添付依頼。QE-1仕様書は Specification経由BOM前提で古い＝決定2(カラーウェイ軸)に合わせ見直しが要る。B-057はQE-1後。

## ⑥ SKU 設計の次テーマ（今日の調査で判明・実装は柄③の後）
- 現状：Sku モデルは設計スキーマに存在(カラー×サイズ・colorCode文字列直持ち=古い設計)。だが prisma.sku の使用は2箇所だけ(products.ts のcount=削除ガード / skus.ts のfindMany=一覧取得)。create/upsert/update が皆無＝SKU生成導線が未実装＝dev/本番とも0件・作る手段がアプリに無い。
- 噛み合わない点：B-064「SKU数量マトリクス表示」(#82)は完了だが、quantity-matrix-section.tsx は SkuRow[] を props で受け取って描画するだけの read-only=「箱だけ」。北極星5要素の数量マトリクスは現状ずっと空。実データを載せるには SKU生成導線が必須。
- 着手前に確定が要る2点（決め打ち厳禁・作り直しリスク）：
  1. 数量(希望数/受注数)の出どころ＝saagara-v2連携 / CSV取り込み / 先方入力 / カルテ手入力 のどれか。
  2. 色軸を ProductColorway に合わせるか＝B-063④(Sku色FK化)と直結。今 Sku は色を文字列直持ちでカラーウェイ軸(決定2)と未合流。
- これらは上流の意思決定。コードを書く前に固める。

## ⑦ 本日マージされた PR / push
- 0c4cd58: docs B-066 仕様確認書 v1.1（main直push・docs-only）
- PR #88（squash df5de6f）: B-066-② 柄マスター層2 TextilePattern 新設＋seed 7種化。migration 34本目。本番反映確認済み。
- 本番 UI操作：層1 柄種別の DT/SOLID を本番画面でアーカイブ(本番7種化)。
- main 先頭: df5de6f(#88) → 0c4cd58(docs) → 2b33724 → fa9121f(#87)。
- 後始末：#88 リモートブランチ削除済み。ローカル feat/b066-textile-pattern-master も削除済み(was 80e1b18)。現在ローカル main のみ・クリーン。

## ⑧ 次セッション冒頭の手順
1. このメモを貼り付け→状態復元
2. git checkout main && git pull → git log origin/main --oneline -5 で先頭が df5de6f か確認
3. 念のため drift 確認（migrate diff で No difference detected.）
4. B-066-③ 着手なら read-only調査(ProductColorway現況・product-colorways.ts CRUD・colorway-section の color-picker配線)から。design-reread で b-066 spec v1.1 を読み直してから(記憶で組まない)。
5. SKU 設計に入るなら⑥の2点(数量の出どころ／色軸合流)を先に慎太郎さんと確定してからコード。

## ⑥-2 1ページ傘下 backlog（更新）
- B-064 数量マトリクス=完了(#82・ただし箱だけ=SKU生成導線未実装で常に空・⑥参照) / B-062 β=完了(#83+#84) / B-063(B-2)=完了(#85) / B-027 絵型=完了(#86+#87) / B-066-② 柄マスター層2=完了(#88)＋層1 7種整理=完了 → 北極星5要素 完成済み。
- B-066-③（ProductColorway patternId増設＋pattern-picker）=次の最優先。
- SKU 生成導線（⑥）=柄③の後・要・数量の出どころ＋色軸合流の確定。
- B-063 残（colorNameEn/availableColors改訂/Sku色FK化/colorId FK正規化）=帳票フェーズ。
- B-065（発注引き当て時C/#自動反映）＋柄版。
- 継続: B-048 / WorkOrder編集UI / B-037(docs整理)。
- 宿題・未消化：本番の絵型アップロード smoke（sharp linux ビルド実動作確認）。
- UI将来要望：資材表の列順ドラッグ並び替え＋ユーザーごと列順保存。絵型サムネ複数サイズ/圧縮/HEIC/GCS孤児掃除/DesignVersion三位一体統合。付属マトリクス列見出しの truncate＋ツールチップ。
- QE-1 着手可能(Excel2点 参照資料化・再添付依頼。仕様見直し要)。B-057 はQE-1後。

## ⑨ スキル化候補（次セッションで skill-packager で起こす）
- 「過去の類似フェーズの実装ブリーフから罠を先回りで拾う」スキル（仮 shunya-prior-phase-pitfall-review）：design-reread が「設計意図」を spec から戻すのに対し、これは「実装の罠」を最も近い既存フェーズの実装/seed ブリーフから grep して移植する。今回 Color の prod-seed ブリーフから「不可視文字 tr -d」「internal/public URL」「Phase 1A-15 本番事故」を先回りで拾えた動きを定着させる。新マスター/新配線の着手前に発動。
