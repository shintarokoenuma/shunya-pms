# B-202 品番カルテ 1画面化 実装ブリーフ v0.1 (2026-09-15)

- 種別: 実装ブリーフ。★設計の正は **v1.0（RECON-L）＋ addendum v0.1（QLOG-B202）＋ addendum v0.2（RECON-M）の3本セット**。本書は「何をどの順で作るか」だけを決める
- 前提の実測: RECON-M（2026-09-14 23:22 〜 2026-09-15 01:16 JST・main d7e1725・read-only・DB 無書込）
- ライフサイクル: ステップ3（品番発番・品番カルテ）の横断UI。原マイルストーンの M番号は無い
- ★正本は repo の本ファイル。プロジェクトナレッジ `claude/b-202-implementation-brief-2026-09-15.md` は同期先

---

## 0. 実装開始前に実測すること（★埋めずに着手しない）

本書の行番号は RECON-L（2026-09-12・main 48f662d）と RECON-M（2026-09-15・main d7e1725）時点のもの。**実装に入る前に取り直す。**

以下は**未実測**である。read-only で埋めてから書き始める。

| # | 実測すること | 目的 |
|---|---|---|
| R-1 | `product-sketches.ts` の AuditLog の書き方（実物） | PR-3 の action で同じ形に揃える |
| R-2 | `src/components/ui/` に何があるか（Textarea / Tabs / Collapsible / Badge） | PR-1 の引き出し・PR-2 のタブ・PR-3 の入力欄で使う部品の確定 |
| R-3 | `session.user` の形（role が取れるか） | `Comment.authorRole`（UserRole）に入れる値 |
| R-4 | B-172 の社外ホワイトリストの実装箇所 | メモを `role=EXTERNAL` に出さないための除外先 |
| R-5 | `src/app/(app)/products/[id]/page.tsx` の現行行数 | ★RECON-L 実測は **677行**。違えば以降に変更が入っている |

★R-5 が 677 でなければ、page.tsx は RECON-L 以降に変わっている。**PR-1 の前にその差分を読む。**

---

## 1. PR 分割（4本・すべてコードを含む＝feature ブランチ＋PR 必須）

| PR | 内容 | 規模 | 本番影響 | 不可逆性 | 依存 |
|---|---|---|---|---|---|
| PR-1 | 骨格：7面＋下開き引き出し。既存 Section は中身を変えず移設 | 大 | あり | **なし** | — |
| PR-2 | 絵型：1枚＝1タブ＋caption 入力欄 | 小 | あり | **なし** | PR-1 |
| PR-3 | メモ欄：`Comment` の配線（validator / action / UI） | 中 | あり | **なし** | PR-1 |
| PR-4 | 表示スイッチ：`CompanySetting` の upsert＋メモ欄の項目出し分け | 中 | あり | **なし** | PR-3 |

- ★**4本とも schema 変更・migration ゼロ**（addendum v0.2 D-9）。**全 PR が `git revert` で戻せる**
- ★PR-1 を先にする理由: 7面の枠が無い状態で PR-2〜4 を足すと、現行の縦長スクロールに足してから移設し直すことになる。枠を先に作れば、以降は枠の中に入れるだけで済む
- ★PR-1 の diff が読みづらくなったら、①引き出し化 ②要約表示 の2本に割ってよい

---

## 2. PR-1 骨格：7面＋引き出し

ブランチ: `feat/b-202-pr1-karte-one-screen`

**触るファイル**

- `src/app/(app)/products/[id]/page.tsx`（RECON-L 実測 677行・セクション18）
- `src/app/(app)/products/_components/` に引き出しの器を1つ新設（例 `karte-drawer.tsx`）

**やること**

1. 1画面に置く7面を v1.0 D-2 の順で並べる: ①ヘッダ ②絵型 ③品番・分類 ④縫製指示（固定5＋縫製6の11項目）⑤SKU 数量（色×サイズ）⑥進行 ⑦メモ（進行の直下）
2. 残りを下開きの引き出しへ送る: 資材表BOM(1,285行) / マーキング実測(605行) / 資材所要量 / 概算量産見積(2,064行) / 量産見積 / 量産原価 / 受注 / 発注 / 関連書類 / サンプル製作ラウンド / メタ情報
3. 引き出しの条件（addendum v0.1 Q5）: **同時に開くのは1つ**・中身は**引き出しの内側でスクロール**・横長の表は引き出し内で横スクロール
4. 1画面側の各面は**要約表示**にする。★既存 Section コンポーネントは中身を変えず、引き出しの中でそのまま使う
5. 進行（⑥）は **直列を暗示する表現をやめ、1画面に収まる密度に要約する**だけ。★状態の描き分けは既に実装済み（addendum v0.1 §1-2: `production-progress-checklist.tsx:41-43` が別ファイルから `PROGRESS_TASK_STATUS_LABELS` / `PROGRESS_TASK_STATUS_BADGE_VARIANT` / `PROGRESS_TASK_STATUS_OPTIONS` を import し、197-199 の Badge と 207-218 の Select で描き分けている）。**このロジックは触らない**

