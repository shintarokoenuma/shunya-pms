# B-006 / B-010横展開 実装指示書（Claude Code 向け）

- 作成日: 2026-06-02 / Claude.ai
- 対象: **B-006**（Material UPDATE の auditLog が categoryId 変更を記録しない・優先度 high）/ **B-010 横展開**（シードスクリプトの AuditLog 書き込み・未対応分の棚卸しと修正）
- 参照: `shunya-master-patterns.md`、色マスター（colors / colors-prod）、`material-categories`、柄種別マスター dev seed（PR #52）
- 性格: **B-006 は code-only のバグ修正（schema 変更なし＝migration なし＝本番DB無風）**。検証は **dev（`7492` / `hopper`）のみ**。**本番 seed・本番操作は本指示書のスコープ外**。

---

## 共通の前提（着手前）

- `git checkout main && git pull origin main` で最新（柄種別マスター含む）を取り込む。ローカルは main 1本・クリーンであること。
- TypeScript はファイル保存（**ターミナル直貼り禁止**）。**main 直コミット禁止**。feature ブランチ → PR → squash merge。
- dev 作業前に `railway run printenv DATABASE_URL | sed ...` で **dev（`7492` / `hopper`）** であることを確認（safety-check）。
- 本番 DB への seed/CRUD は **本指示書では行わない**。必要が出た場合は別途、明示指示＋ `docs/SESSION_HANDOVER.md` §③ で host 照合＋三重ガードを経てから。
- Co-Authored-By は現行のモデル表記に揃える。

---

# B-006: Material UPDATE auditLog が categoryId 変更を記録しない

ブランチ: `fix/material-update-audit-categoryid`（PR #55 想定）

## STEP 1: 調査（着手前・必須）

修正に入る前に、以下を読んで**現状の実装と「なぜ categoryId が落ちるか」を特定**し、所見を報告すること。

読む対象:
- `src/lib/actions/materials.ts` の `updateMaterial`（更新本体と auditLog 書き込み箇所）
- 監査の共通ヘルパー（`createAuditLog` / `writeAuditLog` 等。`src/lib/` 配下）
- 参照実装として、**兄弟 update action の監査の取り方**:
  - `updateMaterialCategory`（`src/lib/actions/material-categories.ts`）
  - `updateColor`（`src/lib/actions/colors.ts`）
  - 可能なら `updateSupplier` など連絡先付き重厚マスターの update も

確認ポイント（この3仮説のどれに該当するかを判定）:
1. **手書きホワイトリスト漏れ**: `beforeData`/`afterData` を明示的なオブジェクトリテラルで組んでおり、`categoryId` がそのリストに無い。
2. **`select` 漏れ**: 更新前 snapshot を Prisma `select` で取得しており、`categoryId` が select に含まれていない。
3. **「変更なしスキップ」ガード**: diff を計算して「変更フィールド0なら監査スキップ/更新スキップ」する分岐があり、比較対象に `categoryId` が入っていない（→ カテゴリだけ変更すると UPDATE ログが作られない）。

> 報告フォーマット: 「該当仮説 = N。根拠 = 該当行の引用。兄弟 action は◯◯方式で監査を取っている」。慎太郎さん経由で Claude.ai に共有可（診断のセカンドチェックが要る場合）。

## STEP 2: 修正方針（決定ルール）

**ゴール**: 既存 Material を編集し **categoryId だけを変更**して保存したとき、
- AuditLog に `UPDATE`（entityType = Material 系の既存表記）が **1件**作られ、
- `beforeData.categoryId` に旧値、`afterData.categoryId` に新値が入る。

修正の選び方（最小修正・兄弟 action に同形で合わせる）:
- 兄弟 update action が **更新前後の実エンティティから snapshot を取っている**なら、`updateMaterial` も同形にし、`categoryId` が snapshot に含まれることを保証する。
- 兄弟が**手書きホワイトリスト方式**なら、`categoryId` をそのリストに追加する（加えて、表示名も snapshot に含める慣例があれば categoryName 相当も合わせる）。
- **「変更なしスキップ」ガード**がある場合は、比較対象フィールド集合に `categoryId` を含める。

制約:
- **広域リファクタは行わない**。high 優先のバグ修正として、categoryId を通すための最小変更に留める。
- 監査書き込みは更新と**同一 `$transaction` 内**（create/update の既存慣例＝原子性）。archive/restore/delete のトランザクション外パターンには寄せない。
- **categoryId 以外にも snapshot から漏れている FK（例: supplierId）を発見した場合**、本 PR では **categoryId のみ**修正し、他の漏れは**所見として記録**（別バックログ起票候補）。スコープを広げない。

## STEP 3: 検証（dev のみ）

dev（`7492` / `hopper`）で実施。`printenv DATABASE_URL` で host 確認（safety-check）。

1. テスト用 Material を1件用意（無ければ作成）。MaterialCategory が2件以上あること。
2. **(a) categoryId だけ変更**して保存 → AuditLog に UPDATE 1件、`beforeData.categoryId`=旧 / `afterData.categoryId`=新。
3. **(b) categoryId + 他フィールド**を同時変更 → after に全変更が反映、categoryId も含む。
4. **(c) categoryId を変えず他フィールドだけ変更**（回帰確認）→ 従来どおり記録され、categoryId 変更を「した」ことにならない（誤検知なし）。
5. `npx tsc --noEmit` clean。
6. 既存の `setState-in-effect` 等の lint は**触らない**（既存パターン・別チケット）。

## スコープ外（B-006）
- schema 変更・migration。
- 本番 seed / 本番操作。
- 他マスターの同種バグの修正（所見のみ。横展開は別チケット）。

---

# B-010 横展開: シードスクリプトの AuditLog 書き込み（棚卸し → 必要なら修正）

ブランチ: `chore/seed-auditlog-backfill`（**横展開対象が出た場合のみ**作成）

## STEP 1: 棚卸し（必須・まず報告）

seed スクリプトの所在を `grep`/`find` で特定し（`prisma/seed*.ts`、`scripts/seed-*.ts` 等）、各スクリプトについて次を判定して**表で報告**:

| seed | create時に AuditLog(CREATE) を書くか | 冪等 skip 時に AuditLog を重複させないか | 準拠状態 |
|---|---|---|---|

- 準拠形の手本: **柄種別 dev seed（PR #52）** / **colors-prod** / **cost-categories-prod**（created のみ AuditLog を書き、skip 分は書かない＝冪等）。

## STEP 2: 修正（未対応 seed がある場合のみ）

- 未対応 seed に AuditLog(CREATE) 書き込みを追加。entityType は各マスターのモデル名で統一（既存準拠）。
- **冪等性維持**: 既存（skip）レコードには AuditLog を書かない。**created したレコードのみ**書く。
- dev seed と本番 seed エントリで方針が分かれている場合は、**本指示書では dev seed のみ**を対象にする（本番投入は別途）。

## STEP 3: 検証（dev のみ）

- dev で対象 seed を実行 → **created 件数 = 追加された AuditLog(CREATE) 件数**。
- 再実行で全 skip・**AuditLog が増えない**（冪等）。
- `npx tsc --noEmit` clean。

## 報告ルール
- 全 seed が既に準拠なら、**「横展開対象なし」**として PR は作らず、棚卸し表だけ残す（必要なら `docs/` にメモ）。

---

## 実施順

1. **B-006**（PR #55）を先に完了・dev 検証・マージ。
2. その後 **B-010 横展開の棚卸し**。対象が出れば別 PR、なければ「対象なし」で締める。
