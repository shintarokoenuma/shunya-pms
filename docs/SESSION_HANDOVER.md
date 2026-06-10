# 引き継ぎメモ (2026-06-09 セッション / ProcessingType 大分類化 完了・本番反映 a1f9f90 → 次は S-4b-2 WO系)

## ⓪ 最重要・プロジェクト棲み分けルール（毎回必須）
- shunya-pms（リポジトリ shintarokoenuma/shunya-pms・ローカル ~/shunya-production-system・本番 shunya-pms-web-production.up.railway.app）と saagara-v2（別リポジトリ・本番 saagara-v2-production.up.railway.app）は完全に別物。
- VS Code の Claude Code 別ウィンドウで両者を混同した過去あり。実装指示書には毎回冒頭に【対象プロジェクト】ヘッダを固定。貼る前に ~/shunya-production-system を開いているか目視確認。
- ローカルのフォルダ名は `shunya-production-system` だが git remote = shunya-pms.git で正しい（混同しないこと）。
- docs/CLAUDE.md は別プロジェクト（shunya-ivr）の混入ファイル。shunya-pms の作業では無視（ルート AGENTS.md と docs/shunya-master-patterns.md が正）。B-037 で整理予定。

## ⓪-2 PR URL 3点セット運用（shunya-pr-url-checklist スキル）
- ① マージ前の UI 確認 = ローカル（npm run dev → http://localhost:3000 / dev DB hopper:12921）
- ② マージ操作 = GitHub PR URL → マージ = Railway main 自動デプロイ = 本番反映（不可逆）
- ③ マージ後の本番確認 = 本番 URL（https://shunya-pms-web-production.up.railway.app / 本番 DB shuttle:16099）+ Railway デプロイログ目視

## ⓪-3 DB マイグレーション運用（二系統・重要）
- **dev（hopper:12921 = postgres-development）= `prisma db push` 運用**。`_prisma_migrations` テーブルは存在しない（migration 履歴非管理）。`prisma migrate dev` は打たない（履歴空のため全 migration 再適用→DB リセット提案＝データ消失の恐れ）。dev へのスキーマ反映は `db push`、検証は `prisma migrate diff --from-url <dev> --to-schema-datamodel schema --script` が empty であること。
- **本番（shuttle:16099 = postgres-production / 旧称 postgres-ab6d）= Railway の `prisma migrate deploy` 自動実行**（package.json の start に `prisma migrate deploy &&` / Railpack 検出）。migration ファイルをマージすれば本番に適用される。
- migration ファイルは「本番用の正」。dev は db push で先行同期しているため、migration ファイルは本番のためだけに手作成/生成することがある。

## ① 直近の完了マイルストーン（本セッション = 2026-06-09）
### 実装ブリーフ① ProcessingType 大分類化（PR #65 → merged c4fe8ba）
- 加工分類を2階層化: **大分類 = WorkOrderType enum（既存14値・追加なし）/ 小分類 = ProcessingType マスター（name）**。
- ProcessingType に **`workType WorkOrderType`（NOT NULL）+ `@@index([companyId, workType])`** を追加。WO 起票時に `processingType.workType` をコピーする土台（アプリ層のマッピング表が不要に）。
- ★大分類「洗い・加工」: enum 値は **WASHING のまま**、日本語ラベルのみ「洗い」→「**洗い・加工**」に変更（中黒・enum 追加なし）。加工工場で洗いまで一括処理する運用実態。FINISHING(仕上げ)は別大分類で据え置き。
- 新設 `src/lib/constants/work-order-types.ts`（全14値ラベル網羅 `WORK_ORDER_TYPE_LABELS` + `WORK_ORDER_TYPE_OPTIONS`・WASHING="洗い・加工"）。PR②(WO本体)でも再利用。
- validator/actions/UI（フォーム大分類 select 必須・一覧大分類列・検索フィルタ・詳細/編集）を workType 対応。
- migration 2本（本番 migrate deploy で適用・適用順 6/8→6/9）:
  - `20260608231551_s4b2_wo_item_nullable_price`（wo_items.unit_price/subtotal DROP NOT NULL・非破壊。S-4b-2 の前倒し分を out-of-order 回避のため本PRに同梱）
  - `20260609065916_add_processing_type_work_type`（ADD COLUMN work_type NOT NULL + CREATE INDEX・既存 enum 参照のみ＝CREATE TYPE なし。dev/本番とも0件のため NOT NULL 直接追加）