**やらないこと**

- 進行の並べ替え機能（addendum v0.1 Q3 = (a) 表示だけ直す）
- 受注を1画面に上げる（Q9 = 引き出しのまま）
- Section コンポーネントの内部改修

**受け入れ条件**

- 18セクションの情報が**1つも失われていない**（1画面か引き出しのどちらかに必ずある）
- 引き出しを2つ同時に開けない
- 既存の編集・保存がこれまでどおり動く

---

## 3. PR-2 絵型：タブ化と caption 入力欄

ブランチ: `feat/b-202-pr2-sketch-tabs-caption`

**触るファイル**

- `src/app/(app)/products/_components/sketch-section.tsx`（208行）
- ★`src/lib/types/product-sketch.ts`（22行）と `src/lib/actions/product-sketches.ts`（289行）は**変更不要**。`ProductSketch.caption?: string` は既にあり、action は 280行目で caption を保存経路に通している

**やること**

1. 1枚＝1タブにする。並び順は `sortOrder`、タブ名は `caption`（addendum v0.1 Q2）
2. ★タブ名が空のときの既定は **絵型 1 / 絵型 2 …**。**159行目の既存 alt と同じ文言に揃える**
3. caption の入力欄（1行テキスト）を足す（addendum v0.2 D-10）。保存は既存の「配列まるごと更新・last-write-wins・最新を読み直してから操作」に乗せる
4. 表示は**原本を使う**（addendum v0.1 Q10。サムネではない）

★注意: `sketch-section.tsx` には現在 Input / Dialog / form / onSubmit が**1つも無い**（RECON-M §1-4）。**このファイルに初めて入力系が入る。** 25行目の `inputRef` はファイル選択用で別物。

**受け入れ条件**

- caption を入れて保存 → 再読込でタブ名になる
- caption が空のタブが 絵型 1 / 絵型 2 と出る
- 既存の絵型（dev の AOI-26SS-M-TS-001・3枚）が壊れない

---

## 4. PR-3 メモ欄：Comment の配線

ブランチ: `feat/b-202-pr3-product-memo-comment`

**新規ファイル**

- `src/lib/validators/comment.ts`（★validators/ の32本に `comment.ts` は無い）
- `src/lib/actions/comments.ts`（★actions/ の41本に `comments.ts` は無い）
- `src/app/(app)/products/_components/memo-section.tsx`

★**手本は `src/lib/actions/product-sketches.ts`（289行）**。冒頭60行の構造をそのまま踏襲する: `"use server"` ／ ファイル冒頭に方針コメント（仕様書のパス・何を踏襲したか・何をしないか）／ `ActionResult<T>` 型 ／ `requireSession()` が `{ ok: true, companyId, userId }` か `{ ok: false, error }` を返す ／ `auth()` を直接呼ぶ ／ `revalidatePath` で再描画。

**初版で使う列**（v1.0 D-7 ＋ addendum v0.1 Q6）

    companyId / attachedToType("product") / attachedToId(productId)
    content / contentFormat
    authorUserId / authorRole
    isEdited / editedAt / originalContent
    createdAt / updatedAt / deletedAt

**初版で使わない列**（PR-4 のスイッチで隠す）

    parentCommentId / threadRootId / mentionedUserIds / CommentMention
    attachments / commentType / priority
    isResolved / resolvedByUserId / resolvedAt / resolutionNotes
    isPinned / reactions / language / translations

**やること**

1. 一覧・作成・編集・論理削除の4 action。★**全クエリに `companyId` を含める**
2. 削除は `deletedAt`（物理削除しない。product-sketches.ts の「孤児許容」と同じ方針）
3. 編集時は `isEdited=true` / `editedAt` / `originalContent` を残す。画面には「編集済み」の印だけ出し、元の文面は出さない
4. 索引は既存の `@@index([companyId, attachedToType, attachedToId])` に乗る。追加不要
5. ★**社外ユーザー（B-172 の role=EXTERNAL）にメモを出さない。** B-172 D-4 のホワイトリストに入れない（R-4 で実装箇所を確認してから書く）
6. `Product.internalNotes`（上書き型・`product-form.tsx:579` で編集・`page.tsx:643-644` のメタ情報で表示）は**触らない。併存させる**

