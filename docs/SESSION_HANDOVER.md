# SESSION_HANDOVER（shunya-pms）

識別子: HANDOVER-2026-09-16-CLOSE-O
締め日時: 2026-09-16（水）17:00 JST
締め時点の main: d88d383（origin/main と同期・作業ツリー clean・open PR 0）

---

## §0 現在地

- ライフサイクル13ステップ上の位置: **ステップ3（品番発番・品番カルテ）**。
  品番カルテ（B-202）と品番一覧の表示まわりを触っている。受注（SO）以降の背骨は別系統。
- 直近3 commit:
  - `d88d383` fix(B-204): 絵型サムネ生成で EXIF Orientation を適用する（#145）
  - `ae31e38` docs(b-202,b-204): addendum v0.4 ＋ BACKLOG B-202 進行中化・B-204 起票 ＋ ブリーフ上書き宣言
  - `2c6889e` feat(B-202 PR-1r): 品番カルテ詳細を組み替え（#144）
- BACKLOG: **B行 204 / 総行 336**。B-202=進行中、B-204=未着手、B-203=未着手、B-027=完了。

---

## §1 次にやること

### (1) B-204 の残件 — 本番の既存サムネ2件を再アップロード【本番影響あり・可逆】

`.rotate()` の修正は **新規アップロード分にしか効かない**。生成済み WebP には横倒しのピクセルが
焼き付いているため、既存分は上げ直しが要る。

2026-09-16 に本番の品番一覧を目視で実測した結果、**該当は2件だけ**だった:

| 社内品番 | 品名 | ブランド |
|---|---|---|
| `AND-27SS-M-BT-001` | AVANI X AND コラボ ベーカー生地パッチワークパンツ | AND A NOVEL DAY. |
| `AND-27SS-M-TP-001` | AVANI X AND コラボ ベーカー生地パッチワークブルゾン | AND A NOVEL DAY. |

★**一括再生成スクリプトは作らないと決めた**（2件なら手作業のほうが速く、GCS 書き込みスクリプトの
リスクを負う理由がない）。本番の品番カルテで該当2件の絵型を削除→再アップロードすれば解消する。
DB 変更なし・いつでもやり直せる。

### (2) B-202 PR-2【本番影響あり・不可逆（マージ時）】

- 絵型の caption 入力欄（addendum v0.2 で確定済み）
- 絵型を「タブ」に戻すか「帯」のままかの再判定（v0.4 D-17 は暫定・D-12 の3カラムと未整合）
- 未採番の改善3件（すべて B-202 の内側・新規 B番号なし）: v0.4 §4 を参照

### (3) B-202 PR-3 — Comment 配線【本番影響あり・不可逆（マージ時）】

★**schema 変更なし。migration も不要。** `comments` / `comment_mentions` の DDL と関連 enum は
**2026-05-16 の init migration に `products` と同じファイルで既に適用済み**（addendum v0.2 の D-9 で実測）。
PR-3 は validator / action / UI の配線だけ。
※ 2026-09-13 時点では「schema 変更1本」と誤記していた。v0.2 D-9 が正。

### (4) B-202 PR-4 — 表示スイッチ

段階1（会社の既定）は `CompanySetting.uiPreferences` に置く。段階2・3（人ごとの上書き）は **B-203**。

### (5) 掃除（任意・いつでも可）

- ローカルに古い branch が **48本**、リモートに **21本** 残っている。
  全部 squash マージのため `git branch --merged main` には出ず、削除には `-D` が要る。
- GitHub の「マージ後に branch を自動削除」が無効。設定で有効にすれば今後は残らない。
- `origin/feat/b-202-pr1-karte-one-screen`（クローズした #143）と
  `origin/fix/b-204-sketch-thumb-exif-rotate`（マージ済み #145）も残っている。

---

## §2 本セッション（2026-09-15〜16）でやったこと

| 種別 | 内容 |
|---|---|
| PR #143 | **クローズして作り直し**。v1.0 の D-2/Q5 がモックの「ボタンバー＋共有パネル1枚」「3カラム」を取りこぼしていた |
| PR #144 | B-202 PR-1r。6 commit。ヘッダ＋絵型帯＋2カラム＋ボタンバー（7群）＋共有パネル1枚。`2c6889e` でマージ |
| PR #145 | B-204。`product-sketches.ts` に `.rotate()` 1行。`d88d383` でマージ |
| docs | addendum v0.3（MOCK-C・122行）、v0.4（PR1R-DONE・148行）、BACKLOG（B-202 進行中化・B-204 起票）、実装ブリーフに上書き宣言 |
| 起票 | **B-204 新規1件のみ**。未採番の合意3件はすべて B-202 の内側 |

### PR-1r で入った主なもの

- `src/app/(app)/products/[id]/page.tsx` — ヘッダ（右端に担当者）→ 全幅の絵型帯 → 2カラム → `KarteDrawerBar`
- `_components/karte-drawer.tsx`（新規）— 横並びチップ＋**共有パネル1枚**。`useSyncExternalStore` で `#orders` 深リンク維持
- `_components/production-progress-chips.tsx`（新規）— Server Component・追加クエリゼロ・矢印/番号なし（v1.0 D-4）
- `_components/sketch-section.tsx` — 帯は `thumbUrl`、拡大 Dialog は原本 `url`。クリックで拡大
- `src/lib/actions/products.ts` — `fetchModelCodeSummariesByIds` / `fetchUserSummariesByIds` を追加。
  ★後者は **`deletedAt` を意図的に絞らない**（退職した担当者も表示するため）。`companyId` 絞りは必須
