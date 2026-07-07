# shunya-pms セッション引き継ぎメモ（2026-07-07 / 道A＋消費税を本番反映（PR #97 マージ）・初期費用再設計（フラグ方式）の spec＋ブリーフ確定）

## ⓪ プロジェクト棲み分け（毎回先頭・要目視確認）
対象: shunya-pms（repo: github.com/shintarokoenuma/shunya-pms / local: ~/shunya-production-system / 本番: shunya-pms-web-production.up.railway.app）。saagara-v2 とは別物。Claude Code 着手前に VS Code が ~/shunya-production-system を指しているか目視確認。

## 1. 本セッションの位置づけ
道A（手打ち単価・2セクションPDF）を Part E〜I まで実装し PR #97 として本番反映まで完了。その直後の実運用確認で初期費用の構造問題（引き当て不可・工賃区分経由で防衛線を破れる）が判明し、慎太郎さん発案のチェックボックス（別枠フラグ）方式への再設計を確定。read-only 調査 → spec v0.1 → 実装ブリーフまで固めた。次セッションは実装から。

## 2. 本日 main にマージ/反映されたもの（時系列）
- `e8d5bf3` docs: 道A実装ブリーフ（丸め＝円未満切り上げ）
- `228571c` docs: 消費税追補 v0.1（税抜/10%/税込3段・切り捨て）
- `d944e99` **PR #97 マージ（squash）**: QE-1R 見積書PDF・横断一覧・見積コピー＋道A＋消費税（Part A〜I・14 files・+1,358/−81 相当＋Part I）
  - migration 40本目 `20260706000000_road_a_manual_price_columns`（純増2列）**本番適用済み**（デプロイログで確認・Next.js 正常起動・本番 smoke OK）
- `18f25f6` docs: 初期費用再設計 spec v0.1（別枠フラグ方式）
- `e745bd9` docs: 初期費用フラグ方式 実装ブリーフ ← **main 先頭**
- 前日分: `4e79508`（PDF spec v0.2＋addendum）は前セッション末尾に保存済み

## 3. 道A＋消費税の完成形（本番稼働中）
- スキーマ: `RoughEstimate.finalUnitPriceManualJpy` / `RoughEstimateItem.presentedPriceManualJpy`（手打ち2列・旧 `finalPriceManualJpy` は非推奨化＝列残置・読み書き停止）
- 丸め: 自動参考単価・初期費用自動提示額＝円未満**切り上げ**（Math.ceil）。手打ちは整数円そのまま
- 税: 表示層のみ TAX_RATE=0.10。小計（税抜）→消費税（10%・**切り捨て** Math.floor）→御見積金額（税込）。列ヘッダ・フォームラベルに「税抜」付記
- PDF: 製品セクション（1見積1行・単価×数量）＋初期費用セクション（項目別・INCLUDED 非表示＋脚注）＋税3段。原価・利益率・材料/工賃明細は非表示（型レベル遮断）
- MOQ 未入力は出力不可（UI disable＋400）。複製は手打ち2列リセット
- 検証済み実測: RE-2026-0001（手打ち 5,500/版代16,000）→ 566,000 / 56,600 / 622,600

## 4. ★次フェーズ＝初期費用再設計（フラグ方式）— 実装待ち
- **spec**: `docs/specs/qe1r-initial-cost-redesign-spec-confirmation-v0_1-2026-07-07.md`（18f25f6）
- **ブリーフ**: `docs/specs/qe1r-initial-cost-flag-implementation-brief-2026-07-07.md`（e745bd9）
- 核心: INITIAL_COST 区分廃止（2値運用）＋ `RoughEstimateItem.isSeparateBilling Boolean`。引き当ては既存2系統（PAST_PO/PAST_WO）流用で初期費用も引ける。引き当て元の INDIVIDUAL_BILLING / isPhysicalAsset からフラグ自動 ON（上書き可）
- migration 41本目（列純増＋ INITIAL_COST→LABOR+フラグON の決定的 UPDATE）。enum 値は残置
- 実装順: Part A（スキーマ）→B（置換23箇所/6ファイル）→C（フォーム UI）→D（自動連動）→E（費目マスター dev 追加＋検証）→ PR 1本
- 移行回帰基準: RE-2026-0001 の PDF が migration 前後で完全一致（566,000/56,600/622,600）
- 費目マスター: dev は Part E で追加（PLATE_FEE 版代/MOLD_FEE 型代/EMBROIDERY_PUNCH_FEE 刺繍パンチ代・OVERHEAD Lv2）。**本番はマージ後に慎太郎さんが原価費目画面から手動追加**
- 経緯の要点: 現行 INITIAL_COST は source=MANUAL 固定で引き当て不可。工賃区分で引き当てる回避操作をすると初期費用が1枚原価に混入（防衛線破り）→ 現行方式は実用しない（慎太郎さん確定）

