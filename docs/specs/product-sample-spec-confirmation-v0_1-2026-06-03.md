# 仕様確認議事録 — 品番カルテ × サンプル製作 × 進行チェックリスト（v0.1 ドラフト）

- 作成日: 2026-06-03 / Claude.ai
- 作成者: 慎太郎さん + Claude
- バージョン: **v0.1（ドラフト・論点整理版）**
- ステータス: **レビュー待ち**（確定版ではない。各論点を確定して v1.0 にする）
- 位置づけ: マスターフェーズ完了後、シナリオA の次段＝業務トランザクションの「最初の山」の仕様確認。MVP実装計画書ではサンプル製作は Phase 1C だったが、実務優先度（サンプルが回らないと案件が前に進まない）により先頭に繰り上げる。

---

## 0. このドキュメントの読み方

- 「✓ 確定」= これまでの会話で慎太郎さんと合意済み。
- 「△ 論点」= 未確定。選択肢と私（Claude）の推奨を併記。**慎太郎さんの判断で確定する。**
- 実装は本ドキュメントを v1.0 に確定してから着手する。schema 変更（migration）を伴うため、着手時は dev/本番の環境安全確認（safety-check）を全面適用する。

---

## 1. 最初の山の定義（✓ 確定）

「サンプル作成に関わるプロダクト関連」を最初の山とする。採用は **案B（発注連携込み）＋ 進行チェックリスト**。

スコープ内:
1. **Product（品番カルテ）** — 案件の器。基本CRUD・採番・ステータス・マスター参照。
2. **SampleProduction（サンプル製作セット）** — サンプル作成の主役。SP採番・ラウンド管理・ステータス遷移・修正系譜。
3. **発注（PO/WO）連携** — パターンWO・材料PO・縫製WO の作成と、サンプル製作セットへの紐付け・コスト集計。
4. **進行チェックリスト** — 案件発動時に必要タスクを自動でチェックリスト化し、漏れ（発注漏れ・依頼漏れ）を検知。**本要件の核心。** サンプル・量産で共通。

スコープ外（後続フェーズ）:
- 三位一体（仕様書/パターン/デザインの中身の作り込み）。SampleProduction からは optional 参照の「箱」だけ用意し、中身は後続。
- 外部パートナー開放（B-022）。ただし受け皿（担当者/入力者/チェック日時フィールド）は本スコープで先に作る（後述 §6）。
- 見積もり（QT）・受注（SO）・量産発注の本実装。量産は進行チェックリストの設計に「量産でも使える」前提だけ織り込む。

---

## 2. 対象エンティティと依存（既存 schema 確認）

既存 schema に以下は定義済み（モデルは存在、UI/actions が未実装）:

- `Product`（品番カルテ）: productCode（社内品番）/ clientProductCode（先方品番）/ inquiryId? / modelCodeId（必須）/ clientId / brandId / categoryId? / status / 他
- `SampleProduction`（サンプル製作セット）: productId / sampleNumber / sampleRound / roundOrder / parentSampleId? / specificationId? / patternVersionId? / designVersionId? / patternWoId? / sewingWoId? / material_po_ids? / status
- `SampleRevision`（サンプル修正記録）: revisionType / description / requestedBy / status
- `WorkOrder`（WO）: factoryId / productId / workType（sewing/processing/pattern/grading）/ status
- `PurchaseOrder`（PO）: supplierId / productId / allocationType / status

**重要な構造的事実**: `SampleProduction` の三位一体・WO/PO 参照はすべて optional。→ 発注連携を段階的に積める。

**進行チェックリスト用のモデルは既存 schema に存在しない**（§5-C で新規設計）。

依存の流れ: `ModelCode（実装済）→ Product → SampleProduction →（WO/PO・三位一体）`。Product が土台、SampleProduction が主役、進行チェックリストが横断。

---

## 3. 進行チェックリスト（核心・最重要）

### 3-1. タスク項目（△ 論点：項目の最終確定）

サンプル時のタスク叩き台（慎太郎さんの6項目＋私の補完）:

| # | タスク | 完了の判定根拠（候補） | 判定方式 | 主な依頼先 |
|---|---|---|---|---|
| 1 | デザイン・仕様確定 | 仕様書バージョンの確定（ロック） | 別途記録 | 社内・デザイナー |
| 2 | パターン作成 | パターンWO の存在・完了 | 伝票自動 | 外注パタンナー |
| 3 | 生地手配 | 生地PO の存在 →**入荷** | 伝票自動＋別途記録 | 仕入先 |
| 4 | 付属手配 | 付属PO の存在 →入荷 | 伝票自動＋別途記録 | 仕入先 |
| 5 | 縫製依頼 | 縫製WO の存在・完了 | 伝票自動 | 工場 |
| 6 | 加工（任意） | 加工WO の存在・完了 | 伝票自動 | 工場・外注 |
| 7 | 品質表示・下げ札 | 品質表示データ作成（B-020連携） | 別途記録 | 社内・印刷 |
| 8 | 検品 | 検品記録 | 別途記録 | 社内・工場 |

