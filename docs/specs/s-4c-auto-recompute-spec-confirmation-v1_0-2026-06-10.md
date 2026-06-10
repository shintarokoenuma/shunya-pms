# 仕様確認議事録 — S-4c 自動算出・コスト集計・発注書（v1.0 確定版）

- 作成日: 2026-06-10 / Claude.ai
- 作成者: 慎太郎さん + Claude
- バージョン: v1.0（確定・S-4c-1 実装着手可能）
- 位置づけ: S-4 の最終段。S-4b-1（PO・PR #64）/ S-4b-2（WO・PR #69）で「起票して結ぶ」が完成した上に、
  伝票駆動の自動算出（recomputeTaskStatus）とコスト集計、発注書 PDF を載せる。
- 上位仕様: docs/specs/s-4-order-linkage-spec-confirmation-v1_0-2026-06-08.md（D1〜D6 + 不変条件）
- 運用検証の前提: 本仕様は dev で実際に触った感触を見て v1.1 で調整する前提の仮確定。
  全項目 migration なし・コードのみのため、調整コストは低い。

## 0. 確定済みの継承事項（D系・再掲）
- AUTO_FROM_DOC 対象 = PATTERN / FABRIC / TRIM / SEWING / PROCESSING / BODY の6種（D1）。
  QUOTE / SPEC_LOCK / INSPECTION / CLIENT_REVIEW は MANUAL 据え置き。
- 不変条件: SKIPPED は終端。recomputeTaskStatus は SKIPPED を絶対に上書きしない。
- 集計先: SampleProduction.totalPatternCost / totalMaterialCost / totalSewingCost /
  totalRevisionCost / totalCost（schema 既存・migration 不要）。

## 1. 確定事項 G1〜G5

### G1. 自動算出ルール = 前進のみ（forward-only）（✓ 確定）
- 紐づく live 伝票（deletedAt: null）が1本以上 → タスクが NOT_STARTED なら IN_PROGRESS に引き上げ。
  既に進んでいるタスクは触らない。
- FABRIC / TRIM / BODY の完了は isReceived（入荷済み手動チェック）が正。伝票ステータスでは完了にしない
  （発注済み≠入荷済み）。
- PATTERN / SEWING / PROCESSING は、紐づく live WO が全て COMPLETED になったらタスクを DONE に引き上げ。
- 伝票が削除されてもタスクは自動で戻さない（戻すのは人）。自動処理は人の判断を巻き戻さない。
- SKIPPED は無条件で不触。手動 DONE も降格しない。

### G2. evidenceMode（✓ 確定）
- generateTasksForRound での生成時、6種のタスクは evidenceMode=AUTO_FROM_DOC を設定。
- recomputeTaskStatus は evidenceMode=AUTO_FROM_DOC のタスクのみ対象。
- 既存タスク（dev ダミー・本番 test 残置）は少数のため、移行方法（recompute 側で taskType 判定に
  フォールバック or 1回限りの UPDATE）は実装時に選択し報告。
- MANUAL の手動ステータス操作 UI は temporal に残す（forward-only のため共存可能）。

### G3. コスト集計マッピング（✓ 確定）
| 集計列 | 集計元 |
|---|---|
| totalMaterialCost | SP に紐づく PO 明細 subtotal 合計（生地・付属・ボディ・版すべて） |
| totalPatternCost | WO のうち workCategory = PATTERN / GRADING の明細合計 |
| totalSewingCost | WO のうち workCategory = SAMPLE の明細合計（縫製＋加工＝サンプル製作作業費） |
| totalRevisionCost | WO のうち workCategory = REWORK の明細合計 |
| totalCost | 上記の総和 |
- 加工費は totalSewingCost に合算（専用列の追加は migration を伴うため見送り → B-050）。
  加工費の単独把握は明細の費目（costCategoryId）で可能。
- 金額未定（subtotal=null）の明細は 0 扱い（集計から除外）。
- 非 JPY 伝票は当面集計対象外（JPY 換算未実装 → B-051）。

### G4. 集計タイミング（✓ 確定)
- PO / WO の create / update / soft-delete 時に、紐づく SP の集計列をその場で再計算して保存
  （denormalized）。G1 の recompute と同一トリガーに同居。

### G5. S-4c の2分割（✓ 確定）
| 段階 | 内容 | migration |
|---|---|---|
| S-4c-1 | recomputeTaskStatus（G1/G2）＋コスト集計（G3/G4）＋ SP 詳細へのコスト表示 | なし |
| S-4c-2 | 発注書 PDF 生成・ダウンロード（PO/WO 詳細から。1 PO=1発注先=1枚） | なし見込み |
- 送付（email/fax）フローは S-4c-2 にも含めず後続（B-049）。

## 2. 本書で起票したバックログ
- B-049: 発注書の送付フロー（email/fax・送付記録 sentAt/sentMethod の運用化）。S-4c-2 の後続。
- B-050: 加工費の専用集計列（totalProcessingCost）。量産フェーズで単独把握の要望が出たら migration 込みで。
- B-051: 非 JPY 伝票の JPY 換算集計（exchangeRateAtOrder / subtotalJpy の運用化）。海外発注の実運用開始時。

## 3. 検証データ
- dev の検証用 WO（[S4B2-VERIFY] 3件）・SP-2026-0001・タスク群は掃除せず S-4c-1 の検証に再利用する。

## 改訂履歴
| 日付 | バージョン | 内容 | 担当 |
|---|---|---|---|
| 2026-06-10 | v1.0 | S-4c 確定。G1〜G5（forward-only・evidenceMode・集計マッピング・同一トリガー・2分割）。B-049〜B-051 起票 | 慎太郎さん + Claude |
