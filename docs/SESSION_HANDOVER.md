# SESSION_HANDOVER.md（2026-08-10 締め・第2版 / サンプル軸 recon 完了・マイルストーンが次の宿題）

## ⓪ 次セッションの最初の一手

**recon は完了している。次は「マイルストーン（数字入り）の提示」から始める。**

★ §⑤ の recon 8項目のうち、**構造判断に必要な部分は全て完了した**。
残り4項目（輸出入メモ・実物 Excel・production-axis・Sku 制約）は
**実装ブリーフを書く段階で読めばよい**詳細であり、何を作るかの判断には不要。

---

## ① ★recon 結論 — 作るものは3つだけ

| # | 作るもの | 現状 | 性質 |
|---|---|---|---|
| **A** | `SampleProduction` に色×サイズ×数量の明細（SKU 相当） | **本当に無い** | 純粋な新規テーブル |
| **B** | ラウンド単位の縫製指示 | Product 側は完成済み | **器を1つ足すだけ**（ADD COLUMN） |
| **C** | ラウンド間の変更ログ | `SampleRevision` モデル完成済み・count しか使われていない | **CRUD を書くだけ** |

### 既に動いているもの（★recon で判明・ゼロからではない）

- **サンプル原価の集計＋永続化** … `src/lib/actions/sample-production-costs.ts`
  - `totalMaterialCost` = SP 紐づく live PO 明細 subtotal 合計
  - `totalPatternCost` = live WO(PATTERN|GRADING) 明細合計
  - `totalSewingCost` = live WO(SAMPLE) 明細合計
  - dev 実データ: SP-2026-0001 が pattern 30,000 / material 50,000 / **total 80,000** で永続化済み
  - `samples/[id]/page.tsx` で「資材費（PO）/パターン/縫製・加工費（WO）」として表示済み
- **確定サンプル → 量産見積の連携** … `isProductionEstimateBase`（1品番1点・排他設定・稼働中）
  - `production-estimates.ts:351/942` が参照。サンプル→量産の連携点として機能している
- **縫製指示の入力・保存** … `sewing-instructions.ts`（Json 全体置換・Zod・before/after 監査）

---

## ② ★前セッション（第1版）の記述の訂正

**第1版 §③「サンプルは請求しない前提だったので原価を持っていない」は誤り。**

`SampleProduction` には**最初からコスト集計列がある**:
`totalPatternCost` / `totalMaterialCost` / `totalSewingCost` / `totalRevisionCost` /
`totalCost` / `currency`。schema コメントに「関連WO・POから自動集計」と明記。
**集計ロジックも実装済み・列への永続化も動作している**（§① 参照）。

→ B-127 の「原価を持たせる」は**新規追加ではなく、既に到達している**。
   B-127 の残スコープは **色・サイズ（SKU 相当）のみ**。

→ 「サンプルが痩せている」という整理は、**SKU 1点についてのみ正しい**。
   縫製指示は「無い」のではなく **Product 側にある**（配置の問題）。
   縫製仕様書の器は `Specification` として**存在するが休眠**。

---

## ③ ★確定した設計判断（慎太郎さん承認済み 2026-08-10）

### 判断1: ラウンドごとに仕様は変わる

慎太郎さん発言:
> 1st と 2nd で仕様が変わる可能性があります。
> そのために、**確定サンプルを選定して量産に読み込む設定**にしてます。

→ 縫製指示が Product に1つでは**足りない**（1st と 2nd で違う値を持てない）。
   確定サンプル選定（`isProductionEstimateBase`）は既に実装済みで、この運用を裏付けている。

### 判断2: 案A を採用（★確定）

**`SampleProduction` に `sewingInstructions` Json を追加する。**

- Product の同名列と同じ形（`src/lib/types/sewing-instruction.ts` の型を共用）
- ラウンド作成時に Product からコピー、以後ラウンド側で編集
- 確定サンプル（`isProductionEstimateBase`）の値を Product に書き戻す＝量産の確定仕様
- migration は **ADD COLUMN 1本・非破壊**

**案B（Product の Json を廃してラウンド側に一本化）は不採用。**
既存の品番カルテ縫製指示セクションを作り直すことになり、
サンプルを作らない品番（リピート等）で置き場所を失うため。