量産時の追加（共通設計に織り込む）: **グレーディング**（グレーディングWO）、**納品**（納品書）。

> △ 確認したい点（慎太郎さんの段取り感覚に合わせる）:
> - 抜けはないか。
> - 「生地」と「付属」は分ける/まとめる、どちらが運用に合うか（本ドラフトは分離案）。
> - 加工はどこまで見るか（洗い/プリント/刺繍ごとに分ける必要があるか）。
> - 品質表示は検品の前/後どちらに置くか。

### 3-2. タスク完了の判定は2方式のハイブリッド（✓ 確定方針）

- **伝票自動算出**: パターン・生地・付属・縫製・加工。PO/WO の存在から「発注済み」を自動判定（サイドバー議事録 3.5 の方針どおり）。
- **別途記録**: 入荷確認・検品・品質表示・仕様確定。対応する伝票が無い、または伝票の先（入荷・検品結果）なので、チェックリスト側に状態を持たせる。

> 設計の肝: 「発注済み ≠ 入荷済み」。生地・付属は PO の存在（発注した）と入荷フラグ（届いた）を**別の状態**として持つ。発注したのに材料が届かず縫製に入れない、という別種の漏れを取りこぼさないため。

### 3-3. データ構造（△ 論点：2案）

**案C-1（タスク行モデル・推奨）**: `ProgressTask` を新規モデルとして作り、案件（Product）または サンプルラウンド（SampleProduction）に対しタスク1件＝1レコードで持つ。

```
ProgressTask（新規・イメージ）
- id, companyId
- productId（必須）/ sampleProductionId?（サンプル単位のタスクの場合）
- taskType: enum（SPEC_LOCK / PATTERN / FABRIC / TRIM / SEWING / PROCESSING / CARE_LABEL / INSPECTION / GRADING / DELIVERY ...）
- phase: enum（SAMPLE / PRODUCTION）  ← サンプル/量産の共通利用
- status: enum（NOT_STARTED / IN_PROGRESS / DONE / BLOCKED / SKIPPED）
- evidenceMode: enum（AUTO_FROM_DOC / MANUAL）  ← 伝票自動か手動か
- linkedWoId? / linkedPoId?  ← 伝票自動算出タスクの紐付け先
- 【外部開放の受け皿 — §6】
  assigneeType: enum（INTERNAL / FACTORY / SUPPLIER / CONTRACTOR）
  assigneeId?  ← 担当のマスターID
  checkedByUserId? / checkedByExternal?  ← 誰がチェックを入れたか
  checkedAt?  ← チェック日時
- notes?, sortOrder
- createdAt / updatedAt
```

**案C-2（テンプレート＋インスタンス）**: タスク定義をマスター（テンプレート）として持ち、案件発動時にインスタンス生成。タスク項目の増減を運用で柔軟に変えられるが、初期実装は重い。

> 推奨: **案C-1**。まずは taskType を enum で固定し、案件発動時に定型タスク群を自動生成する。テンプレート化（案C-2）は運用が固まってからの拡張（B-021 の型保険同様、後から無理なく移行できる）。
>
> △ 論点: 「案件発動時にどのタスクを自動生成するか」の出し分け。商品カテゴリや加工の有無で項目が変わる（加工なしの案件に加工タスクは出さない等）。初期は全項目生成＋不要を SKIPPED、が単純で安全か。

---

## 4. Product（品番カルテ）の論点

| 論点 | 選択肢 / 内容 | 推奨 |
|---|---|---|
| △ 採番（社内品番） | `MK-26SS-TS-001`＝ブランド略号-シーズン-カテゴリ-連番。採番タイミングは 1A-12 と同じ「保存時確定・プレビュー表示」方式に揃える | 1A-12 方式に統一 |
| △ status（ライフサイクル） | サイドバー議事録で `SAMPLE_IN_PROGRESS` / `SAMPLE_APPROVED` / `ORDER_CONFIRMED` / `IN_PRODUCTION` 等。サンプル/量産はこの status のフィルタ違いで表現 | サンプル系 status を最初の山で確定、量産系は箱だけ用意 |
| △ ModelCode 連携 | Product 作成時に既存 ModelCode を選択 or 新規発番。1A-12 で「Product 実装後に手動採番UIを消すだけで移行」と設計済み → その刈り取りを本スコープで実施 | 既存選択＋新規発番の両対応。1A-12 の手動採番UIは本実装で撤去 |
| △ Inquiry 依存 | `inquiryId` は optional。Inquiry 未実装でも Product は作れる | optional のまま進める（Inquiry は後続） |

---

## 5. SampleProduction（サンプル製作セット）の論点

