# BACKLOG.md（B-番号 運用台帳）

- 記述根拠: `docs/BACKLOG_EVIDENCE.md`（不変アーカイブ・git 履歴からの機械抽出）
- 本ファイルは **差分更新のみ**。全文上書きを禁止する。
- 更新してよいのは (1) 新規行の追加 (2) 状態欄の変更 (3) 取り下げの明記 の3種のみ。
- 既存の定義文は、誤りが確認された場合を除き書き換えない。
- 欠番 B-042 / B-068 / B-098 / B-100 は再採番禁止。
  （B-042 は「tx timeout は v1.2 PR に同梱済のため起票せず」と証跡に明記）

## 状態の語彙

| 語 | 意味 |
|---|---|
| 完了 | 証跡に完了・本番リリース・マージ済の明示あり |
| 進行中 | 証跡に一部完了と未了の両方の記述あり |
| 未着手 | **証跡に着手・完了の記述が無い**（着手していないことを確認した意味ではない） |
| 保留 | 証跡に保留・後回し・未判断の明示あり |
| 取り下げ | 証跡に取り下げの明示あり |
| 欠番 | B-042 / B-068 / B-098 / B-100。再採番禁止 |
| 移管 | 別プロジェクト・別系統へ移管済み。shunya-pms 本体の実装対象外 |
| 状態不明 | 証跡が断片的で上記のいずれとも判定できない |
| 定義不明・要確認 | 証跡から内容を特定できない |

## 台帳