- 小分類10件を dev に投入（PRC-001〜010）。
### 本番 seed 整備（PR #66 → merged a1f9f90）
- ProcessingType シードを既存 colors/cost-categories/textile-pattern-types と同じ **core/dev/prod 2層 + 三重ガード**に整備:
  - `scripts/seeds/processing-types-core.ts`（共通ロジック・MASTER_ADMIN 動的解決・PRC採番再現・冪等 companyId+name・AuditLog 記録・$transaction timeout120s）
  - `scripts/seed-processing-types.ts`（dev エントリ・本番ホストなら abort）
  - `scripts/seed-processing-types-prod.ts`（本番エントリ・三重ガード: CONFIRM_PROD_SEED=PROCESSING_TYPE_10 / shuttle:16099 必須 / 対話 yes）
  - 旧 `prisma/seeds/processing-types-seed.ts` は削除（ロジックを core へ移植・重複排除）。

## ①-2 本セッションの dev 消失と復旧（重要・教訓）
- 作業中に dev(hopper:12921) が **全テーブル 0 件の空 DB** になっていることを発見（companies/users 含む全消失・`_prisma_migrations` も無し）。2026-06-08 引き継ぎ時点（processing_types=2 / progress_tasks=10 / Product 2件）から消失。原因は dev Postgres の再プロビジョニング/リセットと推定（スキーマは db push 済みで最新・データのみ消失）。本番(shuttle:16099)は無傷。
- 復旧: `npx tsx prisma/seed.ts`（冪等 upsert）で **company `shunya-master-tenant-id`（shunya/MASTER_ADMIN）+ owner user `shin@shunya.jp`（PW: shunya2026!・bcrypt）** ほか（業界用語5/HSコード5/FTAルール3）を再投入 → dev ログイン可能に。続けて小分類10件を投入。
- **未復元**: progress_tasks / Product / テスト PO（PO-2026-0001）は seed.ts に無い手動投入データのため復元されていない。S-4b-2 着手時に進行チェックリスト検証データ（progress_tasks）の再投入が別途必要。

## ② dev / 本番 DB の状態
- dev（hopper:12921）: db push で最新スキーマ。**companies=1 / users=1（shin@shunya.jp）/ processing_types=10（PRC-001〜010・大分類付き）/ progress_tasks=0 / products=0**。`_prisma_migrations` 無し（⓪-3 参照）。
- 本番（shuttle:16099 / postgres-production）: PR #65 マージ済み。**migration 2本（wo_item_nullable / add_processing_type_work_type）が Railway 自動 deploy で適用済みのはず → デプロイログで「migrations applied」を目視確認すること**。**本番 processing_types = 10件 投入済み**（PRC-001〜010・`scripts/seed-processing-types-prod.ts` を host shuttle:16099 目視のうえ対話 yes で実行・created=10/skip=0/total=10 確認済み）。品番カルテ1件（IP-26AW-M-BT-001 / test 残置）。本番PWはローテ済（ローカルから本番DB直接接続は不可・本番投入はURL一時指定）。

