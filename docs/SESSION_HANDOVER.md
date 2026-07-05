# shunya-pms セッション引き継ぎメモ（2026-07-05 / QE-1R P1〜P4完了・引き当て詳細は次回に持ち越し）

## ⓪ プロジェクト棲み分け（毎回先頭・要目視確認）
- 対象: shunya-pms（repo: github.com/shintarokoenuma/shunya-pms / local: ~/shunya-production-system / 本番: shunya-pms-web-production.up.railway.app）
- saagara-v2 とは別物。Claude Code 着手前に VS Code が ~/shunya-production-system を指しているか目視確認。

## 1. 本セッションの成果
QE-1R（概算量産見積）の実装を P1〜P4 まで完走し、実機での複数ラウンドの不具合修正まで完了した。

- **P1（スキーマ＋migration・dev反映）**: RoughEstimate/RoughEstimateItem 2モデル＋enum3種、migration 39本目。dev db push済み・慎太郎さん目視確認済み。
- **P2（サーバ側ロジック）**: 採番（RE-{year}-NNNN・P2002リトライ）／デフォルト利益率供給（Brand.defaultMarginRate）／過去実額引き当てクエリ（PoItem.materialId・WoItem.costCategoryId）／集計純関数（INITIAL_COST を原価分子から除外する絶対防衛線）。dev smoke で検算済み。
- **P3（UI＋結線）**: products/[id] の資材表BOM→資材所要量→マーキング実測の直後にQE-1Rセクション設置。
- **P4以降（実機不具合修正・複数ラウンド）**:
  - A-1〜A-4: ダイアログ崩れ・更新反映バグ（実は表示側の再計算漏れが原因）・工賃小計「—」バグ（form.watch()→useWatch化で解消）・MANUAL入力でも素材/費目選択できるように修正
  - B-1〜B-3: expectedQuantityBand列を削除（タイトル欄に統合）／初期費用インクルーズ切替機能（InitialCostBillingMode enum・SEPARATE/INCLUDED・提示MOQで割り返し1枚あたり配賦）／提示価格の内訳表示分離（量産提示分／初期費用提示分）
  - ダイアログ幅の全社的是正: 共通dialog.tsxのデフォルトがsm:max-w-sm(384px)で、個別ページのmax-w-*（sm:無し）は全てこれに負けて効いていなかったという根本原因を特定。共通デフォルトをsm:max-w-lgに是正し、各フォーム系ダイアログもsm:max-w-*に統一。
  - 明細セレクトの文字重なり・スクロール巻き戻りバグ: 真因はposition="popper"だけでは足りず、onValueChange内で他フィールドへform.setValueを連鎖させるSelect（費目区分・素材ピッカー・費目ピッカー・PAST_PO/WO候補焼き込み）で、選択→setValue→再レンダリング中にダイアログのscrollTopが巻き戻ることが原因。preserveDialogScroll()でdouble rAF方式のスクロール位置復元を実装し解消。慎太郎さん実機確認済み（「治りました」）。
  - 費目区分↔出所（source）の連動制限: MATERIAL→MANUAL/PAST_POのみ、LABOR→MANUAL/PAST_WOのみ、INITIAL_COST→MANUALのみ。費目区分変更時に無効なsourceは自動でMANUALへリセット。
  - 引き当て候補に親PO/WOのタイトル表示を追加。

## 2. 完了状態・PR状態
- ブランチ: feat/qe1r-p1-rough-estimate-schema
- PR #96（P1〜P4すべてこの1本に積載・継続中・未マージ）
- 直近コミット: d617890（スクロール巻き戻り修正・慎太郎さん実機確認済みの最終コミット）
- マージ判断は慎太郎さん。マージすると本番 migrate deploy（RoughEstimate/RoughEstimateItem 新設テーブル＋enum4種・expectedQuantityBand削除・InitialCostBillingMode追加を含む）が走る＝triple-gate対象。

## 3. DB状態
- dev = hopper.proxy.rlwy.net:12921（postgres-7492）: QE-1R関連スキーマ反映済み・慎太郎さん目視確認済み。P4セッション中の検証用一時データ（PoItem/WoItem等）はすべて削除・親レコードのtitle等も復元済み。
- 本番 = shuttle.proxy.rlwy.net:16099（postgres-ab6d）: 未反映（PR #96マージ後にtriple-gateで実施）。
- migration本数: 39本目（20260701000000_rough_estimate、PR未マージのため直接書き換え可能な状態で複数回改訂している。マージ前提でこのまま1本として本番に流す）。

