# SESSION_HANDOVER.md（2026-08-11 締め / M2 半分完了・B-133 完了・B-134〜137 起票）

## ⓪ 次セッションの最初の一手

**B-134（サンプル修正記録の削除）の実装から始める。**

実装ブリーフは 2026-08-11 のチャットに全文あり。ただし**チャットは失われる前提**なので、
下記 §⑤ に設計の要点を全て転記してある。ブリーフを再構成できる状態にしてある。

その後の候補は §⑥ の優先順。

---

## ① 本セッションの成果

| PR | 内容 | merge commit |
|---|---|---|
| **#130** | サンプル修正記録の CRUD（M2 / PR-C1） | `f181e47` |
| **#131** | 量産見積 材料費行の UI 改善（B-133） | `098274f` |

両方とも**本番反映済み・本番画面で動作確認済み**。
PR #94（B-065・6/23 から open）を close。**open な PR はゼロ**。

### PR #130（PR-C1）の内容
- 新規: `src/lib/validators/sample-revision.ts`（status は VarChar なので
  `SAMPLE_REVISION_STATUSES = ["PENDING","COMPLETED"]` でアプリ層固定）
- 新規: `src/lib/actions/sample-revisions.ts`（list / create / update）
- 新規: `src/app/(app)/samples/_components/sample-revision-section.tsx`
- 変更: `labels.ts`（TYPE 9値 / REQUESTOR 5値 / STATUS 2値）
- 変更: `samples/[id]/page.tsx`（縫製指示の直後・修正系譜の直前に配置）
- migration なし。**削除は含めていない**（→ B-134）

### PR #131（B-133）の内容
- `ProductionCostRow` に表示用4項目を追加:
  `rolls` / `purchasedQuantity` / `remainingQuantity` / `maxUnitsFromRolls`
- ★**反単価が未入力なら `単価 × 原反長` を導出して計算に使う**（qe-0 §Q4 の実装）
  導出時の通貨は**行通貨**に従う。実値があればそちらを優先し上書きしない
- 材料費行の並び: 単価 / 通貨 / 所要量 / 買う量 / 行小計 / 1枚あたり
  （`md:order-*` で視覚順序のみ変更。JSX は動かしていない）
- 所要量を `md:col-span-2` → `1` に変更（6列維持のため）

---

## ② ★B-133 で見つかった実務上の発見

dev 実測（用尺2.3m / 原反長45m / 見積数量100 / ロス率5%）:

    所要量 = 224.595m → 5反（225m）→ 残 0.405m
    取り切り = floor(225 ÷ 2.415) = **93枚**

**100枚のつもりが、実際には93枚しか作れない。** 残尺 0.405m で増やす余地もない。
改修前はこれが一切見えず、100枚で見積を出していた。

★この「取り切り枚数」を出すのは慎太郎さんの発案。改修の中核。

---

## ③ ★B-135 の設計が固まっている（実装は未着手）

**相見積もりの実態（慎太郎さんヒアリング 2026-08-11）**:
① 材料と仕様を決めて仕様書を作成して工場に渡す
② パターン依頼し、仕様だけ決めて工場へ渡す
→ **この2タイプがほとんど。仕様書までまとめて「工場だけ変えればいい」**

**帰結: 材料の仕入先は相見積もりの比較軸にならない。**

    ProductionEstimate に
      factoryId    String?  @map("factory_id")
      contractorId String?  @map("contractor_id")

- `WorkOrder` と同じ house style（scalar FK・`@relation` なし・
  `@@index([companyId, factoryId])` / `([companyId, contractorId])`）
- **`supplierId` は持たない**（必要になれば後から行に追加。非破壊）
- **採用フラグは持たない**（記録不要と確定）
- 同一品番に複数 PE を作れる構造は既存（unique は `estimateNumber` のみ）
- migration 1本・ADD COLUMN のみ

★実装時の要確認: `ProductionEstimate` に監査 `snapshot()` の網羅ガード
（`satisfies Record<...>`）があれば列追加で同期必須。コンパイルで検知される。

★却下した案: 行ごとに相手先を持つ案（材料 Supplier + 工賃 Factory/Contractor）。
  一度は推奨したが、相見積もりの実態を聞いて撤回。工数に見合わない。

---

## ④ ★B-136 が地味に重要

`ProductionEstimateItemSource` の実在値は **`MANUAL` / `SAMPLE_PO` / `SAMPLE_WO` / `BOM`**。
（★`PAST_PO` / `PAST_WO` は **RoughEstimateItem 側**の enum。混同注意）