| 番号 | 状態 | 一行定義 | 関連doc |
|---|---|---|---|
| B-001 | 未着手 | Supplier編集で適格請求書発行事業者OFF時のContractor誘導アラート | docs/phase1a-improvement-backlog.md |
| B-002 | 未着手 | Material詳細でarchivedカテゴリを視覚化 | docs/phase1a-improvement-backlog.md |
| B-003 | 未着手 | createMaterial/updateMaterialでcategoryIdを検証 | docs/phase1a-improvement-backlog.md |
| B-004 | 未着手 | MaterialCategoryFormのlevel toggle時のfetch race修正 | docs/phase1a-improvement-backlog.md |
| B-005 | 未着手 | migrationの既存行NOT NULLガード（汎用パターン） | docs/phase1a-improvement-backlog.md |
| B-006 | 完了 | Material UPDATE監査ログにcategoryIdを含める（PR #55） | docs/specs/b-006-b-010-implementation-brief-2026-06-02.md |
| B-007 | 完了 | カテゴリ階層/コードサジェスト等の共通化（Phase 1A-17で回収・PR #43） | docs/phase1a-improvement-backlog.md |
| B-008 | 未着手 | updateMaterialCategoryのparent findFirst重複呼び出し最適化 | docs/phase1a-improvement-backlog.md |
| B-009 | 完了 | Prisma $transactionタイムアウトのbulk向け運用ルール（PR #34） | docs/phase1a-improvement-backlog.md |
| B-010 | 完了 | シードスクリプトのAuditLog記録（棚卸し・改善・PR #56） | docs/specs/b-006-b-010-implementation-brief-2026-06-02.md |
| B-011 | 完了 | dev環境（非本番DB）の構築（案Zで実現） | docs/phase1a-improvement-backlog.md |
| B-012 | 完了 | 本番DBサービス名のリネーム（案Zで実現） | docs/phase1a-improvement-backlog.md |
| B-013 | 完了 | shunya-pms-webのDATABASE_URLを変数参照型に移行（案Zで実現） | docs/phase1a-improvement-backlog.md |
| B-014 | 未着手 | Prisma 6.19.3→7.8.0メジャーアップグレード検討 | — |
| B-015 | 未着手 | Material UPDATE監査スナップショットの残漏れ補完（価格系含む） | docs/specs/b-015-implementation-brief-2026-06-03.md |
| B-016 | 未着手 | Colorマスター拡張（PANTONE/DIC等の体系・番号・色名を手入力保持） | — |
| B-017 | 未着手 | 参照データ系seed（HsCode/FtaRule/用語集）の監査ログ方針検討 | — |
| B-018 | 未着手 | 品番紐付けの出荷・貸出伝票発行ページ（先上げ/スワッチ/貸出） | — |
| B-019 | 保留 | CSVインポート/エクスポート機能（業務トランザクション側が本命・後回し） | docs/phase1a-14-csv-import-export-plan.md |
| B-020 | 未着手 | quality-label-app（品質表示メーカー）のshunya-pms統合 | — |
| B-021 | 未着手 | 全マスター監査スナップショットの網羅強制（型保険） | — |
| B-022 | 未着手 | 外部パートナー（工場/仕入先/パタンナー）開放・権限制御 | — |
| B-023 | 未着手 | 版類（型・版・パターン・刺繍パンチ）の在庫管理・再利用判定 | — |
| B-024 | 未着手 | 自社ブランドの生地・付属・織りネーム在庫（消費型/在庫型の区別） | — |
| B-025 | 未着手 | 量産パターン管理（型・版・品番の3層／リピート導線） | — |
| B-026 | 進行中 | シーズンのプルダウン化＋年/シーズン重複解消（検索フィルタ残） | — |
| B-027 | 完了 | 品番カルテの絵型（服のスケッチ）画像アップロード（PR #86/#87） | docs/specs/b-027-product-sketch-spec-confirmation-v1_1-2026-06-16.md |
| B-028 | 未着手 | 品番カルテ一覧にカテゴリ検索を追加 | — |
| B-029 | 未着手 | サンプル材料セクション | — |
| B-030 | 未着手 | 数量モデルの整理（SKU確定後） | — |
| B-031 | 未着手 | 本番/dev手動投入のズレリスク記録（seed実行忘れで本番0件） | — |
| B-032 | 未着手 | ProductCategory標準シードをseed.tsに追加 | — |
| B-033 | 完了 | devドリフト解消（currency-prices完全破棄・クローズ） | — |
| B-034 | 未着手 | FactoryProcessingType中間テーブル（対応可能工場マスター） | — |
| B-035 | 未着手 | WorkOrder.samplProductionIdの綴りミス修正（sampleProductionIdへ） | — |
| B-036 | 未着手 | 案件タイプ別のタスク生成テンプレート出し分け | — |
| B-037 | 未着手 | docs直下の未追跡ファイル整理（誤生成・一時物の仕分け） | — |
| B-038 | 未着手 | 見積→量産マスター化→候補提示（単価を標準候補に育てる） | — |
| B-039 | 未着手 | 規格・サイズの構造化（数値化・用尺計算・輸出） | — |
| B-040 | 未着手 | ファスナーの軸分解（スライダー/エレメント/テープ/長さ/仕様） | — |
| B-041 | 未着手 | 製品サイズ展開（S/M/L）をProduct側で扱う（B-030と統合検討） | — |
| B-042 | 欠番 | 欠番（tx timeoutはv1.2 PRに同梱済のため起票せず） | — |
| B-043 | 未着手 | マルチペルソナ・ビュー構想（立場別ビュー） | — |
| B-044 | 未着手 | 事業構想（小規模アパレル向けサブスク・OEM/自社分岐・オーナー指標） | — |
| B-045 | 未着手 | dev DBバックアップ/復元の自動化（seedで1コマンド復旧） | — |
| B-046 | 未着手 | 自然言語発注（AI提案エンジンの入口） | — |
| B-047 | 未着手 | CAD連携の用尺見込み計算（東レCAD等・source=CAD予約済） | — |
| B-048 | 進行中 | PO採番リトライのP2002限定化＋横断適用（WO適用済/PO未対応） | — |
| B-049 | 未着手 | 発注書の送付フロー（email/fax・送付記録の運用化） | docs/specs/s-4c-2-order-pdf-spec-confirmation-v1_0-2026-06-11.md |
| B-050 | 未着手 | 加工費の専用集計列（totalProcessingCost）の追加 | — |
| B-051 | 未着手 | 非JPY伝票のJPY換算集計（exchangeRateAtOrder/subtotalJpy） | — |
| B-052 | 未着手 | 量産見積・原反取り切り計算（見積エンジン中核・QE-1本体） | docs/specs/qe-1-spec-confirmation-v1_0-2026-06-30.md |
| B-053 | 完了 | 発注書PDFのGCS保存統合（バケット/SA/環境変数・PR #76） | docs/specs/s-4c-2-order-pdf-spec-confirmation-v1_0-2026-06-11.md |
| B-054 | 未着手 | 縫製仕様書の帳票出力（実Excel構造が原本・最終フェーズ） | docs/specs/s-4c-2-order-pdf-spec-confirmation-v1_0-2026-06-11.md |
| B-055 | 完了 | DL名とGCS控えのタイムスタンプ同一化（突合可能に・JST・PR #77） | — |
| B-056 | 未着手 | マーキング図PDF/パターンデータのAI自動読み取り | — |
| B-057 | 未着手 | 資材表→PO下書き生成（BOM→PO・量産方向） | — |
| B-058 | 完了 | PO→BOM取り込み（QE-0d・コスト引き当て・PR #81） | docs/specs/qe-0d-po-bom-cost-linkage-spec-confirmation-v1_0-2026-06-13.md |
| B-059 | 未着手 | 品番カルテの量産転記（サンプル→量産複製・BOM引き継ぎ） | — |
| B-060 | 未着手 | SPタイトルの表示/必須化（QE-0e小タスク・方針①） | — |
| B-061 | 取り下げ | BOM⇔SP紐付け（C案・不要と判断しクローズ） | — |
| B-062 | 完了 | 付属マトリクスβ（カラーウェイ×資材色・色二層モデル・PR #83/#84） | docs/specs/product-overview-one-page-spec-confirmation-v0_4-2026-06-15.md |
| B-063 | 進行中 | 色名解決トラック（カラーウェイ⇔色紐付け・colorNameEn・Sku色FK化） | — |
| B-064 | 完了 | 数量マトリクス表示（Sku色×サイズ描画・空状態UI・PR #82） | docs/specs/product-overview-one-page-spec-addendum-v0_3-2026-06-15.md |
| B-065 | 保留 | 発注引き当て時のC/#自動反映（PR #94→(B)に吸収・クローズ） | docs/specs/b-065-po-import-colorway-spec-confirmation-v1_0-2026-06-23.md |
| B-066 | 完了 | 柄マスター（TextilePattern層2・patternId配線・PR #88/#89） | docs/specs/b-066-textile-pattern-master-spec-confirmation-v1_1-2026-06-17.md |
| B-067 | 進行中 | 数量→用尺→PO連動（生産発注の前方向・D4アはPR #93） | docs/specs/b-067-quantity-usage-po-spec-confirmation-v1_0-2026-06-23.md |
| B-068 | 欠番 | 欠番。再採番禁止 | — |
| B-069 | 未着手 | PO↔品番の解決一本化（発注にカラーウェイ/品番を構造保持） | — |
| B-070 | 移管 | 専用プロジェクト「shunya-請求書インテーク(B-070)」へ移管済み。本体の実装対象外（慎太郎さん確認 2026-08-09・証跡外） | — |
| B-071 | 完了 | WoItem/PoItem行通貨保存修正（T-0・PR #102） | — |
| B-072 | 未着手 | BOMフォームの行通貨UI欠如（常にJPY既定）の解消 | — |
| B-073 | 未着手 | PO実額の品番按分（PoAllocation実装・当面手動） | — |
| B-074 | 未着手 | 量産WO明細数量とSKU量産数の整合チェック常時化 | — |
| B-075 | 未着手 | rollLength「乱」（不定長）対応 | — |
| B-076 | 未着手 | 通貨ソースのWO単位化の要否検討 | — |
| B-077 | 未着手 | 初期費用の1枚単価インクルーズ切替（INCLUDEDモードUI） | — |
| B-078 | 完了 | 野良伝票禁止validator（productId必須）＋ナビ改善（PR #103/#104） | — |
| B-079 | 完了 | WO編集画面（/work-orders/[id]/edit・DRAFT編集・PR #105） | — |
| B-080 | 完了 | PE明細行のマスターピッカー＋Select検索対応（PR #111） | — |
| B-081 | 完了 | サイドバー並び順変更（案件→取引→マスター・PR #110） | — |
| B-082 | 未着手 | 品番一覧サムネ拡大(a)/絵型メイン+サムネ方式(b) | — |
| B-083 | 完了 | 明細行の調達区分procurementRoute（会社手配/支給等・PR #112） | — |
| B-084 | 未着手 | PE明細行のドラッグ&ドロップ並び替え | — |
| B-085 | 完了 | 量産見積 見積書PDF出力（PR #108） | docs/specs/b-085-pe-quotation-pdf-spec-confirmation-v0_1-2026-07-20.md |
| B-086 | 完了 | PDFプレビュー統一（全ページプレビュー→承認後DL・PR #122） | docs/specs/b-086-pdf-preview-spec-confirmation-v1_0-2026-08-05.md |
| B-087 | 未着手 | BOM素材SelectのSearchableSelect化 | — |
| B-088 | 進行中 | チェックボックスのクリック範囲修正（PR #114・マージ待ち） | — |
| B-089 | 未着手 | PO/WO update actionのDRAFTガード（直リクエスト対策） | — |
| B-090 | 未着手 | カルテ一覧の2段表示化（1段目絵型大/2段目情報） | — |
| B-091 | 未着手 | ピクトグラム/アイコンでの視認性向上（DRAFT/量産/PO/WO等） | — |
| B-092 | 未着手 | サイドバー自動折りたたみ（アイコン帯・ホバー展開） | — |
| B-093 | 未着手 | モバイル対応（レスポンシブ） | — |
| B-094 | 完了 | 縫製指示（Product Json列・固定5＋縫製指示6項目・PR #117） | docs/specs/b-094-sewing-instruction-spec-confirmation-v1_0-2026-08-01.md |
| B-095 | 完了 | グローバル検索（1窓統合・カテゴリ別結果・PR #116） | — |
| B-096 | 未着手 | 進行表ボード（品番×工程マトリクス・spec設計済/実装未着手） | docs/specs/b-101-b-096-production-progress-spec-confirmation-v1_0-2026-08-03.md |
| B-097 | 未着手 | SHADOW_DATABASE_URL未設定の整備（shadow DB） | — |
| B-098 | 欠番 | 欠番。再採番禁止 | — |
| B-099 | 完了 | サンプル製作ラウンドの文言整理（PR #118） | — |
| B-100 | 欠番 | 欠番。再採番禁止 | — |
| B-101 | 完了 | 量産進行（品番カルテの「進行」セクション・PR #119〜#121） | docs/specs/b-101-b-096-production-progress-spec-confirmation-v1_0-2026-08-03.md |
| B-102 | 未着手 | リピート系譜（ProductRepetitionLineage・コピー機能） | — |
| B-103 | 未着手 | 受け渡し記録（現物の移動ログ） | — |
| B-104 | 未着手 | サンプル側DONE判定を工程完了基準に揃える（P16適用） | — |
| B-105 | 未着手 | 量産見積の加工費目→加工行の自動生成（費目↔加工種別対応表） | — |
| B-106 | 未着手 | 納品書の存在による進行タスク自動算出（伝票リンク列） | — |
| B-107 | 未着手 | 一覧のソート機能（PO/WO/見積など横断） | — |
| B-108 | 進行中 | サンプル納品書（PR1完了・PR2引き当て/PR3 PDF残） | docs/specs/b-108-sample-delivery-note-spec-confirmation-v1_0-2026-08-05.md |
| B-109 | 未着手 | 合計請求書（インボイス制度・月次締め） | — |
| B-110 | 未着手 | 輸出インボイス（Commercial Invoice/Packing List） | — |
| B-111 | 未着手 | 複数品番で共用する見本の按分（PoAllocation系） | — |
| B-112 | 取り下げ | DeliveryDestinationのBuyer必須緩和（Client.shippingで代替） | — |
| B-113 | 未着手 | 納品書の受領確認（RECEIVED/受領サイン） | — |
| B-114 | 未着手 | 量産納品書（SKU×サイズ・skuId必須はアプリ側担保） | — |
| B-115 | 未着手 | 旧方式GCS控えの棚卸し・掃除（不可逆のため慎重） | — |
| B-116 | 未着手 | PO/WO一覧からの複数選択→まとめて1PDF | — |
| B-117 | 完了 | PDF控えstampの突合修正（B-055回復・PR #123） | — |
| B-118 | 未着手 | Windows Chromeでフォーカス時に最下部スクロール（再発監視） | docs/b-118-windows-chrome-focus-scroll-watch-2026-08-07.md |
| B-119 | 未着手 | PO/WO 画面の可読性改善（品番非表示の解消＋明細行の区切りが判別しづらい問題） | — |
| B-120 | 未着手 | 発注明細の入力済み行の複製（行コピー） | — |
| B-121 | 取り下げ | 納品書の品番必須緩和（DROP NOT NULL・実在ブランド品番方針で不要） | — |
| B-122 | 未着手 | 納品書明細の品番ピッカー改善（SearchableSelect化） | — |
| B-123 | 未着手 | 締め処理（期間ロック・B-109と同時設計） | docs/b-123-period-close-lock-design-note-2026-08-08.md |
| B-124 | 保留 | 明細idの不安定性（伝票編集で全削除→再作成）記録・是正未判断 | docs/b-124-order-item-id-instability-note-2026-08-08.md |
| B-126 | 未着手 | 品番の物理削除ガードが Sku/CollectionProduct しか数えず、発注・サンプル・納品書が紐づく品番を削除できる（参照内訳の可視化） | — |
| B-127 | 未着手 | サンプル製作にサイズ・カラーの明細テーブルを追加（ラウンド横断のサイズ展開把握・量産への引き当て基盤） | — |
| B-128 | 未着手 | 発注明細の売り立て区分が未設定の行を警告表示（必須化はしない・null は正当な状態のため） | — |
| B-129 | 未着手 | React Compiler の set-state-in-effect エラー 11件（25ファイル・既存 baseline） | — |

