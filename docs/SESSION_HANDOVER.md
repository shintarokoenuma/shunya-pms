# shunya-pms 引き継ぎメモ（2026-09-14〜15 B-202 実装ブリーフ作成分 / 締め 2026-09-15 JST）

★本メモにしかない識別文字列: HANDOVER-2026-09-15-CLOSE-N

## ⓪ 次セッションの最初の一手（これより先に何もしない）

1. スキル `shunya-session-start` を発動する
2. 前回の締めが保存されたかを確認する（`file-write-verification` 鉄則12）

       cd ~/shunya-production-system
       git log --oneline -3 -- docs/SESSION_HANDOVER.md
       grep -c '^## ' docs/SESSION_HANDOVER.md
       tail -1 docs/SESSION_HANDOVER.md

   ★節見出しは **15**。★`tail -1` に **END-OF-HANDOVER-N** が含まれていなければ、本メモは最後まで保存されていない。
   ★件数ではなく終端の存在で判定する（今回の教訓・⑪1）
3. `date` を取る。★**UTC と JST の両方**を見る

       date -u '+UTC: %a %Y-%m-%d %H:%M'
       TZ=Asia/Tokyo date '+JST: %a %Y-%m-%d %H:%M'

## ① プロジェクト棲み分け（混同禁止）

- 本件は **shunya-pms**（`~/shunya-production-system` / GitHub `shintarokoenuma/shunya-pms`）
- saagara-v2 / earnpulse / swtras-showroom は**別物**。コマンドを流す前に `pwd` を見る

## ② git の実態（2026-09-15 01:34 JST 実測）

- ブランチ **main**（docs を main に commit した日なので main のまま終える）
- HEAD **6b357fa**・origin と同期・未 push なし・作業ツリー クリーン・**open PR 0件**
- 本セッションの commit（★**すべて docs のみ。src は1行も触っていない。DB は read-only の SELECT のみ**）

| SHA | 内容 |
|---|---|
| 0d3f0f0 | B-202 addendum v0.2（124行・識別子 RECON-M） |
| 6b357fa | B-202 実装ブリーフ v0.1（207行・識別子 BRIEF-B202-M） |

## ③ 本セッションの成果 ― B-202 が実装に入れる状態になった

前セッションで確定した設計に、**実測（RECON-M）と実装ブリーフ**を足した。設計3本＋ブリーフ1本が揃っている。

### ★最大の収穫: B-202 から migration が消えた

`Comment` / `CommentMention` / `CompanySetting` の DDL と enum 3本は、**2026-05-16 の `20260516075911_init` で既に適用済み**だった（`products` 1093行・`skus` 1159行・`comments` 3604行が同一ファイル）。
本番で品番画面が動いている＝init 適用済みなので、**本番にも `comments` は存在する**。本番 DB に接続せずに確定できた。

→ ★**B-202 の schema 変更・migration はゼロ。全 PR が `git revert` で戻せる。**
→ 前メモ④の「順3: migration の適用は不可逆」は**解消**した。

### 追加で確定したこと（addendum v0.2 / D-9〜D-11）

| # | 確定 |
|---|---|
| D-9 | B-202 に schema 変更・migration は無い（v0.1 §0 の訂正） |
| D-10 | 絵型に **caption 入力欄を足す**。タブ名は caption、空のときは `絵型 N`。型・action は変更不要 |
| D-11 | 表示スイッチの `CompanySetting` 行は**アプリ側の既定値で upsert**。必須 Json 7本は空オブジェクト（＝未設定）。migration は足さない |

## ④ 次にやること（ライフサイクル位置つき）

ライフサイクルは **ステップ3（品番発番・品番カルテ）の横断UI**。原マイルストーンの M番号は無い。
★手前の空きステップ: 1・2・5・6・7。**7（受注 SO・原設計 M4）が最重量の欠落**だが、B-202 は既存の Product / Sku / ProgressTask / sketchImages のみを使い依存しない（2026-09-15 に慎太郎さんが B-202 続行を判断）。

