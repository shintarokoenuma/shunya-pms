# 引き継ぎメモ (2026-06-19 セッション9 / B-066-③・③b 完了 PR #89 マージ済み・本番migration適用済み・柄マスター完結)

## ⓪ プロジェクト棲み分け（毎回必須）
- shunya-pms（shintarokoenuma/shunya-pms・~/shunya-production-system・shunya-pms-web-production.up.railway.app）と saagara-v2 は完全に別物。実装指示書は冒頭に【対象プロジェクト】ヘッダ固定。貼る前に ~/shunya-production-system を開いているか目視。
- docs/CLAUDE.md は別プロジェクト混入ファイル。無視。docs 整理は B-037。

## ⓪-2 PR URL 3点セット
- ① マージ前UI確認=ローカル(npm run dev→localhost:3000 / dev hopper:12921)。型/lintクリーンなら commit→push→PR open まで Claude Code 自走可。人が握るのは①ローカル目視と②マージ。
- ② マージ=GitHub PR→Railway自動デプロイ=本番反映(不可逆)。
- ③ マージ後=本番URL + デプロイログ目視。migration入りPRは「Applying migration ...」行が③の本体。migrationなしPRは「No pending migrations to apply.」が正常。
- 【dev起動の罠】schema/migration変更後に dev が古いプロセスを掴むと prisma.<新model> が undefined → Internal Server Error。対処: lsof -ti:3000,3001 | xargs kill -9 → npx prisma generate → rm -rf .next → npm run dev。
- 【index-browser罠】"use client" が "use server"（prisma同梱）から型 import すると @prisma/client がブラウザに漏れる。対処=型を中立モジュール（src/lib/types/*.ts・prisma非依存）に逃がす。柄系は src/lib/types/textile-pattern.ts。
- 【監査網羅型の罠】Product に scalar を足すと products.ts の ProductAuditField が要求しビルド失敗。※ProductColorway/TextilePattern は手書き afterData 方式なので非該当（colorId #85・patternId #89 で実証済み）。
- 【本番確認の罠】「データ0件なら出さない/データ依存」系UIは本番にデータが無いと変更が見えない＝バグではない。本番に検証データを入れない。柄ダイアログのリストは本番 textile_patterns 0件なら空＝正常。

## ① 本セッションの成果（B-066-③ ＋ ③b 完了・柄マスター完結・本番migration適用済み）
- **PR #89（squash 66681ad）= B-066-③ ＋ ③b**：2コミット同梱。
  - **③（25c5d81）**：ProductColorway に patternId String? 増設（純scalar・@relationなし・null=単色）＋migration 35本目（20260618000000_b066_3_colorway_pattern_id・ADD COLUMN・非破壊）。中立型 TextilePatternOption ＋ listActiveTextilePatterns（listActiveColorsForPicker と同型・種別名結合）。validator/product-colorway に patternId（colorId と同じ緩い参照）。product-colorways の Row/select/create/update に配線。pattern-picker.tsx（検索+リスト・D#＋柄名＋種別バッジ・プレビューなし）。**checkTextilePatternUsage を productColorway.count({where:{patternId}}) の実参照に置換（②申し送り消化＝柄の本削除ガード有効化）**。
  - **③b（9ad2f18）**：カラー展開/柄展開ダイアログ分離（案A・入口2ボタン）。ColorColorwayDialog（色のみ）／PatternColorwayDialog（柄のみ）の2系統。共通フィールドを ColorwayCommonFields に切り出し DRY 化。編集時 cw.patternId ? 柄 : 色 で出し分け。排他なし（validator/action 無変更・両ダイアログで colorId/patternId/colorHex 温存）。一覧テーブル無変更。
- tsc0/eslint0/build成功。ローカル目視5点OK（2ボタン並ぶ／色だけD・柄だけD／鉛筆の出し分け／縦長解消）。
- **③本番確認＝済**：本番デプロイログで接続先 postgres-ab6d.railway.internal:5432・`Applying migration 20260618000000_b066_3_colorway_pattern_id`→`All migrations have been successfully applied.`・ポート8080 Ready を目視確認。本番DBにカラム適用済み。
- 後始末：リモートブランチ削除済み（GitHub squash 自動・gh api 404 で確認）。ローカル feat 削除済み（was 9ad2f18）。fetch --prune で古い fix/material-update-* 2本も prune。現在ローカル main のみ・クリーン。

## ② 本セッションで確定/再確認した設計（記憶で再構築しない）
- **③ 配線**：patternId は colorId の隣・純scalar・@relationなし・FK制約なし・null=従来単色。BomItemColorway・C/# マトリクスは変更不要。spec v1.1 §6 と現物一致を確認済み。
- **③b ダイアログ分離＝案A（柄展開は柄だけ・色なし）で確定**：入口2ボタン（＋カラー展開／＋柄展開）。色ダイアログ=共通＋ColorPicker＋HEX、柄ダイアログ=共通＋PatternPicker（色グリッド・HEXなし）。排他は導入しない（DB/validator緩いまま）。Popover は導入しない。データは ProductColorway 1行・記号(colorwayCode)で一意。
- **【重要・色×柄の色付きバリエーションは持たせない＝§4 維持】**：「ブルー系のボーダー」「ピンク系のストライプ」を patternId 一発で選ぶ案を検討したが却下。TextilePattern は構成色を持たない（§4）＝色×柄の掛け算でマスター爆発を避ける確定判断。代表色が要る場面は将来「案B（柄ダイアログに代表色 Popover）」で colorId を別途添える形に拡張する逃げ道を残すのみ。今回は入れない。
- 編集時の出し分け・両立ケース・フィールド共有の「煩雑」は、(1)patternId有無で開く側を決める一行判定 (2)案Aなら両方セット行はUI経路で発生しない・DBは許容のまま (3)共通フィールド小コンポーネント化、の3点で解消。

## ③ Railway環境（唯一の正）
- 本番DB postgres-production/postgres-ab6d/shuttle:16099（migrate deploy・_prisma_migrations あり）。本番アプリ内部接続は postgres-ab6d.railway.internal:5432（ローカル不可・公開プロキシ shuttle:16099 / DATABASE_PUBLIC_URL を使う）。本番アプリのポートは8080。
- dev DB postgres-development/hopper:12921（db push・_prisma_migrations 無し・migrate系打たない）。
- migration 35本（#89 が 35本目 20260618000000_b066_3_colorway_pattern_id・本番適用済み）。GCS dev=...-dev / prod=...-prod。
- Prisma 6.19.3。7.x メジャーアップ案内はデプロイログ/CLIに出るが未対応・無視。本番は Next.js 16.2.6。

## ④ dev DB（hopper:12921）
- colors=51件。柄種別 textile_pattern_types=9件(ACTIVE7/ARCHIVED2=DT,SOLID)。柄 textile_patterns=4件（BD-A/ST-M/CK-A/AO-A・③b 目視用に登録）。
- 本番 textile_patterns=0件（クリーン・検証データ未投入）。
- テスト品番 AOI-26AW-CUT_SEWN-001（③b 目視に使用・カラー展開に C/B/A 色 ＋ D=柄BD-A・F=柄ST-M が登録済み）。

## ⑤ 次セッション優先順
1. **SKU 設計（重要・腰を据えて）**＝下記⑥に詳述。柄が完結したので次の本命。**着手前に上流2点（数量の出どころ／色軸を ProductColorway に合わせるか）を慎太郎さんと確定してからコード**。決め打ち厳禁。
2. B-063残（colorNameEn/availableColors改訂/Sku色FK化/colorId FK正規化）＝帳票フェーズ。Sku色FK化は SKU 設計と直結（⑥-2）。
3. B-065（発注引き当て時 C/# 自動反映）＋柄版（先方デザイン番号の自動反映＝B-065の柄版・別タスク）。
4. QE-1（量産見積もり）：北極星完成で着手可能。Excel2点(縫製仕様書・原価シート)を参照資料化・再添付依頼。QE-1仕様書は Specification経由BOM前提で古い＝決定2(カラーウェイ軸)に合わせ見直し要。B-057(BOM→PO下書き)はQE-1後。

## ⑥ SKU 設計の次テーマ（⑤の1）
- **現状**：Sku モデルは設計スキーマに存在(カラー×サイズ・colorCode文字列直持ち=古い設計)。prisma.sku の使用は2箇所だけ(products.ts のcount=削除ガード / skus.ts のfindMany=一覧取得)。**create/upsert/update が皆無＝SKU生成導線が未実装＝dev/本番とも0件・作る手段がアプリに無い**。
- **噛み合わない点**：B-064「SKU数量マトリクス表示」(#82)は完了だが quantity-matrix-section.tsx は SkuRow[] を props で受け取って描画するだけの read-only=「箱だけ」。**北極星5要素の数量マトリクスは現状ずっと空**。実データを載せるには SKU生成導線が必須。
- **着手前に確定が要る2点（決め打ち厳禁・作り直しリスク）**：
  1. 数量(希望数/受注数)の出どころ＝saagara-v2連携 / CSV取り込み / 先方入力 / カルテ手入力 のどれか。
  2. 色軸を ProductColorway に合わせるか＝B-063④(Sku色FK化)と直結。今 Sku は色を文字列直持ちでカラーウェイ軸(決定2)と未合流。柄(patternId)も入った今、SKU 軸を colorId/patternId 付きカラーウェイ(ProductColorway)に揃えるか改めて要検討。
- これらは上流の意思決定。コードを書く前に固める。

## ⑦ 本日マージされた PR / push
- PR #89（squash 66681ad）: B-066-③（25c5d81）＋ ③b（9ad2f18）。migration 35本目・本番適用済み。
- main 先頭: 66681ad(#89) → d025c4f(docs) → df5de6f(#88) → 0c4cd58(docs) → 2b33724(docs)。
- 後始末：#89 リモートブランチ削除済み（GitHub自動）。ローカル feat 削除済み。fetch --prune 実施。現在ローカル main のみ・クリーン。
- 本番migrationステータス＝済（①に詳細・デプロイログ目視確認済み）。

## ⑥-2 1ページ傘下 backlog（更新）
- B-064 数量マトリクス=完了(#82・ただし箱だけ=SKU生成導線未実装で常に空・⑥参照) / B-062 β=完了(#83+#84) / B-063(B-2)=完了(#85) / B-027 絵型=完了(#86+#87) / B-066-②柄層2=完了(#88)＋層1 7種整理 / B-066-③ patternId配線＝完了(#89) / B-066-③b ダイアログ分離＝完了(#89) → 北極星5要素 完成＋柄マスター完結。
- **SKU 生成導線（⑥）=次の最優先・要・数量の出どころ＋色軸合流の確定**。
- B-063残（colorNameEn/availableColors改訂/Sku色FK化/colorId FK正規化）=帳票フェーズ。
- B-065（発注引き当て時C/#自動反映）＋柄版。
- 継続: B-048 / WorkOrder編集UI / B-037(docs整理)。
- 【宿題・未消化】本番の絵型アップロード smoke（sharp linux ビルド実動作確認・handover セッション7 ⑨-3 から継続）。
- 【UI将来要望】資材表の列順ドラッグ並び替え＋ユーザーごと列順保存。絵型サムネ複数サイズ/圧縮/HEIC/GCS孤児掃除/DesignVersion三位一体統合。付属マトリクス列見出しの truncate＋ツールチップ（柄に限らない既存課題）。柄ダイアログへの代表色 Popover（案B拡張・要 popover.tsx 導入）＝代表色が要る場面が出たら。

## ⑧ 次セッション冒頭の手順
1. このメモを貼り付け→状態復元
2. git checkout main && git pull → git log origin/main --oneline -5 で先頭が 66681ad か確認
3. drift 確認（migrate diff で No difference detected.）
4. SKU 設計に入るなら⑥の2点(数量の出どころ／色軸合流)を先に慎太郎さんと確定してからコード。design-reread で関連 spec を読み直してから(記憶で組まない)。

## ⑨ スキル化候補（継続・skill-packager で起こす）
- **shunya-prior-phase-pitfall-review（仮）**：design-reread が「設計意図」を spec から戻すのに対し、これは「実装の罠」を最も近い既存フェーズの実装/seed ブリーフから grep して移植する。今回も ③ で「色側に倣う」現物確認(listActiveColorsForPicker/buildTypeMap/colorId validator)を着手前に回せた動きを定着。新マスター/新配線の着手前に発動。