`SAMPLE_WO` ＝ **確定サンプルの WoItem を量産見積にコピーする経路が既に実装済み**。

慎太郎さん談: 「日本のサンプル工場で作ってベトナムで量産、という流れも普通にある」

→ **サンプル工場の工賃がベトナム量産の見積に入ったまま気づけない。**
画面には「サンプル WO」バッジが既に出ているので、そこに注意喚起を添えるだけで効く。
表示のみ・計算不変・低リスク。B-135 より軽く効果は大きいかもしれない。

---

## ⑤ B-134 の実装設計（ブリーフ再構成用・チャット消失に備えた転記）

**方式: 物理削除。**
`SampleRevision` は `deletedAt` 列を持たず `SOFT_DELETE_MODELS` にも含まれないため、
Prisma 拡張の削除ガードが掛からない＝構造上 `delete` が許可されている。
論理削除にするには migration が要るため採らない。
★慎太郎さん談「物理削除以外（アーカイブ等）でもよい。そのタイミングで考える」

**`deleteSampleRevision(id)` の作法**（`updateSampleRevision` と同型）:
1. `requireSession()`
2. 対象 revision を `findFirst({ where: { id } })`（companyId 列は無い）
3. ★取得した `sampleProductionId` で親 `SampleProduction` を
   `findFirst({ id, companyId, deletedAt: null })` して**所有確認**
   （省くと id 直指定で他テナントの記録を消せる）
4. `prisma.sampleRevision.delete({ where: { id } })`
5. AuditLog: `action: "DELETE"` / `entityType: "SampleRevision"` /
   `beforeData` に削除前の全項目 / `afterData` は **`Prisma.DbNull`**
6. `revalidatePath` は既存2箇所と同じ

**UI**: 各行の編集ボタンの隣に `Trash2`。
確認ダイアログは `sample-production-delete-button.tsx` の作法に揃える。
文言に何を消すか含める（`修正記録 #2「…」を削除します。取り消せません。`）。

**`revisionOrder` は詰め直さない**（確定）。#2 を消すと #1・#3 が残り、次は #4。
詰め直すと「2番の修正」という参照が壊れるため。

---

## ⑥ 次の優先順（提案）

| 順 | 項目 | 規模 |
|---|---|---|
| 1 | **B-134** サンプル修正記録の削除 | PR 1本・migration なし |
| 2 | **M2 PR-C2** 縫製指示 Json の差分を `SampleRevision.details` に自動記録 | PR 1本・migration なし |
| 3 | **B-136** SAMPLE_WO の注意喚起 | 小・表示のみ |
| 4 | **B-135** 量産見積に量産工場 | migration 1本 |
| 5 | **M3 A-0** サンプルの色×サイズ×数量 仕様確認書 | 設計 |

★M2 は PR-C1 完了で半分。PR-C2 を終えれば M2 完了。
★M3 の A-0 論点3つは前回引き継ぎメモに記載（色の参照方式・サイズ体系・Sku 昇格）。

---

## ⑦ ★本セッションの教訓

### 教訓1: このリポジトリに vitest は無い

テストは各ファイル冒頭に書かれているとおり **`npx tsx <path>`** で実行する自作 assert 方式。
`package.json` に test スクリプトも vitest も無い。`npx vitest run` は
「Cannot find package '@/lib/calc/production-cost'」（`@/` エイリアス未解決）で落ちる。

    npx tsx src/lib/calc/production-cost.test.ts
    npx tsx src/lib/production-estimate/calc.test.ts

集計は `console.log("✓ …: N/M ケース PASS")`。ケース追加時は**分母も更新**する。

### 教訓2: 「見せるだけ」の線引きが裏目に出ることがある

反単価の導出を最初「表示のみ・計算には使わない」と線を引いたが、
画面に ¥50,000 と見えているのに行小計が「—」のままという状態を作ってしまった。
**B-133 が潰そうとしていた「値が見えているのに使われていない」構造そのもの。**
影響範囲を実測（dev 1件・本番 0件）してから撤回し、計算に使う形へ変更した。

★教訓: 「安全側に倒す」判断が、ユーザーから見て**より混乱する形**になることがある。
  画面を見てから判断する。

### 教訓3: lint の「baseline 同数」は根拠にならない

Claude Code が「lint 11 = baseline 同数」と繰り返し報告したが、
**main で lint を実行した結果は一度も取っていなかった**（記憶由来）。
正しい判定は **`npm run lint | grep <変更ファイル名>` が空であること**。
件数の一致より強い証拠になる。

