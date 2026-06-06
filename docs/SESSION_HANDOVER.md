# 引き継ぎメモ (2026-06-06 セッション / 仕様議事録v1.0確定・currency-prices棚上げ → 次はS-1実装指示書)

## ⓪ 最重要・プロジェクト棲み分けルール（毎回必須）
- shunya-pms（リポジトリ shintarokoenuma/shunya-pms・ローカル ~/shunya-production-system・本番 shunya-pms-web-production.up.railway.app）と saagara-v2（別リポジトリ・本番 saagara-v2-production.up.railway.app）は完全に別物。
- 過去に VS Code の Claude Code 別ウィンドウで両者を混同して作業した経緯あり（最悪 saagara 本番に shunya 変更が乗る事故リスク）。
- 対策：(1) Claude Code 向け実装指示書には毎回冒頭に【対象プロジェクト】ヘッダ（リポジトリ/ローカルパス/本番URL/saagaraとは別物の注記）を固定で入れる。(2) 指示書を貼る前に VS Code のそのウィンドウが ~/shunya-production-system を開いているか目視確認する。

## ① 本セッションで確定したこと（仕様議事録 v1.0）
- 「品番カルテ × サンプル製作 × 進行チェックリスト」仕様議事録を v1.0 確定。§9 の6論点をすべて確定。
- 保存先：docs/specs/product-sample-spec-confirmation-v1_0-2026-06-06.md（main にコミット済み e0a3130）。これが唯一の正。
- 6論点の確定要点：
  1. タスク項目＝サンプル8タスク（仕様確定/パターン/生地/付属/縫製/加工/検品/先方提出評価）。生地と付属は分離。加工はプルダウン方式（ProcessingType 軽量マスター・選んだ分だけ生成）。品質表示の独立タスクは廃止（表示内容→#1仕様確定に内包・下げ札資材→#4付属に吸収）。量産は＋グレーディング＋納品。
  2. データ構造＝案C-1（タスク行モデル ProgressTask・新規）。自動生成は定型全生成＋加工は選択分のみ。
  3. Product 採番＝MK-26SS-TS-001。品番体系を重要確定：社内品番(productCode)が案件の背骨／先方品番(clientProductCode)は別フィールド／表示で前面を切替(clientProductCode||productCode)／品名だけで動かず必ず案件化を強制（下書き状態は持たない）。categoryId は採番に必須なので Zod で必須化（schema は optional 据え置き・migration なし）。
  4. SampleProduction＝SP-2026-0042。parentSampleId で系譜。status は初期手動遷移。
  5. 発注連携＝サンプル起点に絞る。WO=作業/PO=現物の区別。初期費用費目（版・型・パターン・刺繍パンチ・グレーディング）。「個別売り立て/製品単価インクルード」の2区分フィールド。版類は PO・現物資産として扱い受け皿（現物資産フラグ・保管期限）のみ作る → 本格在庫管理は B-023。資材は品番単位でまとめ発送。
  6. 段階順序＝S-1 → S-2 → S-3a(ProcessingType マスター) → S-3(進行チェックリスト) → S-4(発注連携)。チェックリストを発注連携より先。

## ② 新規バックログ（本セッションで起票）
- B-023：版類（型・版・パターン・刺繍パンチ）の在庫管理・再利用判定。保管期限つき・再利用できる現物資産として生地/付属（消費型）と別カテゴリで持つ。最初の山では PO 側に受け皿のみ。優先度中。
- B-024：自社ブランドの生地・付属・織りネーム在庫。OEM=消費型／自社ブランド=在庫型の区別を在庫設計の最初の前提に組み込む申し送り。最初の山ではスコープ外。