### 判断3: 変更ログは `SampleRevision` を使う（★確定）

慎太郎さん要望:
> 1st から 2nd、3rd と進む際に変更があれば修正がログとして残ればいい。

**器は既にある。** `SampleRevision` モデルが実在し、まさにこのために設計されている:

```
revisionOrder    修正順序
revisionType     SampleRevisionType enum
description      修正内容（Text）
details          Json?  ←「構造化された修正項目」とコメントあり
photoUrls        写真
requestedBy      CLIENT / INTERNAL / FACTORY
revisionWoId     修正のための WO
```

`SampleRevisionType` enum = **DESIGN / PATTERN / MATERIAL / COLOR / SIZE /
STITCHING / FIT / DETAILS / OTHER**。
→ **COLOR / SIZE / STITCHING が既にある**。ラウンド間の色・サイズ・縫製の変化を
   修正記録として扱う設計思想が enum レベルで残っている。

**現状 `SampleRevision` は `sample-productions.ts:891` の `count()` のみで
CRUD の live code は無い＝実質休眠。** モデルはあるので CRUD を書けば動く。

実装イメージ:
```
1st ラウンド作成 → Product.sewingInstructions をコピーして SP へ
2nd ラウンド作成（parentSampleId で 1st を参照）→ 1st の値をコピー
  → 変更したら SampleRevision に「裏: 総裏 → 身頃のみ」を自動記録
確定サンプル（isProductionEstimateBase）→ その値を Product に書き戻す
```
差分検出は 11項目の Json 比較のみ。`parentSampleId`（親サンプル）も既存のため系譜も辿れる。

---

## ④ b-094 の原文確認（★2系統は歪みではなかった）

`b-094-sewing-instruction-spec-confirmation-v1_0-2026-08-01.md` §3-1 を精読。

**`Specification` を採らなかったのは意図的な判断**であり、根拠も明記されている:

- `Specification` はバージョン管理・ロック・多言語・承認フローを前提とした**重量級モデル**
- 品番カルテ1枚に載せる**軽量な縫製指示とはレイヤーが違う**
- src 参照ゼロ＝完全休眠を live 確認した上での判断
- 前例に揃えた（B-027 が `DesignVersion.flatSketch` を使わず `Product.sketchImages` を新設）

**§6 申し送りに統合方針まで書かれている**:
> Specification モデルを将来起こす際は、Product 側の値を参照/コピーする方向で
> 設計する（**二重管理にしない**）。

→ **Product 側が正・Specification は将来の出力層**という順序が既に決まっていた。
   2系統の並立は矛盾ではない。

★ただし b-094 は「品番カルテ1枚に載せる」ことだけを目的としており、
**ラウンド差は検討範囲外**だった（spec にラウンドの記述が一切ない）。
案A は b-094 の否定ではなく、**想定外だった要件への追加**である。

---

## ⑤ 慎太郎さんの当初の懸念への回答（★recon で決着）

懸念（2026-08-10）:
> サンプルも量産も同じ仕様でよく、**品番カルテの存在が仕様をおかしくした**のでは？
> サンプル作成と量産作成があればいいだけだったのでは？それが紐づいてさえいればいい。

**recon の結果、システムは既にほぼその形になっていた。**

- 紐づけ（`isProductionEstimateBase`）は稼働中
- 原価の集計・永続化も稼働中
- 欠けていたのは「サンプル側が色とサイズを記録できないこと」と
  「そこから縫製仕様書が出ないこと」

→ **品番カルテが仕様を歪めた、という懸念は否定された。** カルテは廃止しない。

---

## ⑥ ★次セッションの宿題（最優先）

**マイルストーン（数字入り）の提示。**

前セッションからの持ち越し。慎太郎さんの状況（原文）:
> 正直、時間がかかりすぎているので、私も少しストレスを抱えている状況。
> 先が見えなすぎるので、マイルストーンや、時間なども概ね把握したい。

recon が完了したので、**次は約束どおり数字を出す**。§① の A/B/C の粒度と、
慎太郎さんの実作業時間（Railway GUI・マージ・本番確認・目視レビュー）込みで見積もる。

★材料は揃っている。A のみ新規テーブル、B は ADD COLUMN 1本、C は CRUD のみ。

---

## ⑦ B-108 の現況（変更なし）

