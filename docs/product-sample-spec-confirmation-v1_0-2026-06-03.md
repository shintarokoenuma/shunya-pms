# 仕様確認議事録 — 品番カルテ × サンプル製作 × 進行チェックリスト（v1.0 確定版）

- 作成日: 2026-06-03 / Claude.ai
- 作成者: 慎太郎さん + Claude
- バージョン: **v1.0（確定・実装着手可能）**
- ステータス: **確定**（§9 の6論点すべて慎太郎さんが確定済み）
- 位置づけ: マスターフェーズ完了後、シナリオA の次段＝業務トランザクションの「最初の山」の仕様確認。MVP実装計画書ではサンプル製作は Phase 1C だったが、実務優先度（サンプルが回らないと案件が前に進まない）により先頭に繰り上げる。
- v0.1 からの差分: §3-1 タスク項目を確定（品質表示を付属に吸収・先方提出を追加・加工をプルダウン方式に）、§3-3 を案C-1 で確定し ProcessingType マスター連携を追加、§4〜§6 を確定、§8 段階分けに S-3a（ProcessingType マスター）を追加、新方針「資材は品番単位で発送をまとめる」を追記。

---

## 0. このドキュメントの読み方

- 「✓ 確定」= 慎太郎さんと合意済み。本 v1.0 ではすべての論点が確定状態。
- 実装は本ドキュメントに沿って着手する。schema 変更（migration）を伴う段階（S-3 以降）は、着手時に dev/本番の環境安全確認（safety-check）を全面適用する。
- S-1（Product 基本CRUD）は既存 schema で動くため schema 無変更見込み（後述 §8）。

---

## 1. 最初の山の定義（✓ 確定）

「サンプル作成に関わるプロダクト関連」を最初の山とする。採用は **案B（発注連携込み）＋ 進行チェックリスト**。

スコープ内:
1. **Product（品番カルテ）** — 案件の器。基本CRUD・採番・ステータス・マスター参照。
2. **SampleProduction（サンプル製作セット）** — サンプル作成の主役。SP採番・ラウンド管理・ステータス遷移・修正系譜。
3. **発注（PO/WO）連携** — パターンWO・材料PO・縫製WO・加工WO の作成と、サンプル製作セットへの紐付け・コスト集計。
4. **進行チェックリスト** — 案件発動時に必要タスクを自動でチェックリスト化し、漏れ（発注漏れ・依頼漏れ）を検知。**本要件の核心。** サンプル・量産で共通。

スコープ外（後続フェーズ）:
- 三位一体（仕様書/パターン/デザインの中身の作り込み）。SampleProduction からは optional 参照の「箱」だけ用意し、中身は後続。
- 外部パートナー開放（B-022）。ただし受け皿（担当者/入力者/チェック日時フィールド）は本スコープで先に作る（後述 §7）。
- 見積もり（QT）・受注（SO）・量産発注の本実装。量産は進行チェックリストの設計に「量産でも使える」前提だけ織り込む。

---

## 2. 対象エンティティと依存（既存 schema 確認済み）

既存 schema に以下は定義済み（モデルは存在、UI/actions が未実装）:

- `Product`（品番カルテ）: productCode（社内品番 `MK-26SS-TS-001`）/ clientProductCode? / inquiryId? / **modelCodeId（必須）** / **clientId（必須）** / **brandId（必須）** / categoryId? / **season（必須）** / **year（必須）** / status（ProductStatus 10段階 enum）/ isSpecLocked / 価格・数量・納期フィールド群 / 担当者（assignedToUserId / designerId / patternMakerId）/ 他
- `ProductStatusHistory`（品番ステータス遷移履歴）: fromStatus / toStatus / changedByUserId / changeReason / changedAt（既存・S-1 で記録に使う）
- `SampleProduction`（サンプル製作セット）: productId / sampleNumber / sampleRound / roundOrder / parentSampleId? / specificationId? / patternVersionId? / designVersionId? / patternWoId? / sewingWoId? / material_po_ids? / status
- `SampleRevision`（サンプル修正記録）: revisionType / description / requestedBy / status
- `WorkOrder`（WO）: factoryId / productId / workType（sewing/processing/pattern/grading）/ status
- `PurchaseOrder`（PO）: supplierId / productId / allocationType / status

**重要な構造的事実**:
- `SampleProduction` の三位一体・WO/PO 参照はすべて optional。→ 発注連携を段階的に積める。
- `ProductStatus` enum は既に10段階（PLANNING / SAMPLE_REQUESTED / SAMPLE_IN_PROGRESS / SAMPLE_APPROVED / ORDERING_PERIOD / ORDER_CONFIRMED / MASS_PRODUCTION / INSPECTION / DELIVERED / COMPLETED + CANCELLED / ON_HOLD / ARCHIVED）。S-1 で enum 追加は不要。
- **進行チェックリスト用のモデルは既存 schema に存在しない**（§3-3 で新規設計）。
- **ProcessingType（加工種別）マスターは既存 schema に存在しない**（§3-1(B) の確定により新規設計＝S-3a）。

