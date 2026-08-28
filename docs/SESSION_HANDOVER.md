# セッション引き継ぎメモ（2026-08-28 更新）

## ⓪ 次セッションの最初の一手

shunya-session-start スキルを発動する。発動せずに指示文を出さない。

## ① プロジェクト棲み分け

- shunya-pms（~/shunya-production-system）と saagara-v2（~/saagara-rebuild）は完全に別物
- Claude Code 向け指示書には毎回冒頭に【対象プロジェクト】ヘッダを入れる
- 指示を貼る前に VS Code のウィンドウが shunya のローカルパスか目視確認する
- 2026-08-22 に shunya 向け指示が saagara に流れる誤送信が発生した（shunya への影響は無し・確認済み）

## ② git の状態（2026-08-28 セッション終了時点）

- ブランチ: main（docs を main に commit したため main のまま終える）
- main HEAD: b0bf603（締め commit）＋本ファイルの同期 commit
- 本日の main commit: c622467（PR #136 マージ・PR-2a 本番反映）→ b9699b0（設計ドキュメント）→ b0bf603（締め）
- open PR: 0件。未マージ PR は無い
- 未 push のローカル commit: 無し（全ブランチ確認済み）
- 次に振れる番号: B-182
- 作業ツリーの untracked: skill/ 配下の zip のみ（repo に入れない方針で確定）
- ★ローカルブランチが 40 本以上残存し、大半が origin 側で削除済み（gone）。
  掃除は未実施。B番号は振っていない（要件ではなく作業のため）

## ③ 本日の成果

1. B-168 addendum v0.1 の D-4 改訂を実装（歩留まりの既定を「率 5%」→「加算枚数 0 枚」）
   - sales-order-form.tsx の DEFAULT_YIELD_RATE を廃し、DEFAULT_YIELD_MODE / DEFAULT_YIELD_VALUE に置換
   - 新規入力の既定と、yieldMode が null の既存行を復元するときのフォールバックの両方を QUANTITY / 0 に統一
   - validators/sales-order.ts の default も YieldMode.QUANTITY に揃えた
2. PR #136 をマージ（squash c622467）。本番 migration 20260819000000_b167_b168_so_item_yield 適用済み
3. 本番で目視確認（read-only・保存なし）
   - 受注の新規作成フォームの既定が「一律・加算枚数・0」／受注数 2 → 量産数量 2
   - 品番カルテの数量マトリクス下段が編集不可（D-2）＋「受注（SO）由来」の凡例あり
   - 本番の受注一覧は 0 件（PR-1 は 8/17 から稼働しているが実運用の受注はまだ入っていない）
4. 設計ドキュメント docs/SALES_ORDER_QUANTITY_DESIGN.md を実装から起こした（b9699b0・200行・file:line 60箇所）
5. BACKLOG の状態を更新（B-148 追記 / B-164 完了 / B-167 進行中 / B-168 完了 / B-179 訂正追記）

## ④ 本日確定・確認した事項

### 歩留まりの既定（B-168 addendum v0.1 §1 の実装）

- 既定は QUANTITY / 0。無操作なら productionQuantity = orderedQuantity
- 率(%)を使う場合は方式を明示的に切り替えて入力する
- D-6 の切り上げは RATE のときだけ発生するため、既定では端数が出ない

### ★新規既定と復元フォールバックの両方を倒した（設計判断）

yieldMode が null の既存行は「歩留まり未指定」＝受注数のまま、という意味である。
したがって新規入力の既定（loadSkus）だけでなく、既存行を編集画面で復元するときの
フォールバック（172 / 177 / 277 / 341 / 750 行）も QUANTITY / 0 に統一した。
片方だけ直すと既存 SO を開いた瞬間に 5% が復活する。

### 設計ドキュメントに記録した、運用判断に効く事実

- Sku.orderedQuantity / Sku.productionQuantity は SO 由来のキャッシュ列。
  書き戻しは recomputeSkuOrderedQuantities のみで、4アクション（create / update /
  updateStatus / cancel）がいずれも同一 $transaction 内で呼ぶ。よって部分適用は起きない
- 集計対象は COUNTED_STATUSES（CONFIRMED / IN_PRODUCTION / PARTIAL_DELIVERED /
  DELIVERED / COMPLETED）のみ。TENTATIVE / CANCELLED / ON_HOLD は数に入らない