---

### B-126〜B-129 の補足（2026-08-09 実測）

#### B-126: 品番の物理削除ガードの網が狭い

`checkProductUsage`（`src/lib/actions/products.ts:1010`）が数える参照は
**`Sku` と `CollectionProduct` の2モデルのみ**。`deleteProductPermanently`
（同 1049）のガード4 と UI の `canDelete` がこの `totalRefs === 0` に依存する。

一方 `productId` / `primaryProductId` を持つモデルは schema 上30箇所以上あり、
`WorkOrder` / `PurchaseOrder` / `SampleProduction` / `DeliveryNoteItem` / `Bom` /
見積類は **scalar FK（`@relation` なし・house style）** のため Cascade もかからず
参照カウントにも入らない。結果、**発注もサンプルも紐づく品番が「参照なし」と
表示され削除できる**。

dev で実害が発生済み: 削除済み品番 `7671eb90` を WO-2026-0002 /
PO-2026-0001 / PO-2026-0002 / SP-2026-0001〜0003 / SP-VERIFY-S4C1 が参照していた。

**方針（慎太郎さん確定 2026-08-09）: 全部を拒否にはしない。**
- 拒否対象: SKU・コレクション等の直接的な子（現行どおり）
- **警告対象**: 発注 PO/WO・サンプル製作・納品書明細・BOM・見積類
  → 件数の内訳を見せ、削除を躊躇する材料にする（判断は人）

