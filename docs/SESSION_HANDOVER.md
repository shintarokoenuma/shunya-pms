# SESSION_HANDOVER.md（2026-07-20 締め その2 / 量産軸(A) seed① 本番リリース完了）

## ⓪ プロジェクト棲み分け（毎回先頭・要目視確認）
対象: shunya-pms（github.com/shintarokoenuma/shunya-pms / ~/shunya-production-system /
本番 shunya-pms-web-production.up.railway.app）。saagara-v2 とは完全に別物。
★localhost:3000 は saagara-rebuild が使用中。shunya-pms の dev は PORT=3001。
ポートの正体は lsof -nP -iTCP:3001 -sTCP:LISTEN → PID の cwd で確認。

## ① 現在フェーズと完了状態
- フェーズ: 業務トランザクション期・量産軸。**(A) 量産見積レーン seed① 完了・本番リリース済み**。
- 本セッション（07-20 後半）の完了事項:
  - **PR #106**（4fdde39）: ProductionEstimate/Item スキーマ＋確定サンプルフラグ
    （isProductionEstimateBase・1品番1点 partial unique index=SQL手書き）。
    triple-gate 完了（dev 確認→本番 dry-run ROLLBACK→migrate deploy→partial index 本番実在確認）。
  - **PR #107**（6c59d5c・migration なし）: 量産見積の実体実装。コミット5本:
    6e00628 実体（基準サンプル指定・コピー導線・calc・UI）／c8244f3 1枚あたり中心表示
    ／c94a462 単位入力・数量追従・行並替↑↓・費目色分け／8305663 一覧掲載・分母0案内・
    単位プルダウン・カット代METERガード（バグ修正）／32d0579 非計上の補足文言。
  - calc.test 10/10。慎太郎さんローカル確認で3巡のフィードバックをすべて反映済み。
- 機能の入口: 品番カルテ→サンプル一覧「基準にする」→「サンプルから見積作成」→
  /production-estimates/[id]（詳細）・/edit（編集）。/quotations に量産見積セクション併設。

## ② 未マージ PR
- なし（#106・#107 ともマージ済み・ブランチ削除済み）。

## ③ dev DB の状態
- VERIFY 系（PE2VERIFY）物理残存 0・全 PE 件数 0・WO/PO-2026-0004 原状（明細1件ずつ）。
- AOI 品番の基準サンプルフラグもリセット済み（base=0）。
- 接続先 dev = hopper.proxy.rlwy.net:12921。本番 = shuttle:16099（postgres-ab6d）。
- dev サーバ PORT=3001 稼働中の可能性あり（セッション終了時点）。

## ④ ナレッジ登録状況（鉄則4）
- 本セッションの新規 spec/addendum なし（実装セッション・設計判断はチャット確定）。
- 実装ブリーフ2本（PR-1/PR-2）＋追加修正指示3本はチャット内のみ（ファイル化不要と判断）。

## ⑤ 次セッションで最初にやること（優先順）
1. **本番表示確認（未実施）**: 本番の品番カルテに「量産見積」セクション・「基準にする」
   ボタン、/quotations に量産見積セクションが表示されることを目視確認。
2. **B-080 実装**: (a) PE 明細行へのマスターピッカー追加（MATERIAL=素材ピッカー・
   LABOR=原価費目ピッカー・SearchableSelect・選択で品目名自動補完＋上書き可＝QE-1R 作法）
   (b) 既存 Select の検索対応展開（素材ほか）。※(B) より先に実施
   （理由: PE 実運用でマスター非連携の手動行が溜まるのを防ぐ）。
3. **(B) 量産発注生成の仕様確認書**: 保存済み量産見積（最新版）→SKU 数量入力→PO/WO
   ドラフト生成（Q-d/Q-e・PoItem.productColorwayId 新設・B-083 調達区分と同時設計）。

## ⑥ 申し送り・バックログ（本日新規起票 B-081〜B-084）
- **B-081**: サイドバー並び順変更（案件→取引→マスターの順に。現状はマスターが先頭）。
- **B-082a**: 品番一覧のサムネイル拡大（スクロールせず大枠が掴めるサイズ）。
- **B-082b**: 品番カルテの絵型をメイン＋サムネイル方式に（1枚目大・以降下に小・切替）。
- **B-083**: 明細行の調達区分 procurementRoute（COMPANY_ARRANGED/CLIENT_SUPPLIED/
  STOCK_ALLOCATED）。全明細行共通の直交軸・COMPANY_ARRANGED のみ分子計上・
  (B) の PO 生成判定キー。migration あり。(B) 仕様確認書と同時設計。
  在庫引き当ての実在庫参照は B-023 接続の将来段。それまで支給品・引き当て品は
  「単価空→計上外（単価未入力）」運用でつなぐ。
- **B-084**: PE 明細行のドラッグ&ドロップ並び替え（現状は↑↓ボタン）。
- 既存: B-072〜B-077・B-080（→⑤-2 に昇格）。B-065 は #94 クローズ済み・(B) に吸収。

## ⑦ 本日マージした PR
- PR #106: feat/pe1-schema（PE スキーマ＋確定サンプルフラグ・migration）→ 4fdde39
- PR #107: feat/pe2-estimate-core（量産見積 実体・5コミット）→ 6c59d5c

## ⑧ 設計確定事項（チャット確定・spec 未文書化のもの）
- 量産見積の1枚あたり表示: MATERIAL=単価×使用量×(1+ロス率)・LABOR=単価×数量÷分母。
  MATERIAL は所要量（自動）表示・数量入力なし（quantity 列は温存・LABOR で使用）。
- LABOR 数量は見積数量に自動追従（編集で解除・「見積数量に戻す」で再追従・form 状態のみ）。
- 単位は PE 明細のみプルダウン（m/yd/個/枚/組/式/巻/反/㎏/cm＋その他…自由入力）。
  PE_UNIT_OPTIONS。WO/PO/BOM は自由入力のまま（単位マスター化は将来課題）。
- カット代は METER 限定（calc/フォーム/保存の三層ガード）。
- 別枠（初期費用）は既定非計上・presentedPriceManualJpy 入力行のみ計上（§1-5）。
  版代・パンチ代等を量産で請求する場合は編集で提示額を入力（二重請求防止の設計意図）。
- 費目色分け: MATERIAL=sky・LABOR=グレー・別枠=amber（最優先）。
- /quotations は2セクション（概算 QE-1R＋量産見積）。

## ⑨ 運用の教訓（本セッション追加）
- dev サーバは schema 変更 PR の後に必ず再起動（stale Prisma Client で enum undefined になる）。
- Railway GUI の Data タブは複数文トランザクションの一括実行に不向き。
  本番 dry-run は Console タブ（psql）で BEGIN→全文→count 確認→ROLLBACK が正。
- stacked PR は base が先にマージされたら rebase --onto origin/main で載せ替え・
  force-with-lease・PR は base=main で開き直す（本日 #107 で実践）。