| 順 | 内容 | ステップ | 本番影響 | 不可逆性 | 規模 |
|---|---|---|---|---|---|
| 1 | PR-1 の着手前実測 R-1〜R-5（⑤） | 3 | なし | なし | 小 |
| 2 | PR-1 骨格（7面＋下開き引き出し） | 3 | **あり** | **なし** | 大 |
| 3 | PR-2 絵型タブ＋caption 入力欄 | 3 | **あり** | **なし** | 小 |
| 4 | PR-3 メモ欄（Comment の配線） | 3 | **あり** | **なし** | 中 |
| 5 | PR-4 表示スイッチ（CompanySetting upsert） | 3 | **あり** | **なし** | 中 |

★**不可逆なステップは1つも無い**（③のとおり migration ゼロ）。
★PR-1 からは**初めてコードを触る**。feature ブランチ必須・main 直 push 禁止。マージだけ慎太郎さんが握る。

## ⑤ PR-1 の着手前に必ず実測する5点（ブリーフ §0）

| # | 実測すること | 目的 |
|---|---|---|
| R-1 | `product-sketches.ts` の AuditLog の書き方 | PR-3 の action を同じ形に揃える |
| R-2 | `src/components/ui/` の在庫（Textarea / Tabs / Collapsible / Badge） | 引き出し・タブ・入力欄で使う部品の確定 |
| R-3 | `session.user` の形（role が取れるか） | `Comment.authorRole` に入れる値 |
| R-4 | B-172 の社外ホワイトリストの実装箇所 | メモを `role=EXTERNAL` に出さない除外先 |
| R-5 | `products/[id]/page.tsx` の現行行数 | ★RECON-L 実測は **677行**。違えば以降に変更が入っている |

## ⑥ B-番号の増減

- **新規 0件 ／ 状態変更 0件 ／ 取り下げ 0件 ／ 番号未採番の合意 0件**
- ★本セッションで `docs/BACKLOG.md` は**1行も変更していない**
- BACKLOG は **334行 / 最大 B-203**（2026-09-14 23:22 JST 実測）
- caption 入力欄は **B-202 に含める**（絵型の既存番号 B-027 / B-082 / B-090 は完了済み）。表示の出し分け段階2・3 は **B-203** が受けている
- ★締め前に「他に気づいた点は」と確認し、慎太郎さんの回答は **「ないです」**（2026-09-15）

## ⑦ 繰り延べた要件

- **0件。新規採番ゼロ。** 本セッションで作った2本（addendum v0.2 / 実装ブリーフ v0.1）のスコープ外節は、すべて既存番号（B-054 / B-146 / B-203 / B-110 / B-096 / B-106 / B-132 / B-176 / B-104 / B-022 / B-172）が受けている
- ★**浮いている要件はゼロ**

## ⑧ メモ受信箱（M-001〜M-010）

- ★正本はプロジェクトナレッジ側の `claude/MEMO_INBOX.md`。repo の `docs/MEMO_INBOX.md` は同期先
- **本セッションでの追加はゼロ**

## ⑨ ★migration 運用（重要な訂正を含む）

- **`prisma migrate dev` は使わない**（変更なし）。dev DB に `_prisma_migrations` が無く、DB 全体の reset を要求する
- ★**訂正**: 「dev に `_prisma_migrations` が無い」＝「migration ファイルが無い」**ではない**。`prisma/migrations/` には init 以来 **52本**が揃っている。この2つは両立する
- ★`migrate status` が52本を列挙して "run prisma migrate dev" と出すのは、履歴テーブルが無いときの正常な挙動
- 正運用: `migrate diff` のドライラン → `db push` → **手書き** migration → `migrate diff` の出力と手書きの一致検証 → 本番は Railway の `migrate deploy`（`package.json:9`）
- ★手書き migration の手本は `20260908000000_b170_product_colorway_client_color_name`（ADD COLUMN のみ・冒頭に根拠コメント5行）
- ★`prisma migrate reset` と `--accept-data-loss` は**実行も提案もしない**
- dev DB は **hopper.proxy.rlwy.net:12921**。★本セッションは read-only の SELECT のみ・書き込みゼロ

## ⑩ 日付について（★本セッションも日をまたいだ）

