# S-3 実装指示書 — 進行チェックリスト（ProgressTask）

- 作成日: 2026-06-07 / Claude.ai（設計）→ Claude Code（実装）
- 対応仕様: `product-sample-spec-confirmation-v1_0`（§3 核心）＋ 2026-06-07 セッションの確定差分（本書末尾に要約）
- 前提コミット: main = `33f2a90`（S-3a `d39097f` 反映済み）

---

## 【対象プロジェクト】shunya-pms ⚠️ 必読

- リポジトリ: `shintarokoenuma/shunya-pms`
- ローカル: `~/shunya-production-system`
- 本番: `https://shunya-pms-web-production.up.railway.app`
- **これは saagara-v2 ではない。** 着手前に `pwd` が `~/shunya-production-system` であること、`git remote -v` が `shunya-pms` であることを目視確認すること。過去に別ウィンドウで saagara の作業（`ProductPrice` 等）が混入した事故あり。本書の内容は shunya-pms にのみ適用する。

---

## 0. このタスクのゴール（S-3 のスコープ）

サンプル製作の「進行チェックリスト」を、**人が状態を動かして漏れ検知できる状態**まで作る。伝票（WO/PO/出荷/請求）との自動連携は S-4 の仕事なので、本書では**箱と縫い代だけ正しい位置に開けて中身は入れない**。

### 作るもの（S-3 で動く）

1. `ProgressTask` モデル＋ enum 5本＋ migration。
2. SampleProduction（ラウンド）作成時に、SAMPLE phase の定型タスク **8種を自動生成**（**A-2＝ラウンド単位**）。
3. 加工（PROCESSING）行を、チェックリスト画面から **ProcessingType マスター参照で都度追加・削除**（**B-2**）。
4. 全タスクの **手動チェック**（status をプルダウンで人が動かす）＋ SKIPPED 運用＋ notes。
5. チェックリスト表示 UI（SampleProduction 詳細配下）。
6. nav 追加は不要（SP 詳細の中の一機能。独立ページは作らない）。

### 作らないもの（箱・縫い代のみ）

- **PRODUCTION phase の行**（`GRADING / SHIPPING / DELIVERY / INVOICE`）＝ enum 値は持つが **自動生成しない・手動追加導線も出さない**。S-4 以降。
- **`evidenceMode`** ＝ カラムは作るが **全行 `MANUAL` 固定**。`AUTO_FROM_DOC` は S-4 まで書き込まない。
- **linked系FK（WO/PO への参照）は持たせない。** 伝票連携は S-4 で「**伝票側に `progressTaskId?` を足す**」方針（1タスク:N伝票＝量産の先上げ対応のため。向きは伝票→タスク）。
- **「発注書を作る」ボタン** ＝ 伝票で動く行（PATTERN/FABRIC/TRIM/SEWING/PROCESSING）に**設置位置だけ確保**。S-3 では押下時に「S-4 で実装予定」をトースト表示 or 非活性。
- **`recomputeTaskStatus`** ＝ **空殻関数**だけ置く（S-4 で中身を入れる縫い代）。

---

## 1. precedent（写経元・新規発明を最小化）

「S-3a の論理層 ＋ S-2 の子行生成 transaction ＋ 既存マスター参照 UI」の三枚重ね。下記の既存ファイルを**読んで型を写す**（既存ファイルは変更しない。例外は §4 の SP create フックのみ）。

| 用途 | 写経元（読むだけ） |
|---|---|
| 論理層 actions の骨格・companyId スコープ・soft delete・**物理削除の4重ガード** | `src/lib/actions/processing-types.ts`（S-3a・589行） |
| バリデータの型 | `src/lib/validators/processing-type.ts`（S-3a・64行） |
| 親作成時に子レコードを transaction で生やすパターン | S-2 の SampleProduction create アクション（`src/lib/actions/sample-productions.ts` 付近。実ファイル名は grep で確認） |
| マスター参照プルダウン（id を握る Select） | `src/app/(app)/products/_components/product-form.tsx` の Brand/Category 選択部 |

**ProcessingType と作り分ける点（写経しない）:**
- **採番なし。** タスク行に番号は振らない（`PRC-xxx` 相当は不要）。
- **生成系が主役。** 単票 create より「ラウンドに一括生成」「加工を複数追加」が中心。
- **companyId は文字列フィールドのみ**（S-3a 同様、Company 逆リレーションは張らない）。`productId / sampleProductionId / processingTypeId` も**スカラFK＋index**で持ち、存在チェックはバリデータ／action 側で行う（既存の軽量マスター方針に合わせる。formal な `@relation` は張らない）。