## 4. 未確定の設計論点（次回セッションで詰めたいこと＝慎太郎さんの最優先事項）
QE-1R過去実額引き当てキーの再検討（2026-07-05起票・詳細はメモ#22参照）:
- 現行設計: PAST_PO引き当てはmaterialId（素材マスター）キー、PAST_WO引き当てはcostCategoryId（費目マスター）キーで検索。
- 慎太郎さんの指摘: 工賃（costCategoryId）は費目マスターで問題ないが、材料費側は「素材マスターに登録済み」でないと引き当てできず、都度素材登録が必要になり実務で使われない懸念がある。
- 代替案: 「発注先（仕入先/外注先）」をキーにする方が、材料費・工賃の両方で共通に使え実用的ではないか、という論点。
- 次回セッション最優先タスク: この引き当てキー設計を再検討する（材料費側だけ仕入先ベースに変える案／両方仕入先ベースに揃える案、を比較検討してから実装方針を決める）。設計変更を伴うため、着手前に design-reread Step 0 で対象確定してから進める。

## 5. 記憶に残っているその他のバックログ（QE-1Rとは別テーマ・優先度中）
- WorkOrder（WO）がステータス=DRAFTの間は編集を許可してほしい（メモ#21）
- PurchaseOrder（PO）を品番カルテから作成した場合、保存後に一覧ページへ飛ばさずカルテ内に留まってほしい（メモ#23）
- PO明細行の「複製」機能（色違い・サイズ違いの発注を効率化）
- 全体的な入力UX見直し（入力動線・必須項目視認性・色分け等）

## 6. 次セッションで最初にやること（優先順）
1. STEP 0: git log origin/main --oneline -8 で実態確認。
2. design-reread Step 0 発動 → QE-1R引き当てキー再検討の対象確定（v0.1 §4「一次source」の記述を再読）。
3. 引き当てキー設計の再検討（§4参照）に着手。慎太郎さんとの論点整理から入る。
4. 設計が決まれば、既存のlistPastPoItemsByMaterial/listPastWoItemsByCostCategoryとUI（PastPoSearch/PastWoSearch）を改修。PR #96はまだ未マージなので、同一PRに追加するかどうかは慎太郎さんと相談。
5. PR #96自体のマージ判断も並行して仰ぐ（ローカル目視は完了済み、マージのタイミングは慎太郎さん次第）。

## 7. 注意点・教訓（本セッションで得た重要な学び）
- 「ビルドが通った」「コードを直した」だけで「直りました」と報告しない。今セッションで複数回、Claude Codeがコード修正のみで完了報告し、実際には直っていない事態が発生した。以後は必ずPlaywright等で実際にブラウザ操作を再現し、スクリーンショット・実測値（scrollTop等）で裏取りしてから報告するルールを徹底した。
- headless環境で再現しない不具合がある。ダイアログのスクロール巻き戻りは、viewport高さや明細行数を変えることで初めてheadlessでも再現できた。「headlessで再現しないので対策のみ」という報告は不十分な場合があるため、条件を変えて再現を試みることが重要。
- 共通コンポーネントのデフォルト値がページ側の指定に勝つケースがある（Tailwindのクラス優先順位・sm:変種の有無で発生）。個別ページの「幅を広げたはず」という思い込みだけで判断せず、実際にDOMを検証すること。
- 設計論点（引き当てキーの妥当性）は実装バグとは別に扱う。慎太郎さんからの「わかりずらい」「流用性がない」といった指摘は、バグ修正ではなく設計変更の話であり、次回セッションで腰を据えて検討する。

## 8. 本セッションでのコミット一覧（PR #96・feature branchへの積み増し。mainへのマージはまだ）
- cf81638 P1: スキーマ
- 78220b0 P2: サーバ側ロジック
- 6e1f04d P3: UI＋結線
- 0f58634 P4: 不具合修正＋初期費用インクルーズ切替
- 014ff06 hotfix: Runtime TypeError（Prisma generate漏れ）
- e259d9c fix: ダイアログ幅の全社的是正
- 1e30f28 fix: SelectTrigger w-full化（一部原因）
- e491a25 fix: ダイアログ幅の真因修正（sm:max-w-*統一）
- 3d019f0 feat: 費目↔出所連動制限＋候補タイトル表示
- cf9e86a fix: スクロールジャンプ修正（position=popper・不完全）
- 91492d0 fix: 全SelectContent popper徹底＋autoComplete対策
- d617890 fix: スクロール巻き戻りの真因修正（preserveDialogScroll・慎太郎さん実機確認済み）

## 9. 次セッション冒頭の手順
1. このメモで状態復元。
2. git log origin/main --oneline -8 で実態確認（feature branchの先頭がd617890か、あるいはさらに進んでいないか確認）。
3. design-reread スキル発動 → v0.1 §4を再読してから引き当てキー設計の論点整理に入る。
4. 慎太郎さんと「材料費側だけ仕入先ベースに変える」か「両方仕入先ベースに揃える」かを相談し、方針確定後に実装。