## ③ リポジトリ状態の重要発見と対応（currency-prices 棚上げ）
- feat/currency-prices-incoterms ブランチに、記憶の曖昧な未コミット作業を発見（2026-06-03 夕方作成）。内容＝enum Incoterms 追加＋ProductPrice モデル新規（通貨別 上代/卸/原価）。Product 本体への列追加はなし（リレーション prices のみ）。
- 調査結果：コミット0・stash0 で全部未コミット（消すと戻らない）。dev DB(hopper:12921)には migration 20260603092457 適用済み・product_prices テーブル生成済みだが 0行（backfill未実行）。本番(shuttle:16099)は無風。
- 対応：消さず A案（保全コミット＋棚上げ）を採用。保全コミット 8f821f5（feat/currency-prices-incoterms 上・未 push・ローカルのみ）。
- 正式採用は「別途 PR 化 → dev dry-run backfill 確認 → マージ」の手順。良いタイミングで進める（次の山候補）。
- S-1 への影響：なし。S-1 は Product 本体 schema 無変更見込みのまま進められる（差分確認済み）。dev DB に product_prices/Incoterms が残るが S-1 は触らないので無害。

## ④ S-1 着手前の確認事項（次セッション冒頭で確定）
- (1) categoryId 必須化（議事録で確定済み・Zod で必須化、schema は optional 据え置き）→ 指示書に反映でOK。
- (2) 1A-12 手動採番UI（model-codes/new）の撤去方式：「導線非表示＋ファイルは MASTER_ADMIN ガードで温存（完全削除は後日）」の可逆方式で進めてよいか。← 次セッション冒頭でこの1点を確定すれば S-1 指示書を出せる。

## ⑤ 次セッションで最初にやること（優先順）
1. 上記 ④(2) の 1A-12 撤去方式を確定。
2. main を最新化（git checkout main && git pull origin main / 最新は e0a3130）。
3. main から S-1 用の新ブランチを切る（名称案 feature/s-1-product-crud-v2。既存 feature/s-1-product-crud〔6/3作成〕は古い別物なので衝突回避で新名）。
4. S-1（Product 基本CRUD）の Claude Code 向け実装指示書を作成（採番・status・ProductStatusHistory記録・ModelCode連携〔既存選択＋新規発番〕・clientProductCode常設・品番表示主従ヘルパー・categoryId必須・1A-12導線撤去）。schema 無変更見込みなので dev で動作確認・本番 smoke test。

## ⑥ 注意点・残課題
- main に v1.0 が2ファイル並存：古い docs/product-sample-spec-confirmation-v1_0-2026-06-03.md（202行・別物）と 正の docs/specs/...v1_0-2026-06-06.md。06-06版が唯一の正。古い 06-03 版（と s-1-product-crud-implementation-brief-2026-06-03.md）は「superseded」注記を付けて残すか削除するか未決＝次セッションで整理（優先度中）。
- reflog に古いブランチ feature/s-1-product-crud(6/3 16:51) あり。前回 (B) で「古い別物」とした S-1 作業跡の可能性。S-1 着手時に棚卸し。
- 業務トランザクションは schema 変更（migration）を伴う段階（S-3a 以降）あり。dev 検証 → 本番は別途明示指示＋ host 照合（本番=ab6d/shuttle:16099, dev=7492/hopper:12921）＋三重ガードを全面適用。
- Git運用：docs単独=main直push可 / コード含む=PR必須（shunya-git-workflow）。

## ⑦ 本日マージ/コミットされたもの
- e0a3130（main・push済）：仕様議事録 v1.0 を docs/specs/ に追加。
- 8f821f5（feat/currency-prices-incoterms・未push・ローカル保全のみ）：currency-prices-incoterms の保全棚上げコミット。

## ⑧ 既存バックログ（継続・未着手）
- B-016 Color マスター拡張（PANTONE/DIC）/ B-017 参照データ系の監査方針 / B-018 出荷・貸出伝票ページ / B-019 CSVインポート / B-020 quality-label-app 統合（①完全統合・品質表示タスクと連携）/ B-021 全マスター監査スナップショット網羅強制 / B-022 外部パートナー開放（進行チェックに受け皿を先に仕込む方針は v1.0 §7 に反映済）。

## ⑨ 次セッション冒頭の手順
1. このメモを貼り付け → 状態復元。
2. 議事録は main の docs/specs/product-sample-spec-confirmation-v1_0-2026-06-06.md が正（プロジェクトナレッジにも 06-06 版あり）。
3. ④(2) を確定 → main 最新化 → S-1 新ブランチ → S-1 実装指示書づくり。