依存の流れ: `ModelCode（実装済）→ Product → SampleProduction →（WO/PO・三位一体）`。Product が土台、SampleProduction が主役、進行チェックリストが横断。

---

## 3. 進行チェックリスト（核心・最重要）

### 3-1. タスク項目（✓ 確定）

サンプル時のタスク（確定版）:

| # | タスク | 完了の判定根拠 | 判定方式 | 主な依頼先 |
|---|---|---|---|---|
| 1 | デザイン・仕様確定（品質表示の表示内容もここで確定） | 仕様書バージョンの確定（ロック） | 別途記録 | 社内・デザイナー |
| 2 | パターン作成 | パターンWO の存在・完了 | 伝票自動 | 外注パタンナー |
| 3 | 生地手配 → 入荷 | 生地PO の存在 → 入荷フラグ | 伝票自動＋別途記録 | 仕入先 |
| 4 | 付属手配（下げ札・品質表示タグを含む）→ 入荷 | 付属PO の存在 → 入荷フラグ | 伝票自動＋別途記録 | 仕入先 |
| 5 | 縫製依頼 | 縫製WO の存在・完了 | 伝票自動 | 工場 |
| 6 | 加工（種別をプルダウン選択・必要分のみ生成） | 加工WO の存在・完了 | 伝票自動 | 工場・外注 |
| 7 | 検品 | 検品記録 | 別途記録 | 社内・工場 |
| 8 | 先方提出・評価 | 提出記録・評価結果 | 別途記録 | 社内（→クライアント） |

量産時の追加（共通設計に織り込む）: **グレーディング**（グレーディングWO）、**納品**（納品書）。

**v0.1 からの確定差分**:
- **(A) 生地と付属は分離**（タスク #3 / #4 を別に持つ）。仕入先・入荷タイミングが別になりやすく、「片方だけ入荷」を別状態で持てるようにするため。
- **(B) 加工はプルダウン方式**。案件発動時に固定生成せず、品番（Product）に対して加工種別を選択し、選んだ分だけ PROCESSING タスクが生える（§3-3 参照）。種別は **ProcessingType 軽量マスター**（案い）で管理し、画面から増減できる（洗い／プリント／刺繍／染め…）。加工なし案件では PROCESSING タスクは0行。すべて productId に紐づき品番内で完結する。
- **(C) 品質表示・下げ札は付属の一カテゴリ**として #4「付属手配」に吸収。独立タスク「品質表示」は廃止。資材として PO・入荷管理に乗せる。**表示内容のデータ作成**（JIS絵表示・組成・取扱い表記）は #1「デザイン・仕様確定」に内包し、チェックリスト上の独立行は立てない。B-020（品質表示メーカー統合）実装時に #1 から品質表示データへ連携を張る。
- **(D) 先方提出・評価タスク追加**（#8）。サンプルを送って評価・修正指示をもらう工程の送付漏れ・評価待ち放置を検知対象にする。SampleProduction の status（IN_REVIEW）との二重持ちにならないよう、チェックリスト側は「提出した／評価が返った」の事実記録に徹する。

### 3-2. タスク完了の判定は2方式のハイブリッド（✓ 確定）

- **伝票自動算出**: パターン・生地・付属・縫製・加工。PO/WO の存在・status から「発注済み／完了」を自動判定。
- **別途記録**: 入荷確認・検品・先方提出評価・仕様確定。対応する伝票が無い、または伝票の先（入荷・検品結果）なので、チェックリスト側に状態を持たせる。

> 設計の肝: 「発注済み ≠ 入荷済み」。生地・付属は PO の存在（発注した）と入荷フラグ（届いた）を**別の状態**として持つ。発注したのに材料が届かず縫製に入れない、という別種の漏れを取りこぼさないため。

### 3-3. データ構造（✓ 確定：案C-1 タスク行モデル）

`ProgressTask` を新規モデルとして作り、案件（Product）または サンプルラウンド（SampleProduction）に対しタスク1件＝1レコードで持つ。テンプレート方式（案C-2）は運用が固まってからの拡張とする。