**受け入れ条件**

- 別会社のメモが混ざらない（companyId スコープ）
- 削除したメモが一覧に出ない・DB には残っている
- 編集すると「編集済み」が出て、旧文面が `original_content` に入る
- ★**マージ前に本番で comments の件数を1回だけ SELECT する**（addendum v0.2 §1-2 の唯一の未確認の解消・read-only・書き込みなし）

---

## 5. PR-4 表示スイッチ：CompanySetting の upsert

ブランチ: `feat/b-202-pr4-ui-preferences`

**新規ファイル**

- `src/lib/company-setting-defaults.ts`

**やること**

1. 既定値の定数を1箇所に置く。★**必須 Json 7本（numberingRules / emailSettings / expiryWarningDays / quotationValidityDays / automationSettings / aiSettings / securitySettings）は空オブジェクト。** Decimal / Int / enum / String は schema の `@default` がそのまま効く
2. ★ファイル先頭のコメントに「**空オブジェクトは未設定を意味する。将来この領域を実装するときは未設定として扱うこと**」と書く
3. `companyId` で upsert する（company_settings は **0行**・companies は **1行**）
4. スイッチの保存先は `uiPreferences.productKarte.memo.*`。★段階3（B-203）へ移せる名前空間にする
5. 既定はすべてオフ（本文・書いた人・日時だけの素朴なメモ欄で始める）。`isEdited` 系は**常時オン**でスイッチ対象外（addendum v0.1 §1-1）

★**migration は書かない。** 7列に既定値を足す migration は addendum v0.2 D-11 で不採用（不可逆なステップを B-202 に戻さないため）。

**受け入れ条件**

- company_settings が0行の状態から、スイッチを1つ触ると行が作られる
- 2回目以降は既存行の `uiPreferences` だけが更新され、他の列が上書きされない
- スイッチの状態が再読込後も残る

---

## 6. 全 PR 共通のルール

- コードを含むので **feature ブランチ必須・main 直 push 禁止**
- 型・lint がクリーンなら **commit → push → PR open まで Claude Code が自走してよい。マージだけ慎太郎さんが握る**
- 全クエリに `companyId`（マルチテナント）／削除は `deletedAt` の論理削除
- `import { prisma } from "@/lib/prisma"` ／ `import { auth } from "@/lib/auth"`
- shunya（MASTER_ADMIN）の特権アクセスは AuditLog に記録（R-1 で書き方を確認してから書く）
- ★型は `src/lib/types/` の中立モジュールに置く。client component が `"use server"` の actions から型を import すると `@prisma/client` がブラウザバンドルに漏れる（`product-sketch.ts` 冒頭の PR #85 の轍）
- ★PR を作らせるブロックの**1行目**は `gh pr list --state open`（二重 PR の防止）

---

## 7. 確認手順（マージ前・マージ後）

★詳細は `shunya-pr-url-checklist` に従う。要点のみ:

1. **マージ前の確認はローカル。** 確認するブランチに `git switch` してから `PORT=3001 npm run dev` → `http://localhost:3001`。★3000 ではない
2. dev DB は hopper.proxy.rlwy.net:12921。★**dev の素材は薄い**（products 4件・絵型があるのは AOI-26SS-M-TS-001 の1件のみ）。PR-1 / PR-2 の見た目確認はこの品番で行う
3. **マージ ＝ Railway の main 自動デプロイ ＝ 本番反映 ＝ 不可逆**
4. ★マージ前の案内に本番 URL を並べない（2026-09-02 にコピー先を取り違えて本番を開いた）
5. マージ後の本番確認は `https://shunya-pms-web-production.up.railway.app`

---

## 8. スコープ外と受け先（新規採番ゼロ）

addendum v0.1 §4 の表から変更なし。PDF → **B-054** ／ 型紙の版 → **B-146** ／ 表示の出し分け段階2・3 → **B-203** ／ 貿易書類の本体 → **B-110** ／ 進行表ボード → **B-096** ／ 納品書による自動算出 → **B-106** ／ 休眠機能のグレー表示 → **B-132** ／ 先方品番の位置 → **B-176** ／ サンプル側の DONE 判定 → **B-104** ／ 外部による進行チェック → **B-022** ／ メモの社外開放 → **B-172**（既定拒否のまま）。

★**本書で新たに繰り延べた要件は無い。浮いている要件はゼロ。**

---

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-09-15 | v0.1 | 初版。PR-1〜PR-4 の分割・手本ファイル・受け入れ条件・確認手順を収載。着手前の実測 R-1〜R-5 を明示。識別文字列 BRIEF-B202-M |