| 論点 | 選択肢 / 内容 | 推奨 |
|---|---|---|
| △ SP採番 | `SP-2026-0042`。年＋連番。テナント単位の連番 | ModelCode/Product と同じ保存時確定方式 |
| △ ラウンド管理 | 1st→2nd→3rd。`parentSampleId` で修正系譜（2nd は 1st を親に持つ） | 親子チェーンで系譜を表現。UIで系譜表示 |
| △ ステータス遷移 | PLANNING / PATTERN_IN_PROGRESS / MATERIAL_ORDERING / SEWING_IN_PROGRESS / COMPLETED / IN_REVIEW / REVISION_REQUESTED / APPROVED / REJECTED / CANCELLED（既存 enum） | 既存 enum を採用。進行チェックリストの集約状態と連動させるか要検討 |
| △ チェックリストとの関係 | SampleProduction の status と ProgressTask 群は別物か連動か。例: 全タスク DONE で COMPLETED に自動遷移するか | 初期は手動遷移、自動遷移は段階的に |

---

## 6. 発注（PO/WO）連携の論点（案B の核）

- パターンWO・材料PO（生地/付属）・縫製WO・加工WO を作成し、SampleProduction（および ProgressTask）に紐付ける。
- 進行チェックリストの「伝票自動算出」タスクは、この PO/WO の存在・status を見て自動でチェックが付く。
- コスト集計: サンプル製作セットの「パターン＋材料＋縫製＋修正」コストを WO/PO から自動集計（気づき4の本来の姿）。

> △ 論点:
> - WO/PO の本実装はそれ自体が大きい山。最初の山では「サンプル製作に必要な範囲のWO/PO作成・紐付け」に絞るか、汎用の発注機能まで作るか。→ 推奨: **サンプル製作起点のWO/PO に絞る**。汎用発注（量産・配分 SHARED/STOCK）は後続。
> - PO/WO の採番（PO-2026-xxxx / WO-2026-xxxx）も保存時確定方式で統一。

---

## 7. 外部パートナー開放の受け皿（✓ 方針確定 / B-022）

- 進行チェックリスト（ProgressTask）に、**誰が担当・誰がチェックを入れた・いつ**を最初から持たせる（§3-3 の assigneeType / checkedBy / checkedAt）。
- 本スコープでは **入力者＝社内** のみ。外部パートナー（工場・仕入先・パタンナー）のログイン・権限制御・通知は後続フェーズ（B-022）。
- 仕様の土台: Part3 5.7（工場・仕入先開放）/ 5.9（パタンナー開示範囲＝自分宛WO・仕様書・修正指示は開示、原価・他案件は非開示）。
- 理由: 社内専用で固く作ると外部開放時にスキーマ作り直しになる。受け皿だけ先に作る（Material 監査の型保険と同じく、将来拡張の受け皿を構造に残す発想）。

---

## 8. 実装の段階分け（素案・要相談）

schema 変更（新規 ProgressTask、Product/SP の status enum 等）を伴うため migration あり。dev で検証 → 本番は別途明示指示で投入。

| 段階 | 内容 | 主な成果物 |
|---|---|---|
| S-1 | Product 基本CRUD | 採番・status・ModelCode連携・マスター参照UI。1A-12 手動採番UI撤去 |
| S-2 | SampleProduction 骨格 | SP採番・ラウンド・ステータス・修正系譜UI |
| S-3 | 進行チェックリスト | ProgressTask モデル・自動生成・手動記録・外部開放の受け皿フィールド |
| S-4 | 発注(WO/PO)連携 | サンプル起点のWO/PO作成・紐付け・チェックリスト自動算出・コスト集計 |

> △ 論点: S-3（チェックリスト）と S-4（発注連携）の順序。チェックリストを先に作ると、最初は手動チェックで回し、後から発注連携で自動算出に置き換える形になり、段階移行が自然。発注連携を先にすると自動算出から入れるが S-4 が重い。→ 推奨: **S-3 を先**。

---

## 9. 次のアクション（慎太郎さんに確定いただきたい項目）

1. §3-1 タスク項目の最終確定（抜け・生地/付属の分離・加工の粒度・品質表示の位置）
2. §3-3 データ構造（案C-1 タスク行モデル / 案C-2 テンプレート）の選択
3. §4 Product 採番・status・ModelCode連携の確定
4. §5 SampleProduction の SP採番・ステータス・チェックリスト連動の確定
5. §6 発注連携の範囲（サンプル起点に絞るか）
6. §8 実装段階分けと順序（S-3 先 / S-4 先）

確定したら本ドキュメントを v1.0 にし、S-1 から実装指示書（Claude Code 向け）を作成する。

---

## 改訂履歴

| 日付 | バージョン | 内容 | 担当 |
|---|---|---|---|
| 2026-06-03 | v0.1 | 初版ドラフト（論点整理）。会話の合意を確定として記録、未決を論点化 | 慎太郎さん + Claude |