```
ProgressTask（新規・確定イメージ）
- id, companyId
- productId（必須）/ sampleProductionId?（サンプル単位のタスクの場合）
- taskType: enum（SPEC_LOCK / PATTERN / FABRIC / TRIM / SEWING / PROCESSING / INSPECTION / CLIENT_REVIEW / GRADING / DELIVERY）
   ※ v0.1 の CARE_LABEL は廃止（→ TRIM に吸収）。CLIENT_REVIEW を追加。
- processingTypeId?  ← taskType=PROCESSING のとき ProcessingType マスターを参照（種別ごとに1行）
- phase: enum（SAMPLE / PRODUCTION）  ← サンプル/量産の共通利用
- status: enum（NOT_STARTED / IN_PROGRESS / DONE / BLOCKED / SKIPPED）
- evidenceMode: enum（AUTO_FROM_DOC / MANUAL）  ← 伝票自動か手動か
- linkedWoId? / linkedPoId?  ← 伝票自動算出タスクの紐付け先
- isReceived?  ← FABRIC / TRIM の「入荷済み」フラグ（発注済みと別状態）
- 【外部開放の受け皿 — §7】
  assigneeType: enum（INTERNAL / FACTORY / SUPPLIER / CONTRACTOR）
  assigneeId?  ← 担当のマスターID
  checkedByUserId? / checkedByExternal?  ← 誰がチェックを入れたか
  checkedAt?  ← チェック日時
- notes?, sortOrder
- createdAt / updatedAt
```

**加工がプルダウンで増える例**: 「洗い」と「刺繍」を選ぶと PROCESSING タスクが2行生成され（processingTypeId=洗い／刺繍）、それぞれに加工WO・工場・進捗を別々に紐付けられる。種別ごとに入荷・完了状態が分かれるため漏れ検知の粒度が保たれる。

> 自動生成の出し分け（実装方針）: 初期は「定型タスク（#1〜#5, #7, #8）を案件発動時に全生成」＋「加工（#6）は選択分のみ生成」。不要な定型タスクは SKIPPED で対応。テンプレート化（案C-2）は運用が固まってから B-021 同様に段階移行する。

---

## 4. Product（品番カルテ）（✓ 確定）

| 論点 | 確定内容 |
|---|---|
| 採番（社内品番） | `MK-26SS-TS-001`＝ブランド略号-シーズン-カテゴリ-連番。1A-12 と同じ「保存時確定・プレビュー表示」方式に統一（Brand/Category/Season 選択時にプレビュー、保存時に transaction 内で連番再計算・確定）。カテゴリ略号の扱いは S-1 実装指示書で詳細確定（categoryId optional のため） |
| status（ライフサイクル） | 既存 ProductStatus 10段階 enum を採用（enum 追加不要）。S-1 ではサンプル系（PLANNING / SAMPLE_REQUESTED / SAMPLE_IN_PROGRESS / SAMPLE_APPROVED）の遷移をUIで扱い、量産系（ORDERING_PERIOD 以降）は箱として持つだけ。status 変更は ProductStatusHistory に記録 |
| ModelCode 連携 | 既存 ModelCode 選択＋新規発番の両対応。新規発番時は Product 作成と同時に ModelCode を発番（`M-{ブランド略号}-{連番}`、1A-12 §9.1）。**1A-12 の手動採番UI（model-codes/new）は本実装で撤去または管理者限定に変更**（1A-12 §9.6 の刈り取り） |
| Inquiry 依存 | `inquiryId` は optional のまま進める（Inquiry は後続）。clientId は schema 上必須なので S-1 で必須入力 |

---

## 5. SampleProduction（サンプル製作セット）（✓ 確定）

| 論点 | 確定内容 |
|---|---|
| SP採番 | `SP-2026-0042`。年＋連番（テナント単位）。ModelCode/Product と同じ保存時確定方式 |
| ラウンド管理 | 1st→2nd→3rd。`parentSampleId` で修正系譜（2nd は 1st を親に持つ）。UIで系譜表示 |
| ステータス遷移 | 既存 enum を採用（PLANNING / PATTERN_IN_PROGRESS / MATERIAL_ORDERING / SEWING_IN_PROGRESS / COMPLETED / IN_REVIEW / REVISION_REQUESTED / APPROVED / REJECTED / CANCELLED） |
| チェックリストとの連動 | **初期は手動遷移**。全タスク DONE で COMPLETED へ自動遷移などは段階的に（S-3 完了後に検討） |

---

## 6. 発注（PO/WO）連携（✓ 確定：サンプル起点に絞る）

- パターンWO・材料PO（生地/付属）・縫製WO・加工WO を作成し、SampleProduction（および ProgressTask）に紐付ける。
- 進行チェックリストの「伝票自動算出」タスクは、この PO/WO の存在・status を見て自動でチェックが付く。
- コスト集計: サンプル製作セットの「パターン＋材料＋縫製＋修正」コストを WO/PO から自動集計。
- **範囲を絞る（確定）**: 最初の山では「サンプル製作に必要な範囲のWO/PO作成・紐付け」に限定。汎用発注（量産・配分 SHARED/STOCK）は後続フェーズ。
- PO/WO の採番（`PO-2026-xxxx` / `WO-2026-xxxx`）も保存時確定方式で統一。