権限ガード（MASTER_ADMIN のみ）は既に実装済みのため現行維持。

#### B-127: サンプル製作にサイズ・カラーの明細テーブル

実務の流れ（慎太郎さん 2026-08-09）:
- 1st の時点ではサイズ展開が未定。作った後に「M だった」と遡って確定する
- 2nd でグレーディングしてサイズ展開が確定し、S・L を作る（M は 1st 済み）
- **1つの SP で複数サイズ・カラーを同時に作る**
- サイズ展開は**ラウンドを横断して**完成する（1st の M ＋ 2nd の S/L）

現状 `SampleProduction` / `SampleRevision` に sku / color / size 列は無く
（2026-08-09 recon 確認）、samples 配下の UI も SKU を参照していない。
`Sku` は `colorwayId` NOT NULL ＋ `size` NOT NULL のため、色もサイズも未定の
1st 時点では紐づける先が存在しない。

要件の骨子:
1. `SampleProduction` の子テーブルを新設（色・サイズ・数量）
2. すべて後から確定可能（1st 作成時は空でよい）
3. `sampleQuantity` との整合をどう取るか要検討
4. 品番カルテでラウンド横断のサイズ展開一覧を表示（未作成サイズが分かる）
5. 量産への引き当て基盤とする（用途の具体化が必要）

