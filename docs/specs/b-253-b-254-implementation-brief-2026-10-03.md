# B-253 / B-254 実装ブリーフ（招待の取り消し・停止の人の文言の確認）2026-10-03

- 識別子: B253-BRIEF
- 上位: docs/specs/b-205-pr3-implementation-brief-2026-10-03.md（P3-D1〜P3-D18・§9）／docs/specs/b-205-settings-spec-confirmation-v1_0-2026-09-27.md
- 決定の原文: 慎太郎さん 2026-10-03 21:20「Aでいきましょう。」（案A＝取り消しは deletedAt・同じ会社の同じアドレスは行を使い回す）／21:14「10月中頃にはスタッフも含めた実務で使用したいです。」
- ブランチ: feat/b253-cancel-invitation（main から切る。main 直 push 禁止）
- ★本ブリーフは claude.ai 側で書いた。行番号は 2026-10-03 21:18 の main（71a6ba3）の実測。§2 の RECON を最初に流し、§2-3 の停止条件に当たったら実装に入らず報告すること

## §0 この PR でやること

1. 招待中の行に「招待を取り消す」を出す。取り消すと送ったリンクが使えなくなり、一覧から消える（B-253）
2. 同じ会社で、取り消した招待と同じアドレスを招待し直したときは、その行を起こし直して新しい招待を送る（B-253）
3. 招待中のアドレスをもう一度招待したときの文を、理由が分かる文に変える（B-253）
4. B-254 はコードを変えない。dev のブラウザで1回確かめるだけ（§6-11）

schema・migration の変更はなし。

## §1 確定事項

### 実測した前提（2026-10-03 21:06〜21:18・main 71a6ba3）

- User.email は全社で @unique（schema の User 6行目）。inviteUser の重複チェックは prisma.user.findUnique({ where: { email } }) で、状態も deletedAt も見ない（users.ts:339）
- 取り消した人が入れる入口は、deletedAt を入れれば全部ふさがる: 招待の受諾は deletedAt なし＋INVITED を要求（invitations.ts:34・60）／再設定は ACTIVE＋deletedAt なしを要求（password-reset.ts:51・110・130）／ログインはパスワードが乱数（P3-D10）／jwt は deletedAt があれば null（auth.ts）
- 状態の遷移（user-management.ts の nextUserStatus）に INVITED から出る道は無い。招待中の行の操作は「招待を再送」だけ（users-table.tsx:202・247-249）
- トークンを無効にする処理は issueUserToken の中の updateMany だけ（user-tokens.ts:38-41）
- B-254 は実装済み: authorize はパスワード照合 → 状態確認の順で、正しいパスワードの停止・アーカイブ・削除済みの人に code=account_suspended（auth.ts:33-34・59-77）。ログイン画面はその code のときだけ「このアカウントは停止されています。管理者にお問い合わせください。」（login-form.tsx:38-39）。commit 1070da0（PR #174）

### 本ブリーフで決めたこと（C-D）

| D | 内容 |
|---|---|
| C-D1 | 取り消し＝行に deletedAt を入れる。status は INVITED のまま。アーカイブ（ARCHIVED）は使わない（「停止に戻す」→「再開」で、パスワードを決めていない人が有効になり、再設定のメールから入れてしまうため） |
| C-D2 | 取り消しは1つのトランザクションで: 未使用の招待トークンをすべて revokedAt で無効にする → 行に deletedAt → AuditLog。物理削除はしない（鉄則3） |
| C-D3 | 取り消せる条件は「招待を再送」と同じ: オーナー・管理者だけ・同じ会社・deletedAt なし・isExternalUser が false・status が INVITED・相手の役割が OWNER ならオーナーだけ。メールは送らない（送信の設定が無くても取り消せる） |
| C-D4 | 招待のときの重複チェックを純関数 classifyInviteEmail に切り出し、4通りに分ける（下の表） |
| C-D5 | 使い回し（revive）は1つのトランザクションで: updateMany（where に id・companyId・status INVITED・deletedAt not null）で count が 1 であることを確かめてから、姓・名・displayName（「姓 名」）・role・新しい乱数のパスワード・deletedAt を null・failedLoginAttempts を 0・lockedUntil を null に書く → issueUserToken → AuditLog → 最後に送信（失敗なら全部戻す・P3-D14 と同じ） |
| C-D6 | トークンを無効にする処理を revokeUnusedUserTokens(tx, { companyId, userId, purpose }) として user-tokens.ts に切り出し、issueUserToken と取り消しの両方から呼ぶ |
| C-D7 | 取り消した行は一覧に出さない（listCompanyUsers は既に deletedAt: null）。「アーカイブも表示」でも出ない |
| C-D8 | B-254 はコードを変えない。停止とアーカイブで文を分けることもしない（今の共通の文のまま） |