### 6-1. 資材発送の運用方針（✓ 確定・新規）

**資材（生地・付属・下げ札等）は、できるだけ品番（Product）単位でまとめて発送する。** 理由は送料の最適化と、工場へ資材がばらばらと届くことによる紛失防止。この方針は S-4 発注連携／出荷（B-018）の設計に反映する（PO の発送単位・まとめ出荷の表現）。

---

## 7. 外部パートナー開放の受け皿（✓ 確定 / B-022）

- 進行チェックリスト（ProgressTask）に、**誰が担当・誰がチェックを入れた・いつ**を最初から持たせる（§3-3 の assigneeType / checkedBy / checkedAt）。
- 本スコープでは **入力者＝社内** のみ。外部パートナー（工場・仕入先・パタンナー）のログイン・権限制御・通知は後続フェーズ（B-022）。
- 仕様の土台: Part3 5.7（工場・仕入先開放）/ 5.9（パタンナー開示範囲＝自分宛WO・仕様書・修正指示は開示、原価・他案件は非開示）。
- 理由: 社内専用で固く作ると外部開放時にスキーマ作り直しになる。受け皿だけ先に作る。

---

## 8. 実装の段階分け（✓ 確定）

| 段階 | 内容 | schema 変更 | 主な成果物 |
|---|---|---|---|
| **S-1** | Product 基本CRUD | **無変更見込み**（Product / ProductStatusHistory は既存） | 採番・status・ModelCode連携・マスター参照UI。1A-12 手動採番UI撤去 |
| **S-2** | SampleProduction 骨格 | 無変更見込み（既存） | SP採番・ラウンド・ステータス・修正系譜UI |
| **S-3a** | ProcessingType マスター | **migration あり**（新規モデル） | 加工種別の軽量CRUD（採番不要・status・監査）。S-3 の前提 |
| **S-3** | 進行チェックリスト | **migration あり**（新規 ProgressTask + enum） | ProgressTask モデル・自動生成・手動記録・外部開放の受け皿フィールド |
| **S-4** | 発注(WO/PO)連携 | 要確認（既存 WO/PO に追加列の可能性） | サンプル起点のWO/PO作成・紐付け・チェックリスト自動算出・コスト集計・品番単位まとめ出荷 |

**順序（確定）**: S-1 → S-2 → S-3a → S-3 → S-4。**S-3（チェックリスト）を S-4（発注連携）より先**にする。最初は手動チェックで回し、後から発注連携で自動算出に置き換える段階移行が自然なため。

> safety-check の適用: S-1・S-2 は schema 無変更見込みなので、マスター量産と同じく dev で動作確認・本番は smoke test。S-3a 以降は migration を伴うため、dev 検証 → 本番は別途明示指示 ＋ host照合（本番=ab6d/shuttle:16099, dev=7492/hopper:12921）＋三重ガードを全面適用する。

---

## 9. 確定状況（v0.1 §9 の6論点）

| # | 論点 | 確定内容 |
|---|---|---|
| 1 | タスク項目 | §3-1 のとおり確定（生地/付属分離・加工プルダウン・品質表示は付属吸収+#1内包・先方提出追加） |
| 2 | データ構造 | 案C-1（タスク行モデル ProgressTask）で確定 |
| 3 | Product 採番・status・ModelCode | §4 のとおり確定 |
| 4 | SampleProduction | §5 のとおり確定 |
| 5 | 発注連携の範囲 | サンプル製作起点に絞る（§6）で確定 |
| 6 | 実装段階分けと順序 | S-3a→S-3 を S-4 より先（§8）で確定 |

→ 本ドキュメントは v1.0 確定。S-1（Product 基本CRUD）から Claude Code 向け実装指示書を作成する（別ファイル `s-1-product-crud-implementation-brief-2026-06-03.md`）。

---

## 改訂履歴

| 日付 | バージョン | 内容 | 担当 |
|---|---|---|---|
| 2026-06-03 | v0.1 | 初版ドラフト（論点整理）。会話の合意を確定として記録、未決を論点化 | 慎太郎さん + Claude |
| 2026-06-03 | v1.0 | §9 の6論点を全確定。タスク項目確定（品質表示を付属吸収・先方提出追加・加工プルダウン）、案C-1 + ProcessingType マスター連携、§4〜6 確定、S-3a 追加、資材まとめ発送方針を追記 | 慎太郎さん + Claude |