## ③ 次セッションで最初にやること（優先順）
- ★本番への小分類10件投入は本セッションで完了済み（再投入不要・②参照）。
1. main 最新化（git pull origin main）。`git log origin/main --oneline -8`（先頭 a1f9f90 のはず）。
2. **S-4b-2（WO 系）の実装ブリーフ作成 → Claude Code 実装**。仕様は s-4b-order-creation-spec-confirmation-v1_0 §4 を出発点。
   - WorkOrder + WoItem の採番(WO-{年}-{4桁}・保存時確定)・CRUD actions(list/get/create/update/soft-delete)・最小フォーム。$transaction に {timeout:15000}。
   - 起点=進行チェックリストの PATTERN/SEWING/PROCESSING タスク行「発注を作成」(現在「S-4b-2 で実装予定」で非活性)を活性化→ progressTaskId/processingTypeId 紐付け。
   - **PROCESSING タスク起票時は processingType.workType を WorkOrder.workType にコピー**（本セッションで作った大分類土台を使う。マッピング表は不要）。processingTypeId も WO に引き継ぐ(S-4a 受け皿)。
   - 発注先: PATTERN→contractor(パタンナー) / SEWING→factory / PROCESSING→factory or contractor。刺繍(D社=factory登録)も WO 側。
   - factories.ts/contractors.ts の workOrderCount を実値化(E8)。
   - WoItem の実務化(PO で入れた supplierItemCode/designCode/colorCode/sizeValue/sizeUnit/specification 相当)が要るか着手時に判断。要るなら migration（WoItem は現状これらを持たない＝PoItem と違い未拡張。schema 真値 grep 必須）。**※ wo_items.unit_price/subtotal の DROP NOT NULL は本セッションで PR #65 に同梱済み＝S-4b-2 では再実施しないこと**。
   - 進行チェックリスト検証データ(progress_tasks)が dev で 0 件なので、検証前に再投入が必要。
   - 既存 patternWoId/sewingWoId（SampleProduction）は別系統として温存。S-4 の正は progressTaskId 経由。
3. その後 S-4c（自動算出 recomputeTaskStatus + 発注書ボタン本実装 + コスト集計）。

## ④ 実装シーケンス（更新）
- S-1〜S-3a・S-3（完了）→ S-4a（完了・本番反映）→ S-4b-1（PO系・完了・本番反映）→ **ProcessingType 大分類化（完了・本番反映 #65/#66）** → **S-4b-2（WO系・次）** → S-4c（自動算出/発注書/集計）。

## ⑤ バックログ（本セッション起票・更新）
- B-045: dev DB バックアップ/復元の自動化。dev が再リセットされても seed.ts + 各 seed-*.ts（dev エントリ）で1コマンド復旧できるよう手順を集約（progress_tasks/Product 等の検証データ seed も含めるか検討）。今回 dev 全消失で手復旧した教訓。優先度: 中。
- B-031（本番/dev手動投入ズレリスク記録）と関連: 本番マスター投入はマージとは別オペ（seed-prod 実行）で、忘れると本番だけ0件になりやすい（一般リスク）。※今回の processing_types は本セッションで本番投入済み。マージ後 seed のチェックリスト化を検討。

## ⑥ 既存バックログ（継続・未着手）
- B-016 Color拡張(PANTONE/DIC) / B-017 参照データ監査方針 / B-018 出荷・貸出伝票 / B-019 CSVインポート / B-020 quality-label-app統合(自社ブランド向けで Shopify 連動と一体) / B-021 全マスター監査網羅 / B-022 外部パートナー開放 / B-023 版類在庫(現物資産・再利用判定UI。S-4a で受け皿=PoItem.isPhysicalAsset/保管期限は投入済み) / B-024 自社ブランド在庫(OEM=消費型/自社ブランド=在庫型) / B-025 量産パターン管理 / B-026 シーズンプルダウン化 / B-027 サムネイル画像 / B-028 品番一覧カテゴリ検索 / B-029 サンプル材料セクション / B-030 数量モデル整理(SKU確定後・製品サイズ展開 B-041 と関連) / B-031 本番/dev手動投入ズレリスク記録 / B-032 ProductCategory標準シードを seed.ts に追加 / B-034 FactoryProcessingType中間テーブル / B-035 WorkOrder.samplProductionId 綴りミス修正 / B-036 案件タイプ別タスク生成テンプレート出し分け / B-037 docs直下の未追跡ファイル整理。
- B-038〜B-044（S-4b-1 セッション起票）: 見積→量産マスター化候補提示 / 規格・サイズ構造化 / ファスナー軸分解 / 製品サイズ展開 / (欠番) / マルチペルソナビュー構想 / 事業構想(小規模アパレル向けサブスク・OEM目線と自社ブランド目線の分岐)。詳細は前回メモ参照。
- B-033（dev ドリフト解消）は完了クローズ済み。