★設計前に必ず確認: `ProductColorway` / `Sku` / `Material.availableColors` との
関係（色情報の重複を作らない）、QE-1 がサンプルの何を参照しているか、
B-114（量産納品書・SKU×サイズ）との境界。

#### B-128: 売り立て区分が未設定の行の警告

`billingClassification` は nullable（`nativeEnum().nullable().optional()`）で、
dev では null が WO 10件 / PO 17件。**null は正当な状態**である
（生地・付属の仕入は「売り立てるか単価に含めるか」の分類自体が当てはまらない）。

したがって**必須化はしない**。必須にすると分類が当てはまらない行に
嘘の値を入れさせることになり、B-108 §⑥ の候補判定が汚れる。

代わりに B-108 §⑤ と同じ形で「売り立て区分が未設定の発注明細（N件）」を
警告として表示し、拾い漏れに気づける形にする。

#### B-129: lint baseline

`npm run lint` の 11 errors はすべて
`Calling setState synchronously within an effect can trigger cascading renders`
（React Compiler の eslint ルール）。対象は brands / clients / colors / factories /
products / bom-section 等の25ファイル。

2026-08-09 時点で `docs/BACKLOG.md` に該当記載が無いことを grep で確認済み。
以後の PR では**この 11 を baseline とし、超過した場合のみ停止**の運用とする。