- 書き戻しは加算ではなく set（上書き）なので、二重に走らせても値はずれない
- ★ただし同一 SKU への並行 SO 操作を直列化するロックは未実装。
  別 tx が同時に集計→書き込みすると最後の write が勝つ。保護が要るなら別途
- ★auditLog と revalidate は tx の外・後。コミット後に auditLog が失敗すると
  数量は反映済みのまま監査ログだけ欠ける可能性がある
- ★資材所要量も発注生成もサイズ軸は合算で消える（色別まで）。B-181 のとおり
- 旧インライン編集アクション updateSkuQuantity は定義が残るが呼び出し 0 件（休眠）。最終処分は B-178

## ⑤ 次にやること（優先順）

| 順 | 内容 | ライフサイクル | 備考 |
|---|---|---|---|
| 1 | B-148 PR-2b（SO→量産発注の接続・B-156 を同時判断） | 7 → 8 | ★これで原マイルストーン M4 完了。着手前に SALES_ORDER_QUANTITY_DESIGN.md を読む |
| 2 | B-173（動線マップ・docs のみ） | 全体 | 本番影響ゼロ。B-166 / B-176 / B-090〜093 の優先順位付けの前提。画面が増えるほど高くつく |
| 3 | B-170（クライアント名寄せ基盤） | 6 → 7 | B-171（専用オーダーページ）と B-149（流入経路）の共通前提。これが無いと1行も登録できない |
| 4 | B-146（仕様書 Specification の中身） | 5 | MVP 実装計画書 §10.1 の最優先課題の2番目。prisma.specification の呼び出しは今もゼロ |
| 5 | 古いローカルブランチの掃除 | — | gone が 40 本超。作業のため B番号なし |

★背骨で空いているステップ: 1（問い合わせ）・2（企画）・5（仕様書）・6（受注期間）・
　10（検品/完成品在庫）・12（請求）・13（分析）。
★通っているのは 4（サンプル）・7（受注）・8（量産発注）・9（進捗）・11（納品）。
　7 は PR-1 と PR-2a が本番稼働、PR-2b が未着手。

## ⑥ 環境

- dev DB: hopper.proxy.rlwy.net:12921（PORT 3001）
- 本番 DB: shuttle.proxy.rlwy.net:16099（★PR-2a の migration 適用済み）
- ★Railway から取るのは DATABASE_PUBLIC_URL。末尾の DB 名まで tail -c で検証
- ★取得は pbpaste を使う。cat > の対話入力方式は指示に書かない
- dev の残置データ: SO-2026-0001(CANCELLED) / 0002(CONFIRMED) / 0003(TENTATIVE) / 0004
- ★本番の受注は 0 件。実運用データはまだ入っていない
- dev サーバ（localhost:3001）は本セッション中に起動したまま。次セッションで止めるか再起動する

## ⑦ 気づきメモ（Google ドキュメント）

2026-08-22 に読み込み、未起票だった3項目を起票済み（B-073 統合 / B-175 / B-176）。
本セッションでは未読。次セッションで読み直す。
★Claude から Drive への書き戻しは不可（消し込みは慎太郎さんが行う）。

## ⑧ 本セッションの失敗（繰り返さない）

1. ★セッション冒頭に貼られた確認出力が 2026-08-22 のもの（6日前）だったのに、
   それを現在のライブとして現在地を宣言した。結論は変わらなかったが、
   2026-08-22 の失敗2（日付の思い込み）と同型。
   → 確認ブロックの先頭に必ず date を置く。貼られた出力は日付を先に見る。
   → shunya-session-start に反映済み（zip 納品・次のチャットから有効）。
2. ★squash マージ済みの PR に対し git merge-base --is-ancestor で取り込みを判定し、
   偽の STOP を出した。squash は元コミットの SHA を破棄するため祖先判定は必ず false になる。
   Claude Code が「内容で判定すべき」と正しく切り分けた。
   → squash 運用では SHA ではなく main の現物を grep して判定する。
   → ★file-write-verification への反映は未実施（下記 ⑬）。
3. ★dev（localhost:3001）で行うよう指示した目視が本番で実施された。read-only で保存も
   していないため実害なし。→ 確認項目ごとに「dev か本番か」を1行で明示する。
4. ★同一の確認出力が1回再送された。file-write-verification 鉄則8 に従い分析せず、
   求めているのがブラウザ操作であることを再提示して解消した。

## ⑨ ナレッジ登録の状況

★2026-08-28 に実確認した結果