---

## 2. schema 変更（`prisma/schema.prisma`）

### 2-1. 新規 model

```prisma
/// 進行チェックリスト（タスク行モデル・案C-1）
/// SampleProduction（ラウンド）単位で SAMPLE phase 定型行を自動生成する（A-2）。
/// PROCESSING 行は processingTypeId を握り、チェックリスト画面から都度追加する（B-2）。
/// linked系FK（WO/PO）は持たない。伝票連携は S-4 で伝票側に progressTaskId? を足す方針。
model ProgressTask {
  id                 String   @id @default(uuid())
  companyId          String   @map("company_id")

  // 紐付け
  productId          String   @map("product_id")              // 必須（背骨）
  sampleProductionId String?  @map("sample_production_id")     // A-2 では実質必須。schema 上は受け皿として optional

  // 種別・状態
  taskType           ProgressTaskType         @map("task_type")
  phase              ProgressTaskPhase         @default(SAMPLE)
  status             ProgressTaskStatus        @default(NOT_STARTED)
  evidenceMode       ProgressTaskEvidenceMode  @default(MANUAL) @map("evidence_mode")  // S-3 は MANUAL 固定

  // 加工種別参照（taskType=PROCESSING のときのみ・S-3a マスター参照）
  processingTypeId   String?  @map("processing_type_id")

  // 入荷フラグ（FABRIC / TRIM の「発注済み ≠ 入荷済み」を別状態で持つ）
  isReceived         Boolean? @map("is_received")

  // 外部開放の受け皿（§7 / B-022。S-3 は入力者=社内のみ）
  assigneeType       ProgressTaskAssigneeType? @map("assignee_type")
  assigneeId         String?  @map("assignee_id")
  checkedByUserId    String?  @map("checked_by_user_id")
  checkedByExternal  String?  @map("checked_by_external")
  checkedAt          DateTime? @map("checked_at")

  // メモ・並び順
  notes              String?  @db.Text
  sortOrder          Int      @default(0) @map("sort_order")

  // soft delete
  deletedAt          DateTime? @map("deleted_at")

  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  @@index([companyId, productId])
  @@index([companyId, sampleProductionId])
  @@index([companyId, taskType])
  @@index([companyId, status])
  @@index([processingTypeId])
  @@map("progress_tasks")
}
```

### 2-2. 新規 enum 5本（モデル名プレフィックス規約）

```prisma
enum ProgressTaskType {
  // --- SAMPLE phase（SP作成時に PROCESSING 以外の8種を自動生成）---
  QUOTE          // 見積もり
  SPEC_LOCK      // デザイン・仕様確定
  PATTERN        // パターン作成
  FABRIC         // 生地手配
  TRIM           // 付属手配
  SEWING         // 縫製依頼
  PROCESSING     // 加工（processingTypeId 参照・チェックリスト画面から都度追加）
  INSPECTION     // 検品
  CLIENT_REVIEW  // 先方提出・評価
  // --- PRODUCTION phase（S-3 では enum の箱のみ。生成も導線も出さない）---
  GRADING        // グレーディング
  SHIPPING       // 出荷明細
  DELIVERY       // 納品書
  INVOICE        // 請求書
}

enum ProgressTaskPhase {
  SAMPLE
  PRODUCTION
}

enum ProgressTaskStatus {
  NOT_STARTED
  IN_PROGRESS
  DONE
  BLOCKED
  SKIPPED
}

enum ProgressTaskEvidenceMode {
  MANUAL         // S-3 は全行これ
  AUTO_FROM_DOC  // S-4 で伝票連携時に使用
}

enum ProgressTaskAssigneeType {
  INTERNAL
  FACTORY
  SUPPLIER
  CONTRACTOR
}
```

> ⚠️ 既存 enum `AiProcessingType`・enum 値 `PER_TASK` / `TASK`（コメント種別）/ 各種 `IN_PROGRESS` は**無関係**。触らないこと。grep 済みで型名・テーブル名の衝突はなし（`ProgressTask` / `progress_tasks` / 上記 enum 名すべて未使用）。

### 2-3. migration

```bash
# dev DB に対して（ドリフトは B-033 で解消済み。通常の migrate dev が使える）
npx prisma migrate dev --name add_progress_task_checklist
```

---

## 3. 論理層 `src/lib/actions/progress-tasks.ts`（新規）

`processing-types.ts` を写経しつつ、生成系を足す。全関数で **`where: { companyId }` を必須**（マルチテナント原則）、soft delete（`deletedAt`）対応。