## 別表: チャット由来（repo 証跡なし）

以下は慎太郎さんとの会話で合意されたが、`SESSION_HANDOVER.md` にも
`docs/` 配下にも記録されず、`BACKLOG_EVIDENCE.md` の機械抽出に
一切現れなかった項目。**記述根拠は証跡ではなく慎太郎さんの直接確認**であり、
本表とは出所が異なるため分離して管理する。

以後、チャットで合意した要件は必ず B-番号を振り、本表に起票すること。
番号を振らずに会話だけで終えると、この表に落ちる（＝失われかける）。

| 番号 | 状態 | 一行定義 | 根拠 |
|---|---|---|---|
| B-125 | 未着手 | Material マスターに仕入先の参考サイト URL を保持し、生地/ボタン/ファスナー/付属のカテゴリ別に整理して表示する | 慎太郎さん確認 2026-08-09 |

### B-125 の補足（慎太郎さん確認 2026-08-09）

目的は **現物の見本帳が手元になくてもオンラインで資料が揃う状態**にすること。
生地メーカー・ボタンメーカー・YKK 等のファスナーメーカーの参照先リンクを
素材に紐づけて明記する。

- フラットな URL 一覧ではなく、**カテゴリ別（生地/ボタン/ファスナー/付属）に
  整理した表示**であることが要件の核。
- 本要件は 2026-08-09 の台帳作成時に、証跡に存在しないことが判明して回収された。
  それ以前に repo へ記録された形跡はない。

#### 着手時のスキーマ現況（2026-08-09 recon・read-only）

- `Material` には画像 URL 列（`imageUrl` / `swatchImageUrl`）は存在するが、
  **仕入先の参考サイト URL を保持する列は未実装**。用途が異なるため流用不可。
- `Supplier.website`（`String? @db.VarChar(500)`・仕入先の自社サイト）は既存。
  ただし B-125 は「素材に紐づけてカテゴリ別に整理」であり粒度が異なる。
- → **新規の列追加が必要**。`Supplier.website` の流用可否は設計時に判断する。