C-D4 の表（同じメールの既存の行）:

| 既存の行 | 結果 | 画面の文 |
|---|---|---|
| 無い | new（今までどおり新しく作る） | — |
| 同じ会社・status INVITED・deletedAt あり | revive（その行を起こし直す） | 成功時は今までどおり「◯◯ に招待メールを送りました」 |
| 同じ会社・status INVITED・deletedAt なし | pending（止める） | このアドレスには招待中です。「招待を再送」を使ってください |
| それ以外（有効・停止・アーカイブ・他社・削除済みの有効な人） | in_use（止める） | このメールアドレスは既に使われています（今までどおり） |

### 画面の文言（★このとおり）

- 招待中の行のボタン: 「招待を取り消す」（「招待を再送」の右）
- 確認ダイアログ: 見出し「招待を取り消しますか？」／本文「{氏名}（{メール}）への招待を取り消します。送ったリンクは使えなくなり、一覧から消えます。同じアドレスには、あとから招待し直せます。」／ボタン「招待を取り消す」（destructive）・「戻る」
- 取り消した後のトースト: 「{氏名} への招待を取り消しました」
- AuditLog の description: 取り消し「招待を取り消し: {氏名}（{メール}）」／使い回し「ユーザーを再招待（取り消した招待を使い直し）: {氏名}（{メール}）{role}」

## §2 RECON（★実装の前に流す・read-only）

### 2-1. 実態

    cd ~/shunya-production-system
    date
    gh pr list --state open
    git branch --show-current          # feat/b253-cancel-invitation であること（main に戻らない）
    git log --oneline -1 origin/main   # 71a6ba3 かそれより新しい docs のみの commit
    git status --porcelain             # 本ブリーフ1ファイル（未追跡）だけであること

### 2-2. 現物を測る（結果を報告に貼る）

    # ① User に自動で deletedAt を付ける・論理削除に変える仕組みが効いていないか（効いていると findUnique が取り消した行を見ない）
    grep -rn "SOFT_DELETE_MODELS" src/ | head
    grep -rn -A3 "SOFT_DELETE_MODELS *=" src/ | head -20
    grep -n "\$extends" src/lib/prisma.ts
    # ② AuditLog の action の型と、今使っている値の一覧
    awk '/^model AuditLog \{/,/^\}/' prisma/schema.prisma | grep -n -i action
    grep -rhn -o 'action: "[A-Z_]*"' src/lib/actions/ | sort | uniq -c | sort -rn
    # ③ 一覧の行の操作と注記（ボタンを足す場所・文言）
    sed -n '190,300p' "src/app/(app)/settings/_components/users-table.tsx"
    # ④ validator（resendInvitationSchema を手本にする）とテストの置き場所
    grep -n "export const" src/lib/validators/user-management.ts
    head -20 src/lib/user-management.test.ts
    grep -n '"test' package.json
    # ⑤ 全体 lint の error 合計（着手前の値を控える。停止条件ではない）
    npx eslint . -f json 2>/dev/null | python3 -c 'import json,sys; print(sum(d["errorCount"] for d in json.load(sys.stdin)))'