- **PR2b（PR #127）はマージ済み・本番稼働中**（main `0179a94`）。revert しない
- **PR2c は保留**
- **本番の納品書は当面「手入力（＋行を追加）」のみで運用**
- 本番 `delivery_notes` は 0件（DLV-2026-0001 の保存有無は**未確認のまま**）
- ★DLV 番号は削除しても再利用されない。本番でのテスト作成は番号を焼却する

### 前セッションで「バグではなかった」と判明した3点（★蒸し返さない）

| 現象 | 判定 |
|---|---|
| 同じ品番を無限に引き当てられる | **仕様どおり**（spec §④・分納が常態のため DB で塞がない） |
| 引き当てた明細の金額が空欄 | **仕様どおり**（サンプルは単価を持たない。発注行には入る） |
| 明細が2段になる | **未確定**。コード上の根拠なし。操作の重複の可能性 |

---

## ⑧ 本セッションのバックログ増減

**新規1件／状態変更0件／取り下げ0件**

- **B-132**（新規・`1e2000b`）: 未実装・休眠機能をグレー表示で明示
  - 慎太郎さん提案。実装済み／休眠／未着手が画面から区別できず、
    **仕様の欠落と実装の遅れが混同される**
  - サイドバーの「受注」「SKU」で既存のグレー表現があるため、**方式は確立済み**。
    適用範囲を機能単位・セクション単位に広げるだけ
  - ★recon で休眠が3箇所見つかり（`Specification` / `specificationId` /
    `pattern_wo_id`・`sewing_wo_id`）、この起票の価値が裏付けられた

**次に振れる番号は B-133。**

---

## ⑨ 本セッションの教訓（Claude.ai 側）

### 現物を読まずに書いた誤りが計4回

1. 明細2段 → 「StrictMode で updater が非冪等」と断定 → **コードを読んで誤りと判明・撤回**
2. 金額未反映 → 「受け渡しで落ちている」と推測 → **実装は正しかった**
3. `src/app/(app)/actions/delivery-notes.ts` → 実際は **`src/lib/actions/`**
4. recon スクリプトで `model Colorway` と書いた → 実際は **`ProductColorway`**。
   さらに「縫製指示がモデルとして存在する」前提を置いた → 実際は **`Product` の Json 列**

★**確認コマンドの結果を見る前に原因を書かない。**
★**モデル名・パスを記憶で書かない。** grep で実在確認してからスクリプトに埋める。

### 状態確認の設計漏れ

- `git status --short` はブランチを表示しない → 必ず **`git branch --show-current`** を含める
- `prisma db execute` は **SELECT の結果行を返さない**（実行専用）。
  値を見るには **`set -a; . ./.env; set +a; psql "$DATABASE_URL" -c "..."`**
- `prisma db execute` は `prisma.config.ts` があると `.env` を自動ロードしない
  → `--schema prisma/schema.prisma` の明示が必須

### Claude Code の停止判断が2回とも正しかった

`model Colorway` が空・`prisma db execute` が結果を返さない、いずれも
**自己修正せず停止して報告**した。この運用は機能している。

---

## ⑩ 環境（変更なし）

- dev DB = `hopper.proxy.rlwy.net:12921` / 本番 DB = `shuttle.proxy.rlwy.net:16099`
- ★Railway から取るのは **`DATABASE_PUBLIC_URL`**（`DATABASE_URL` は internal）
- 本番 URL = `shunya-pms-web-production.up.railway.app`
- dev サーバ **PID 6509**（PORT 3001）・本セッション終了時点で稼働中
- migration: ディレクトリ 47本 / 本番 DB 適用済み 64本（本セッションで変化なし）
- main HEAD = **`1e2000b`**
- ローカルに `feat/b108-pr2b-allocation-ui` が残存（削除は任意）
- 作業ツリーの `?? skill/` は未追跡・B-037 管轄

---

## ⑪ 次セッション冒頭の確認事項

1. `git branch --show-current` / `git log origin/main --oneline -3`（HEAD = `1e2000b` 以降か）
2. dev サーバ PID 6509 の生存（`lsof -nP -iTCP:3001 -sTCP:LISTEN`）
3. `.env` の接続先が `hopper.proxy.rlwy.net:12921` であること
4. **§⑥ のマイルストーン提示から始める**（recon には戻らない）