- 工場行は追加クエリなしで `WO` かつ `workCategory === "PRODUCTION"` から導出（v0.4 D-20）

---

## §3 設計の「正」はどれか

B-202 は文書が5本あるので、新しいほうが正。上が強い:

1. **モック**（一次情報。URL は addendum v0.3 の §0 に明記）
2. `b-202-spec-addendum-v0_4-2026-09-16.md`（PR1R-DONE）
3. `b-202-spec-addendum-v0_3-2026-09-15.md`（MOCK-C）
4. `b-202-spec-addendum-v0_2-2026-09-15.md`（RECON-M）
5. `b-202-spec-addendum-v0_1-2026-09-13.md`
6. `b-202-product-karte-one-screen-spec-confirmation-v1_0-2026-09-12.md`

`b-202-implementation-brief-2026-09-15.md` は **§2〜§5 が v0.3/v0.4 に上書きされている**（冒頭に宣言あり）。

---

## §4 環境と鉄則（毎回効く）

### DB / 環境

- dev DB: `hopper.proxy.rlwy.net:12921` / `postgres-7492`
- 本番 DB: `shuttle.proxy.rlwy.net:16099` / `postgres-ab6d`
- Railway の接続文字列は **`DATABASE_PUBLIC_URL`** を使う（`DATABASE_URL` は internal で届かない）
- ローカル dev は **`PORT=3001 npm run dev` → `localhost:3001`**。3000 ではない
- 本番 URL: `https://shunya-pms-web-production.up.railway.app`
- **`prisma migrate dev` は使わない**（dev に `_prisma_migrations` が無く DB 全体の reset を要求する）。
  正運用: `migrate diff` ドライラン → `db push` → **手書き** migration → 一致検証 → 本番は Railway の `migrate deploy`
- **`prisma migrate reset` と `--accept-data-loss` は実行も提案もしない**
- CRUD の動作確認は dev 優先。本番は smoke test のみ

### Git

- `.env` は絶対に commit しない
- **`git add` は明示パスのみ。`-A` / `.` / `--all` は使わない**
- docs 単独なら main 直 push 可。コードを1行でも含むなら feature ブランチ＋PR
- **マージ ＝ Railway の main 自動デプロイ ＝ 本番反映（不可逆）。マージするのは慎太郎さんだけ**
- lint のゲートは **触ったファイルの `npx eslint <file>`**。
  main は lint error 0 ではない（2026-09-16 時点で **11件**・`*-delete-button.tsx` ×10 ＋ `clients-search.tsx`）。
  全体 lint は「この PR で増えていないか」の測定に使う

### 環境の癖（今日踏んだもの）

- **`/tmp` からの node は `@prisma/client` を解決できない**。repo ルートに一時ファイルを置いて実行し、消す
- **macOS の BSD `cat` に `-A` は無い**。`cat -ev` か Python を使う
- **`cut -c` は日本語で `Illegal byte sequence` になる**。Python で切る

---

## §5 今日の教訓（同じ轍を踏まないために）

1. **モックからの転記漏れが3回**（09-13 / 09-15 / 09-16）。3回とも「モックは正しく、書き起こしが落とした」。
   → `shunya-design-reread` に **ルール 2r** を追加。構造（CSS/HTML）だけでなく **モックの文言** も引用し、
   転記後にモック原文を全文で照合する。モック URL は仕様確認書 §0 に一次情報として明記する。
2. **一度書いた認識は、後の実測で覆っても古い文書に残る。**
   「B-202 は schema 変更1本」が v0.1 → スキル → 締めの要約と伝播した。
   認識を覆したら、それを書いた場所を全部 grep して直す。
3. **ゲート条件は書いた時点の repo 状態に依存する。** 「`npm run lint` エラーなし」は 2026-06-15 には
   成立していたが、error が蓄積した今は無関係な理由で発火する。
   停止条件は「絶対値がゼロ」ではなく「**自分が悪化させていないこと**」で書く。
4. **PR 本文に書いた事実は、書いた直後に grep で検証する。** #144 は本文に事実誤認が3件あり `gh pr edit` で直した。
5. **PR-1r が B-204 を「作った」のではなく「露出させた」。** 原因は B-027 の絵型パイプライン、
   影響は品番一覧にも及ぶ。だから B-202 の中に抱え込ませず独立の B番号にした。

---

## §6 ナレッジ差し替え依頼（claude.ai プロジェクト）

- ✅ 登録済み: `b-202-spec-addendum-v0_3-2026-09-15.md` / `b-202-spec-addendum-v0_4-2026-09-16.md` /
  `b-202-implementation-brief-2026-09-15.md` / `BACKLOG.md`
- ⬜ **要差し替え: 本ファイル `SESSION_HANDOVER.md`**（この版）

---

## §7 スキルの更新（次のチャットから有効）

- `shunya-design-reread` — ルール 2r（モックの文言も引用）＋ 休眠モデルの DDL 適用済み確認
- `shunya-git-workflow` — lint ゲートを「触ったファイル」に限定

★スキルはチャット開始時点で固定されるため、保存しても **効くのは次のチャットから**。

★このメモはここで終わり（END-OF-HANDOVER-O）