### 2-3. 停止条件（当たったら実装に入らず、測った結果を報告して止まる）

- open PR がある・ブランチが feat/b253-cancel-invitation でない・作業ツリーに本ブリーフ以外の変更がある
- ①で User が自動フィルタの対象になっていて、findUnique が deletedAt ありの行を返さない（C-D4 の判定が成り立たない）
- ②で AuditLog.action が enum で、取り消しに合う値が無い（足すなら schema 変更になるので相談）

## §3 実装

### 3-1. src/lib/user-tokens.ts

- revokeUnusedUserTokens(tx, { companyId, userId, purpose }) を足す（中身は今の issueUserToken の updateMany。戻り値は無効にした数）
- issueUserToken はそれを呼ぶ形にする（動きは変えない）

### 3-2. src/lib/user-management.ts（純関数）

- classifyInviteEmail(existing, companyId) を足す。existing は { companyId, status, deletedAt } か null。戻り値は "new" | "revive" | "pending" | "in_use"（C-D4 の表）
- テストを src/lib/user-management.test.ts に足す: 4通りすべて＋他社の取り消した招待は in_use＋同じ会社の deletedAt ありの ACTIVE は in_use

### 3-3. src/lib/actions/users.ts

- inviteUser: users.ts:339 の重複チェックを findUnique（select に id・companyId・status・deletedAt）→ classifyInviteEmail に置き換える。pending と in_use は文を返して止める。revive は C-D5、new は今までどおり。P2002 の扱いは残す
- cancelInvitation({ userId }) を足す: C-D2・C-D3。AuditLog の action は §2 ②の実測で決める（DELETE があればそれ。無ければ報告して相談）。beforeData { status: INVITED }・afterData { deletedAt, revokedTokens: 件数 }。revalidatePath("/settings", "layout")
- 文言の定数（INVITE_PENDING など）は users.ts の既存の定数と同じ所に置く（"use server" のファイルから非 async の値を export しない・PR #179 の教訓）

### 3-4. 画面（users-table.tsx）

- canResend と同じ条件で「招待を取り消す」を出す。確認ダイアログは既存の「停止」「アーカイブ」と同じ部品を使う。文言は §1 のとおり
- ★§2 ③の注記の文に、招待中の行の操作の説明があれば、今の状態（再送・取り消し）に直す

### 3-5. validator

- cancelInvitationSchema（userId のみ）を resendInvitationSchema と同じ形で足す

## §4 変えないもの

- authorize・jwt・ログイン画面の文（B-254 は実装済み・C-D8）
- changeUserStatus と状態の遷移（INVITED は nextUserStatus に入れない）
- 招待の受諾・パスワード再設定の action（既に deletedAt を見ている）
- schema・migration

## §5 確認の前に

- ★dev の .env に RESEND_API_KEY がある。招待は本当に送られる。宛先は shintaro1012+pms◯@gmail.com だけを使う（example.test には届かない）
- ★3001 のプロセスを止めてから、このブランチで起動する（schema の変更は無いが、前の dev サーバが残っていないことを確かめる）

      lsof -ti tcp:3001 | xargs kill; sleep 2; lsof -ti tcp:3001 || echo "3001 空いた"
      git switch feat/b253-cancel-invitation && PORT=3001 npm run dev

## §6 確認（dev・http://localhost:3001・hopper:12921）