## ⑦ コミット/マージ一覧（本セッション）
- PR #65 → merged c4fe8ba: ProcessingType 大分類 workType 追加 + UI + migration2本(wo_items nullable 同梱) + 小分類10件 seed。
- PR #66 → merged a1f9f90: seed を core/dev/prod 2層に整備。
- PR（本メモ）: docs/session-handover-2026-06-09。

## ⑧ 注意点・教訓
- **dev は db push 運用・migrate dev 厳禁**（⓪-3）。`_prisma_migrations` が無い dev に migrate dev を打つと全 migration 再適用→リセット提案でデータ消失の恐れ。スキーマ反映は db push、検証は migrate diff empty。
- **dev データは揮発しうる**: 本セッションで dev が全消失。マスターデータ(company/user/各マスター)は seed で復旧可能だが、手動投入の検証データ(progress_tasks/Product/テストPO)は復元されない。重要な検証データは seed 化しておくと安全(B-045)。
- **本番 seed はマージと別オペ**: コード(seed スクリプト)をマージしても本番DBには入らない。本番投入は `CONFIRM_PROD_SEED=… + 本番URL` で seed-*-prod.ts を対話 yes 実行。忘れると本番だけ0件。
- migration の段階停止が有効: SQL 生成→Claude.ai に報告→承認→push の順を厳守。enum 参照のみの ADD COLUMN は CREATE TYPE が混ざらないことを生成 SQL で確認。0件確認のうえ default なし NOT NULL を直接追加。
- 本番DB操作の鉄則: host 照合(shuttle:16099)→破壊前カウント→1トランザクション→検証。本番PWは Railway Regenerate→必ず Web Redeploy。
- seed の流儀: core(ロジック) + dev エントリ(本番ホストなら abort) + prod エントリ(三重ガード) の2層。company は tenantType:"MASTER_ADMIN" で動的検索(id ハードコードしない)。AuditLog をシード経由でも残す(B-010)。$transaction timeout 120s(B-009)。
- WoItem は PoItem と別テーブル: PO は v1.1/v1.2 で明細を実務化拡張したが、WoItem は未拡張。S-4b-2 で同等の実務化が要るか着手時に判断（要るなら migration・schema 真値 grep 必須）。wo_items の金額 nullable 化は #65 で済み。
- $transaction timeout: 遅延 remote DB で既定5秒超過→部分コミット孤児の実績。create/update に {timeout:15000}。WO系も同様に。
- npm run dev のポート取り合い: 古い next dev が 3000 を握っていると新起動が exit 1。`lsof -ti :3000 | xargs kill` で掃除してから起動。
- Zod 版: nativeEnum の必須メッセージは `required_error` ではなく `{ message: "..." }`（この版で required_error は型エラー）。
- Git運用: docs単独=PR推奨(本番デプロイは走るが migration/コード変更なし) / コード含む=PR必須。docs はファイル add を明示指定し未追跡物(docs/files */・*.zip)の巻き込みを防ぐ。git add -A / . は使わない。
- 引き継ぎメモ保存の鉄則(shunya-session-handover): ①2箇所出力 ②保存指示は本文を cat <<'EOF' に埋め込む ③保存前に git log origin/main で実態確認。

## ⑨ 次セッション冒頭の手順
1. このメモを貼り付け → 状態復元。
2. `git log origin/main --oneline -8` で実態確認（先頭 a1f9f90）。main 最新化。
3. S-4b-2（WO系）実装ブリーフ作成へ。仕様 s-4b-order-creation-spec-confirmation-v1_0 §4 を出発点に、WorkOrder/WoItem の schema 真値 横断 grep（WoItem が PoItem 相当の実務化列を持つか・採番 woNumber・S-4a 受け皿 progressTaskId/processingTypeId・PROCESSING の workType コピー）から開始。dev の progress_tasks=0 なので検証データ再投入も。（※本番 processing_types 10件は本セッションで投入完了済み・再投入不要）