### 操作一覧

| 関数 | 内容 |
|---|---|
| `listTasks({ sampleProductionId })` | そのラウンドのタスクを `sortOrder ASC, createdAt ASC` で返す（`deletedAt: null`）。 |
| `getTask(id)` | 単票取得（companyId 一致）。 |
| `generateTasksForRound(sampleProductionId)` | **A-2 の核心。** §4 参照。SAMPLE 定型8種を一括生成。 |
| `addProcessingTasks(sampleProductionId, processingTypeIds[])` | **B-2。** 選択された ProcessingType ごとに PROCESSING 行を生成。 |
| `updateTaskStatus(id, status)` | 手動チェック。status を更新。`DONE` 化時に `checkedByUserId`/`checkedAt` を記録。`evidenceMode` は触らない（MANUAL のまま）。 |
| `updateTask(id, { notes, isReceived, assigneeType, assigneeId })` | 付随情報の更新。 |
| `removeProcessingTask(id)` | 加工行の誤追加取り消し（soft delete）。PROCESSING 行のみ対象。 |
| `checkUsage(id)` | 物理削除ガード用。S-3 では「紐づく伝票」が無いので常に未使用扱い（S-4 で `progressTaskId` 参照を見るようになる縫い代）。 |
| `deletePermanently(id, confirmToken)` | **4重ガード物理削除**（①権限 ②companyId 一致 ③`checkUsage` が未使用 ④確認トークン）。S-3a と同型。 |
| `recomputeTaskStatus(taskId)` | **空殻**。S-4 で中身を入れる（下記）。 |

### `recomputeTaskStatus`（空殻・縫い代）

```ts
/**
 * S-3: 何もしない（全タスク手動運用）。
 * S-4: linked 伝票（WO/PO/出荷/納品/請求）の有無・status を見て
 *      evidenceMode=AUTO_FROM_DOC・status を自動更新する。
 *      伝票側に追加する progressTaskId? を逆引きして集計する。
 */
export async function recomputeTaskStatus(_taskId: string): Promise<void> {
  return; // S-4 でここに実装が入る
}
```

---

## 4. 自動生成ロジック（A-2＝ラウンド単位）

### 4-1. 生成内容

`generateTasksForRound(sampleProductionId)` は transaction 内で:

1. 親 SampleProduction の存在・`companyId` 一致・`productId` を取得（不一致なら throw）。
2. SAMPLE phase 定型 **8種**を `createMany`（**PROCESSING は含めない**）。各行 `phase=SAMPLE` / `status=NOT_STARTED` / `evidenceMode=MANUAL` / `productId`（親から継承）/ `sampleProductionId`。
3. `sortOrder` は下表で固定。

| taskType | sortOrder |
|---|---|
| QUOTE | 10 |
| SPEC_LOCK | 20 |
| PATTERN | 30 |
| FABRIC | 40 |
| TRIM | 50 |
| SEWING | 60 |
| （PROCESSING 行は後から 65 起点で追加） | 65, 66, … |
| INSPECTION | 70 |
| CLIENT_REVIEW | 80 |

表示は常に `sortOrder ASC`。PROCESSING を SEWING と INSPECTION の間に並べるため 65 起点とする。

### 4-2. 発動点（S-2 への最小フック）

**S-2 の SampleProduction create アクションに、生成呼び出しを1行差し込む。** これが本書で唯一の既存コード変更。

- SampleProduction を作成する**同一 transaction の中で** `generateTasksForRound(newSampleProduction.id)` を呼ぶ（SP 作成と定型行生成は不可分。途中失敗は両方ロールバック）。
- 既存の SP create のロジック・採番・修正系譜（`parentSampleId`）には手を加えない。生成呼び出しを足すだけ。

### 4-3. 既存 SP への遡及生成

A-2 は「SP 作成時」発火なので、**S-2 で既に作成済みの SP には行が無い**。SP 詳細画面に「**チェックリストを生成**」ボタンを置き、行が0件のとき `generateTasksForRound` を手動実行できるようにする（既存データ救済＋冪等化：既に SAMPLE 定型がある場合は重複生成しないガードを入れる）。

---

## 5. UI

配置: SampleProduction 詳細ページ配下のセクション（独立ルート・nav 追加は不要）。`src/app/(app)/sample-productions/[id]/` 配下に `_components/progress-checklist.tsx` 等を新設。

### 5-1. チェックリスト表示