- 登録済み: b-168-production-quantity-spec-confirmation-v0_1-2026-08-19.md
- 登録済み: b-148-pr2a-implementation-brief-2026-08-19.md
- 登録済み: b-168-production-quantity-spec-addendum-v0_1-2026-08-22.md
- 差し替え済み: SESSION_HANDOVER.md（Claude が project_write で更新・本ファイルと同内容）
- ★新規登録が必要: docs/SALES_ORDER_QUANTITY_DESIGN.md（repo から慎太郎さんがアップロード）
- ★差し替え必要: BACKLOG.md（repo から慎太郎さんがアップロード。Claude 側で再構成すると
  repo と食い違うため、必ず repo の現物を上げる）

## ⑩ 本セッションの増減（沈黙の禁止）

- B-番号 増減: 新規 0件／状態変更 4件（B-148 追記・B-164 完了・B-167 進行中・B-168 完了）／
  定義文への訂正追記 1件（B-179）／取り下げ 0件／番号未採番の合意 0件
- 繰り延べた要件: 0件（本セッションで新規作成・改訂した spec が無いため）
- スキルの更新: 1件納品（shunya-session-start）／1件未実施（file-write-verification・下記 ⑬）
- ナレッジ登録: 1件反映済み（SESSION_HANDOVER.md）／2件依頼中（⑨のとおり）
- 設計ドキュメント: 1件（docs/SALES_ORDER_QUANTITY_DESIGN.md）

## ⑪ 未確定・持ち越し

- ★PR #136 の dev 目視のうち §11-4〜9（率5%の切り上げ／+10 の加算／色別・サイズ別の
  一括適用／単価空欄／CONFIRMED 書き戻し／CANCELLED 減算）は未実施。
  計算ロジックは sales-order-quantity.test.ts が全ケース通過で担保されている。
  実運用の受注が本番に入った時点で実データで確認する
- B-167 の突合警告は B-143（確定見積 QE-2）待ち。本セッションで状態を進行中にした
- B-181（資材のサイズ軸）は案A（起票のみ・先送り）で確定。
  b-067 v1.0 D1 の改訂 addendum が別途必要
- 同一 SKU への並行 SO 操作の直列化ロックは未実装（⑫の設計ドキュメント §5 参照）。
  実務上の同時多発は稀という前提で保護を入れていない
- 古いローカルブランチ 40 本超（gone）の掃除は未実施

## ⑫ 設計ドキュメント

- docs/SALES_ORDER_QUANTITY_DESIGN.md（repo commit b9699b0 / ★ナレッジは未登録）
  … 決定アルゴリズム・データスキーマ・状態ストア・命名規則と既定値・失敗時の挙動と冪等性・
  下流への伝播・環境変数の7項目を file:line つきで記載
  - 量産数量 = RATE なら ceil(受注数 × (1 + 率/100))、QUANTITY なら 受注数 + 加算枚数。
    切り上げは SKU 単位。null はその項を 0 として扱う
  - Sku 側への書き戻しは同一 tx 内・set 上書き。COUNTED_STATUSES のみ集計
  - ★並行 SO 操作を直列化するロックは未実装（保護なし）
  - ★資材所要量・発注生成ともサイズ軸は合算で消える（B-181）

## ⑬ スキルの更新（★次のチャットから有効）

- shunya-session-start: 更新版を zip で納品済み（2026-08-28）。
  第3層の確認コマンドに date を必須化、「貼り付けられた出力は日付を先に見る」判定を追加、
  現在地の宣言に確認時刻を追加。★慎太郎さんがアップロードすれば次のチャットから有効。
- file-write-verification: ★更新できなかった。
  本セッション中にスキル一覧の description が変化し（exit 1 での停止条件・SQL 前の
  スキーマ実測が追加されていた）、Claude が読み込んでいた本文が旧版だと判明したため。
  旧版から zip を作ると新しい2つの鉄則を消してしまう。
  → 次セッションで、現在の SKILL.md 全文を Claude に渡してから追記する。
  追記したい内容: squash マージ運用では、PR の取り込みを SHA の祖先判定
  （git merge-base --is-ancestor / git branch --merged）で判定しない。squash は元コミットの
  SHA を破棄するため必ず false になる。main の現物を grep して内容で判定する。

## ⑭ ブランチ

★本セッションは docs を main に commit したため main のまま終える。
feature ブランチへ戻すと当日の docs がローカルの作業ツリーから消える。
コードの作業を再開する時に、その場でブランチを切り替える。