### 教訓4: 計算を変える PR は本番の該当件数を実測してからマージ

B-133 は rollPrice 未入力行の扱いを変えた＝既存見積の金額が動きうる。
本番を read-only で調べて **ROLL 行 0 件**を確認してからマージした。
手順: Railway から `DATABASE_PUBLIC_URL` → `~/prod-url-tmp.txt`（chmod 600・repo 外）
→ ホストが `shuttle.proxy.rlwy.net:16099` であることを目視 → SELECT → `rm`。

### 教訓5: 対象の取り違え（QE-1R と PE）

「ラフ見積の ROLL 計算がおかしい」と調べ始めたが、実際の画面は
**量産見積（ProductionEstimate）** だった。ラフ見積（`RoughEstimate`）には
`procurementMode` / `rollLength` / `rollPrice` / `cutFee` / `usagePerUnit` の
**列が1つも無い**（spec で「概算には引き込まない」と明記されている通り）。
★スクリーンショットから画面を特定する時は、**スキーマに列があるか**で裏を取る。

---

## ⑧ ★新しい入口: Google Drive の気づきメモ

慎太郎さんが Windows / Mac 双方から書き溜められるフォルダを新設。

- フォルダ: `shunya-pms 気づきメモ`（Google Drive・Claude から読める）
- 構成: `画像/`（配下に `解決済み/`）・`メモ/`
- ★**テキストは Claude が読める。画像（PNG）は読めない**
  （Base64 で返るため実質的に取得不能。**画像はチャットに直接添付**していただく）

**運用（確定）**: Drive は inbox に徹し、状態管理は `BACKLOG.md` に一本化する。
二重管理を避けるため、Drive 側では「B番号を振ったら該当行の冒頭に `[B-133]` と追記」
のみ行う（フォルダ移動はしない）。

★本日の B-133 / B-135 / B-136 はすべてこのメモが起点。

---

## ⑨ 本セッションのバックログ増減

**新規4件（B-134〜137）／状態変更1件（B-133 完了）／close 1件（PR #94）**

- **B-133**: 完了（PR #131・本番反映済み）
- **B-134**: サンプル修正記録の削除（新規・ブリーフ設計は §⑤）
- **B-135**: 量産見積に量産工場（新規・設計は §③）
- **B-136**: SAMPLE_WO の注意喚起（新規・§④）
- **B-137**: 単位「枚」の行に販売モード/カット代が出る件（新規・小）
- **B-065 / PR #94**: close。主客転倒の設計誤りのため B-069 に引き継ぎ。
  ブランチ `feat/b-065-po-import-colorway` は証跡として残置

**次に振れる番号は B-138。**

---

## ⑩ 環境（2026-08-11 実測）

- main HEAD = **`5939fb3`**（docs: BACKLOG 更新）
- 機能コードの最新は `098274f`（PR #131 マージ）
- dev DB = `hopper.proxy.rlwy.net:12921` / 本番 DB = `shuttle.proxy.rlwy.net:16099`
- ★Railway から取るのは **`DATABASE_PUBLIC_URL`**（`DATABASE_URL` は internal）
- 本番 URL = `shunya-pms-web-production.up.railway.app`
- dev サーバ **PID 31405**（PORT 3001）・締め時点で稼働中
- migration ディレクトリ **49本**（本日の2 PR はいずれも migration なし）
- 作業ツリー: `?? skill/` のみ（未追跡・B-037 管轄）
- **open な PR = 0 件**

### dev データの現況
- `sample_revisions`: 2件（SP-2026-0005 配下・#1 PENDING / #2 COMPLETED）
- `production_estimate_items`: ROLL 1件（デニム・rollPrice 未入力）
- 本番の `production_estimate_items`: ROLL **0件** / METER 6件 / null 10件
  ★METER 6件のうち3件に `roll_price` が入っている。METER では参照されないので
    実害はないが、「ROLL のつもりで METER のまま」の可能性。要観察

---

## ⑪ 次セッション冒頭の手順

1. `git branch --show-current` / `git log origin/main --oneline -3`（HEAD = `5939fb3` 以降か）
2. dev サーバ PID 31405 の生存（`lsof -nP -iTCP:3001 -sTCP:LISTEN`）
3. `.env` の接続先が `hopper.proxy.rlwy.net:12921` であること
4. `gh pr list --state open`（0件のはず）
5. B-134 に着手するなら §⑤ からブリーフを再構成。recon は不要
   （`sample-revisions.ts` は本日 PR #130 で作ったばかりで構造は §⑤ に転記済み）