1. オーナーで /settings/users → 「テスト 本送信くん」（+pms3・招待中）の行に「招待を再送」と「招待を取り消す」が出る
2. 「招待を取り消す」→ 確認ダイアログの文が §1 のとおり →「戻る」で何も起きない → もう一度押して「招待を取り消す」→ トースト・一覧から消える。「アーカイブも表示」でも出ない
3. +pms3 の受信トレイにある 18:25 の招待メールのリンクを開く →「この招待リンクは使えません。」
4. 「＋ ユーザーを招待」→ 同じ +pms3、姓・名を「テスト 再招待くん」、役割を「経理」→ 送る → 一覧に招待中で「テスト 再招待くん」「経理」で出る。メールが届く
5. 4 のリンクでパスワードを決める → /login?invited=1 → そのアドレスでログインできる → 一覧で有効
6. +pms4 で招待 → もう一度 +pms4 で招待 →「このアドレスには招待中です。「招待を再送」を使ってください」→ 最後に +pms4 を取り消す
7. 有効な人のアドレス（dev-staff@example.test）で招待 →「このメールアドレスは既に使われています」（送信されない）
8. 管理者（dev-admin@example.test）でログイン → オーナーで +pms5 を役割「オーナー」で招待しておいた行に「招待を取り消す」が出ない。オーナーに戻ってその行を取り消す
9. 一般スタッフ（dev-staff@example.test）でログイン → 招待中の行に操作が出ない
10. 【dev：postgres-development】read-only で、+pms3 の行の id が 4 の前後で同じこと・deleted_at が null・status が ACTIVE、INVITE のトークンの内訳（used / revoked / 残り）が上の操作と合うこと、AuditLog に「招待を取り消し」と「ユーザーを再招待」が残りトークンの生の値が無いことを見る
11. B-254: オーナーで確認用 一般スタッフを「停止」→ 別のブラウザで dev-staff@example.test に正しいパスワード（DEV_TEST_USER_PASSWORD）→「このアカウントは停止されています。管理者にお問い合わせください。」→ 違うパスワード →「メールアドレスまたはパスワードが正しくありません」→ オーナーで「再開」して戻す
12. npx tsc --noEmit・触ったファイルの eslint・テストが通る。全体 lint の error が §2 ⑤の値から増えていない
13. dev サーバを止めてから npx next build が通る（"use server" の誤りは build でしか出ない）。後で rm -rf .next

## §7 Git / PR

- 本ブリーフを docs/specs/b-253-b-254-implementation-brief-2026-10-03.md として同じ PR に入れる
- 型・触ったファイルの lint・テスト・next build が通れば、commit → push → PR open まで自走してよい。マージは慎太郎さん
- git add は明示パスのみ
- PR 本文に書くこと: §1 の C-D 表・§2 の RECON の要約（①②の結果）・schema 変更なし・全体 lint の error 数（前後）・B-254 はコード変更なし
- commit の末尾:

      Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
      Claude-Session: https://claude.ai/code/session_014wrUhrzD8MyWEe6mqi2RhG

- PR 本文の末尾:

      🤖 Generated with [Claude Code](https://claude.com/claude-code)

      https://claude.ai/code/session_014wrUhrzD8MyWEe6mqi2RhG

## §8 本番への影響（★マージ＝本番反映＝不可逆）

- schema 変更なし。本番の users・user_tokens には書き込まない（コードの反映だけ）
- マージ後に本番の /settings/users を開き、画面が落ちないことだけを見る（本番には招待中の人がいないので、取り消しのボタンは出ない）
- ★これで本番で招待を使い始められる。試しに本番で招待するなら、自分の別アドレスへ1通送り、受け取ったら取り消すまでを確かめる（任意・慎太郎さんが決める）

## §9 今回やらないこと（行き先）

| 内容 | 行き先 |
|---|---|
| 取り消した招待の一覧・復元のボタン | 作らない（招待し直せば同じ行が戻る・C-D5） |
| 他社で取り消された同じアドレスの使い回し | 作らない（in_use のまま。社外ユーザー・複数テナントの設計で決める＝B-172・B-242） |
| 招待が受けられたことを管理者に知らせる | 未起票（締めで BACKLOG を grep して判断） |
| 停止とアーカイブで文を分ける | 作らない（C-D8） |
| BACKLOG の B-254 の定義の誤り（「専用の文言は無い」）の訂正と完了 | 締めの BACKLOG の commit で行う |

END-OF-BRIEF-B253