- `listTasks` の結果を `sortOrder` 順に行表示。
- 各行: タスク名（`labels.ts` で日本語表示。processing-types の `labels.ts` を写経）／ **status プルダウン**（NOT_STARTED / IN_PROGRESS / DONE / BLOCKED / SKIPPED を人が選ぶ → `updateTaskStatus`）／ notes 入力。
- FABRIC・TRIM 行のみ **入荷チェック**（`isReceived`）を別に表示（「発注済み ≠ 入荷済み」を別状態で持つ設計の表出）。
- 伝票で動く行（PATTERN / FABRIC / TRIM / SEWING / PROCESSING）に **「発注書を作る」ボタン** を置くが、S-3 では押下で「S-4 で実装予定」をトースト表示 or `disabled`。位置だけ正しく確保する。

### 5-2. 加工追加モーダル（B-2）

- 「加工 ――――― [ + 加工を追加 ]」セクション。
- ボタン押下で ProcessingType マスター（`status=ACTIVE` のみ）を引いた**複数選択モーダル**を開く（`product-form.tsx` のマスター Select を写経）。
- 「追加」で `addProcessingTasks(sampleProductionId, 選択id[])` → 種別ごとに PROCESSING 行が生成され、`processingTypeId` を握る。
- 各 PROCESSING 行の行末から `removeProcessingTask`（誤追加取り消し）。
- 手入力は不可（マスター参照のみ。表記ゆれ防止）。マスターに無い加工は processing-types 画面で先に追加する運用。

---

## 6. 環境・migration 手順（環境安全ルール全面適用）

> host ↔ 環境の対応は **`docs/SESSION_HANDOVER.md` §③ を唯一の正**とする。以下は参照値。
> 本番 = `postgres-ab6d`（shuttle:16099） / dev = `postgres-development`（hopper:12921）。

### dev（CRUD 確認はここで完結）

1. `npx prisma migrate dev --name add_progress_task_checklist`（dev DB に適用）。
2. `npm run dev` → `http://localhost:3000`。
3. dev で全動作確認（§8 の受け入れ確認）。dev DB には Product 2件（`PA-27SS-M-BT-001` / `IP-26SS-M-TS-001`）が温存されているので、SP を作って検証。

### 本番（smoke test のみ・データ投入しない）

- 本番 migration は **PR マージ後の Railway 自動デプロイで `migrate deploy` が走り適用される（不可逆）**。S-3a と同じ経路。
- **Claude Code は本番 DB に対して直接 migration / データ投入を行わない。** マージ→デプロイに委ねる。
- マージ後の本番確認は **read-only smoke test のみ**: `progress_tasks` テーブルが存在すること、既存品番カルテ（本番 `IP-26AW-M-BT-001` test 1件）に影響が無いこと。本番でのタスク生成・状態変更などのデータ操作はしない。

---

## 7. Git ワークフロー（コード含む＝PR 必須）

schema/migration を含むため**直 push は禁止。feature ブランチ → PR**。

```bash
cd ~/shunya-production-system
git branch --show-current && git remote -v   # main / shunya-pms を目視確認
git checkout main && git pull origin main     # 33f2a90 を確認
git checkout -b feat/s-3-progress-task-checklist

# 実装・ファイル保存（TypeScript はファイルに保存してから。ターミナル直貼り禁止）
npx prisma migrate dev --name add_progress_task_checklist
# dev で動作確認まで済ませる

git add prisma/ src/
git commit -m "feat: S-3 進行チェックリスト（ProgressTask）モデル + ラウンド単位自動生成 + 加工追加(B-2) + 手動チェック

- ProgressTask model + enum 5本 + migration（PROCESSING 以外の SAMPLE 定型8種を SP作成時に自動生成=A-2）
- 加工行は ProcessingType マスター参照で都度追加/削除（B-2）
- evidenceMode は MANUAL 固定・linked系FKは持たない（伝票連携は S-4 で伝票側 progressTaskId?）
- recomputeTaskStatus は空殻・発注ボタンは位置のみ（S-4 縫い代）

Co-Authored-By: Claude <noreply@anthropic.com>"
git push -u origin feat/s-3-progress-task-checklist
gh pr create --title "S-3 進行チェックリスト（ProgressTask）" --body "<schema変更あり / 本番DBへの影響: マージ後デプロイで migrate deploy 適用。squash merge>"
# PR open まで。squash merge は慎太郎さんの確認後。
```

PR 本文には **schema 変更あり・マージ＝本番 migration 適用（不可逆）**を明記する。

---

## ⓪-2. PR URL 3点セット（マージ前後で慎太郎さんに提示）

PR を open したら、以下3点を必ず提示する:

1. **マージ前の UI 確認 = ローカル**：`npm run dev` → `http://localhost:3000`（dev DB hopper:12921）。ここでチェックリストの生成・状態変更・加工追加を確認。
2. **マージ操作 = GitHub PR URL**：`https://github.com/shintarokoenuma/shunya-pms/pull/<番号>`。**マージ = Railway main 自動デプロイ = 本番反映（migration 適用・不可逆）**。
3. **マージ後の本番確認 = 本番 URL**：`https://shunya-pms-web-production.up.railway.app`（本番 DB shuttle:16099）。read-only smoke test のみ。

---

## 8. 受け入れ確認（dev で通すこと）

- [ ] `migrate dev` 成功・`progress_tasks` テーブルと enum 5本が作成される。
- [ ] 新規 SampleProduction を作ると、SAMPLE 定型 **8行**（QUOTE〜CLIENT_REVIEW、PROCESSING 除く）が `sortOrder` 順で自動生成される。
- [ ] status プルダウンで各行を NOT_STARTED→IN_PROGRESS→DONE / SKIPPED に手動変更でき、保存される。
- [ ] DONE 化で `checkedByUserId` / `checkedAt` が記録される。
- [ ] 「加工を追加」→ ProcessingType を複数選択 → 種別ごとに PROCESSING 行が SEWING と INSPECTION の間に生成され、`processingTypeId` を握る。
- [ ] PROCESSING 行を `removeProcessingTask` で取り消せる（soft delete）。
- [ ] FABRIC / TRIM 行に入荷チェック（`isReceived`）が表示・保存される。
- [ ] 「発注書を作る」ボタンは表示されるが、押下で「S-4 で実装予定」表示 or 非活性（実動作しない）。
- [ ] 既存 SP（行0件）で「チェックリストを生成」ボタンが動き、二度押しで重複生成しない。
- [ ] 別 companyId のデータが混ざらない（マルチテナント）。
- [ ] 既存の Product / SampleProduction / ProcessingType / WorkOrder / PurchaseOrder の挙動に回帰がない。

---

## 9. やってはいけないこと（明示）

- ❌ saagara-v2 のファイル・概念（`ProductPrice` 等）を持ち込まない。対象は shunya-pms のみ。
- ❌ `linked系FK`（`linkedWoId` / `linkedPoId`）を ProgressTask に作らない（伝票側 `progressTaskId?` 方針）。
- ❌ PRODUCTION phase の行（GRADING/SHIPPING/DELIVERY/INVOICE）を自動生成しない・手動追加導線も出さない。
- ❌ `evidenceMode` に `AUTO_FROM_DOC` を書き込まない（S-3 は MANUAL 固定）。
- ❌ 「発注書を作る」ボタンを実装しない（S-4）。
- ❌ 既存 enum `AiProcessingType` / `PER_TASK` / `TASK` を触らない。
- ❌ 本番 DB へ直接 migration / データ投入しない（マージ→デプロイに委ねる。本番は smoke test のみ）。
- ❌ `.env` を commit しない。main へ直 push しない。TypeScript をターミナルに直貼りしない。

---

## 付録: 2026-06-07 セッションの確定差分（v1.0 → 本書反映分）

| 論点 | 確定内容 |
|---|---|
| A. 生成単位 | **A-2（ラウンド単位）**。SP 作成時に SAMPLE 定型8種を生成。`sampleProductionId` 紐付け。ラウンドごとに記録を分けて残す |
| 追記① | `taskType` に **QUOTE / SHIPPING / INVOICE** を追加（DELIVERY/GRADING は既存）。見積〜請求まで1設計で網羅。S-3 は SAMPLE のみ生成、PRODUCTION 系は箱 |
| 追記② | **先上げ（1タスク:N伝票）は量産（PRODUCTION）のみ**。サンプルは1:1。実装は phase 分岐せず「伝票側 `progressTaskId?`」で両対応。S-3 では linked系FKを持たない |
| B. 加工 UI | **B-2**。チェックリスト画面の「加工を追加」→ ProcessingType マスター参照（複数選択）→ 種別ごとに行生成。ラウンド単位で都度追加・削除 |
| C. precedent | S-3a 論理層 ＋ S-2 生成 transaction ＋ 既存マスター参照 UI の三枚重ね。採番なし |
| D. 割り切り | S-3 は全タスク手動チェック。evidenceMode は MANUAL 固定。recompute は空殻。発注ボタンは位置のみ。自動算出は S-4 |

※ 本書は実装着手用。仕様本体（`product-sample-spec-confirmation`）への v1.1 追記（上記差分の正式反映）は別途まとめる。