- 開始 09-14 23:22 JST → **09-15 01:16 JST に日またぎ**
- ★**システム表示が UTC（09-14）で JST が 09-15** という差がある。`date -u` と `TZ=Asia/Tokyo date` の**両方**を見て、UTC+9 で説明がつくかを確かめる
- 成果物のファイル名は JST の **2026-09-15** を採った

## ⑪ 本セッションの失敗と教訓

1. ★**検証の期待値を間違えて false-stop を1回出した。** addendum v0.2 の保存で `grep -c 'RECON-M'` を「4」と書いたが実測は **6**。§3 と改訂履歴に自分で書いた2箇所を数え落とした。`file-write-verification` 鉄則2 の同型で**3度目の再発**。
   → ★対策: **識別文字列の件数を停止条件にしない。最終行に終端の文字列を置き `tail -1` の grep で判定する。** 2本目の実装ブリーフ（207行）はこの形にして **STOP ゼロ**で通った。⑬ でスキルに反映を提案した
2. ★**Claude Code 側の要約が2回、実測を超えて一般化した。** ①「migrations が52本あるのは handover ⑨ と食い違う」（食い違わない・⑨参照）②「caption はタブ名に使えない」（分母が products 4件・絵型1件では言えない）。どちらも raw と突き合わせて訂正した
3. ★**本番 DB に接続せずに本番の状態を確定できた。** migration は1本が1単位で適用されるので、`products` が本番で動いている事実から同一ファイル内の `comments` の存在を導けた。**接続する前に、接続せずに済む論理があるかを考える**
4. ★**dev のデータが薄いことを、実装の結論にしない。** products 4件・絵型1件では「使われていない」は測れない。真因は「入力UIが無い」だった（4層のうち UI を見て初めて分かった）

## ⑫ ナレッジ同期の状況（★隠さず書く）

| ファイル | 状態 |
|---|---|
| `claude/b-202-spec-addendum-v0_2-2026-09-15.md` | ★**登録済み**（claude.ai 側で project_write・検索でヒット確認）。★「正本の所在」を示す1行だけ repo 版と意図的に違う。ハッシュ照合はしていない |
| `claude/b-202-implementation-brief-2026-09-15.md` | ★**登録済み**（同上・同じく1行だけ違う） |
| `claude/b-202-product-karte-one-screen-spec-confirmation-v1_0-2026-09-12.md` | 登録済み |
| `claude/b-202-spec-addendum-v0_1-2026-09-13.md` | 登録済み |
| `claude/MEMO_INBOX.md` | 正本。M-001〜M-010（本セッションで変更なし） |
| `SESSION_HANDOVER.md` | ★**本締めで差し替える**（claude.ai 側の project_write で実施予定。実施したら完了形にする） |
| `BACKLOG.md` | ★**未同期のまま繰り越し。** ナレッジ側は **2026-09-09 スナップショット（196行）**、repo は **334行**。解消手順は `git show origin/main:docs/BACKLOG.md` の全文ダンプを1回取り、claude.ai 側で差し替えること |

★**次セッションで BACKLOG のナレッジ版を見るときは、B-197〜B-203 が載っていない古い版**であることを前提にする。

## ⑬ 更新したスキル（★次のチャットから有効）

- **`file-write-verification`** に⑪1を反映する**提案カードを発行済み**（claude.ai 側で実施）。★**保存は慎太郎さんの操作。保存されるまで反映されない。**
  - 追加した節: 「★識別文字列の『件数』を停止条件にしない ― 終端の存在で判定する（2026-09-15 追加）」
  - チェックリストと「やってはいけないこと」にも1行ずつ追加
  - ★差分は **削除0行 / 追加16行**（750行 → 766行）を `diff` で検証済み。既存の鉄則は1行も失っていない
- ★**実行環境のスキルはチャット開始時点のスナップショットで固定される。** 保存しても**保存したチャットには反映されない。次のチャットから有効**

## ⑭ 締めの状態

- ブランチは **main のまま**終えている
- 未マージ PR **なし**
- dev / 本番 DB は**本セッションで書き込みゼロ**（dev に read-only の SELECT のみ・本番は無接続）
- src は **0行**変更（docs 2本のみ）

★このメモはここで終わり（END-OF-HANDOVER-N）