## 5. DB状態
- dev（hopper.proxy.rlwy.net:12921）: RE-2026-0001 のみ（1件・検証データ後始末済み）。手打ち値入り（finalUnit 5,500・版代 presented 16,000・旧 finalPriceManualJpy 539,500 残置）。migration 40本目相当まで db push 済み
- 本番（shuttle.proxy.rlwy.net:16099）: migration 40本目適用済み。**RE 件数は未確認**（次フェーズのマージ前 A方式チェックで記録・ブリーフ §5）

## 6. 次セッションで最初にやること（優先順）
1. このメモで状態復元 → `git log origin/main -3`（先頭 e745bd9）確認
2. design-reread: spec v0.1（18f25f6）＋ブリーフ（e745bd9）を読み直し
3. 実装着手: `feat/qe1r-initial-cost-flag` を origin/main から新規作成 → Part A〜E（ブリーフどおり）。dev db push は UPDATE を流さないため既存1行へ手動 UPDATE 併用（ブリーフ §0-2）
4. PR open → マージ前 A方式チェック（本番 RE 件数・INITIAL_COST 行数記録・41本目未適用確認）→ マージは慎太郎さん → マージ後に本番の INITIAL_COST 行 0 件確認＋費目3件を慎太郎さんが本番追加
5. その後: ファイル整理（§7）

## 7. その他バックログ
- **ファイル整理（次セッション以降・慎太郎さん承認制）**: 最優先＝`docs/full_backup_20260529_104452.sql/.dump`（DB実データ・未追跡）を repo 外 `~/shunya-backups/` へ退避。`.env.backup*` 同様。run-*.sh 6本は要否判定、未追跡 spec md 約30本は git 管理版との重複整理、files 9〜12/・zip 類は inventory 後に個別判定。2026-07-07 調査で「未追跡のみ・追跡ファイル無変更」確認済み＝マージへの影響なし
- 引き当て検索の改善（status フィルタ・単価未定行の扱い）— 今回スコープ外とした宿題
- WorkOrder DRAFT 時の編集許可／PO 作成後にカルテ内へ留まる／PO 明細行の複製（色/サイズ違い）／入力UX全般
- enum 値 INITIAL_COST の物理削除（将来クリーンアップ）

## 8. 本日の教訓
- **実運用の初回タッチで構造問題が出る**: 道A完成直後の実操作で「引き当てできない・回避操作が防衛線を破る」が発覚。客向け成果物と同様、新機能は本番反映後すぐ実務操作で叩くのが正しい
- **house style への回帰が最良の解になることがある**: PoItem/WoItem は既に「行の性格＋売り立て区分」の二軸。RE だけ第3区分で不整合だった。新発明より既存作法との整合を先に疑う
- **ユーザー発案を spec の記録で検証する**: チェックボックス案に対し「過去に却下した記録があるか」を spec で確認→記録なし→実装段階の産物と判明。記憶で「決めたはず」と打ち返さない（design-reread の実践）
- 単価未定（unitPrice null）の WO/PO 明細は引き当て検索に出ない（仕様）。「出てこない」問い合わせ時はまず引き当て元の単価入力を確認
- dev の db push は migration.sql 内の UPDATE を実行しない。データ変換を含む migration は dev へ手動同文適用が必要

## 9. 本日マージした PR
- PR #97（squash `d944e99`）: QE-1R 見積書PDF・横断一覧・見積コピー＋道A（手打ち単価・2セクションPDF・消費税）。本番反映・migration 40本目適用・smoke 確認済み
