# B-205 PR-3 実装ブリーフ（メール送信の基盤・招待・パスワード再設定）2026-10-03

- 識別子: B205-PR3
- 上位: `docs/specs/b-205-settings-spec-confirmation-v1_0-2026-09-27.md`（SETTINGS-V10・D-1〜D-24）
- 前の PR: #173（PR-1・squash a79428e）・#174（PR-2・squash a7b342d）
- 決定の原文: ナレッジ `claude/MEMO_INBOX-append-2026-10-03.md`（R-7・送信元・Resend の現物）
- 一次資料（画面）: 参考画面「PMS 設定ページ 参考画面」案B（Version 2） https://claude.ai/artifact/XrcQWHt5WWsnJGQXcCNpUB
- ブランチ: `feat/b205-pr3-mail-invite-reset`（main から切る。main 直 push 禁止）
- ★本ブリーフは claude.ai 側で書いた。**repo を読まずに書いている箇所がある**ので、§2 の RECON を最初に流し、§2-3 の停止条件に当たったら実装に入らず報告すること

---

## §0 この PR でやること（4行）

1. メール送信の基盤を作る（Resend）。送信元・表示名・有効期限・API キー・アプリの URL は**すべて環境変数**で、運営側がコードを変えずに切り替えられる
2. 設定ページの「ユーザー」に「＋ ユーザーを招待」と「招待を再送」を出す。招待された人はメールのリンクからパスワードを決めて有効になる
3. ログイン画面に「パスワードを忘れた方」を足す。メールのリンクから新しいパスワードを決める
4. 招待と再設定で共用するトークンの表を1つ足す（ADD TABLE ×1・enum ×1）

## §1 確定事項

### spec v1.0 から（本 PR で効くもの）

| D | 内容 |
|---|---|
| D-5 | 新しいユーザーは招待メール。本人がリンクからパスワードを決める。`UserStatus.INVITED` を使う。招待トークンの小さな表を新設し、パスワード再設定と共用する（トークンはハッシュで保存・有効期限・使用日時） |
| D-7 | 送信元は全テナント共通・環境変数で持つ（★宛先のドメインは P3-D1 で置き換え） |
| D-8 | メール送信の基盤は B-049（発注書の送付）・B-219（請求書の送付）と共用する前提で作る |
| D-14 | 招待で選べる役割は7つ。EXTERNAL は出さない |
| D-17 | 自分の役割は自分で変えられない（招待には関係しない） |
| P2-D3 | オーナーに関わる操作はオーナーだけ。★招待でも、役割「オーナー」で招待できるのはオーナーだけ |
| P2-D10 | 一覧に出す人の条件（同じ会社・deletedAt なし・EXTERNAL でない・isExternalUser が false） |
| P2-D12 | 「＋ ユーザーを招待」「招待を再送」は PR-3 で出す |

### 本ブリーフで決めたこと（P3-D）

| D | 内容 | 根拠 |
|---|---|---|
| P3-D1（R-7） | 送信元は **`noreply@shunya.cc`**・表示名 **`PMS`**。DNS は変えない（Resend に shunya.cc が Verified で登録済み）。★spec v1.0 D-7・§7 の「送信用サブドメイン」「DNS」は本決定で置き換える | 慎太郎さん 2026-10-03 11:00「うん、切り替えられるようにしてくれれば、今は大丈夫。それで進めて。」・Resend の Domains 画面（shunya.cc・Verified・8か月前） |
| P3-D2（R-7） | 次の値をすべて環境変数で持つ。無いときは既定を使う。運営者用の管理画面は作らない（B-242 が先） | 慎太郎さん 2026-10-03 10:43「運営側へすぐ変更できる設定にしておいて下さい。」 |
| P3-D3 | 有効期限は**トークンを作った時点の値**を `expiresAt` に焼き込む。環境変数を後で変えても、送信済みのリンクの期限は変わらない | Claude の判断として慎太郎さんに伝え、止められていない（2026-10-03 10:45） |
| P3-D4 | トークンは乱数 32 バイト（base64url）。DB には **SHA-256 のハッシュだけ**を保存する。照合はハッシュで引く。生のトークンはメールの本文にしか出さない（ログ・AuditLog・戻り値に出さない） | D-5 |
| P3-D5 | 新しい招待・再設定のトークンを作るときは、同じ人・同じ用途の **未使用のトークンをすべて無効にする**（`revokedAt` を入れる）。物理削除はしない | 鉄則3（論理削除）・再送で古いリンクが生き残らないように |
| P3-D6 | パスワード再設定の受付は、メールアドレスが登録されているかに関係なく**同じ文**を返す（「登録されていれば、再設定のメールを送りました」）。送るのは **status が ACTIVE・deletedAt なし・EXTERNAL でない**人だけ | 登録の有無を外から探られないように |
| P3-D7 | 再設定の受付は、同じ人に **2分以内に2通目を送らない**（直前の未使用トークンの `createdAt` で判定）。返す文は P3-D6 と同じ | メールの連打を止める最小限 |
| P3-D8 | パスワードの決まりは **8文字以上・72バイト以下**（bcrypt が 72 バイトを超えた分を無視するため）。確認用にもう一度入れる。強度の決まり（記号・大文字など）は B-199 | B-199 の範囲を越えない最小限 |
| P3-D9 | 招待の入力は **姓・名・メール・役割**。メールは小文字にそろえて保存する。★既に同じメールの User が居れば（**どの会社でも**・`email` は全体で @unique）、「このメールアドレスは既に使われています」で止める | User の作りに合わせる（§2 で実測） |
| P3-D10 | 招待した User は `status = INVITED` で作る。パスワードは本人が決めるまで無い。★`passwordHash` が NOT NULL なら、**誰も知らない乱数のハッシュ**を入れる（authorize は `status !== "ACTIVE"` で既に弾いているので、入っても入れない） | spec §4-5（INVITED はログインできない） |
| P3-D11 | 招待を受けるページで決めたパスワードを保存するとき、**同じトランザクションで** `passwordHash`・`status = ACTIVE`・`passwordChangedAt`（列があれば）・トークンの `usedAt` を書く。使い終わったトークンは二度と使えない | D-5 |
| P3-D12 | 再設定でパスワードを変えたとき、**同じトランザクションで** `passwordHash`・`failedLoginAttempts = 0`・`lockedUntil = null`・`passwordChangedAt`（列があれば）・`usedAt` を書く。★ログイン中の他の端末を締め出す処理は入れない（B-199） | 最小限 |
| P3-D13 | **Resend の API キーが無いとき**: 本番（`NODE_ENV === "production"`）では送らずに、招待・再送の画面に「メールの送信が設定されていません（運営者に連絡してください）」を出し、User もトークンも作らない（トランザクションを戻す）。dev では送らずに**サーバのコンソールにリンクを出す**（確認用）。★本番ではリンクをどこにも出さない | 慎太郎さんの「無いときは送らずに画面で分かるように」（10:45 の回答に含めた案） |
| P3-D14 | 招待は「メールを送る → 成功したら確定」の順にする。DB の作成（User・トークン）をトランザクションで行い、**送信が失敗したらトランザクションを戻す**。送信の成功後に DB の確定で失敗する逆の場合は起き得ないように、送信を最後に置く（Prisma の interactive transaction の中で送信を呼ぶ・タイムアウトは送信に十分な長さを指定） | 送れていない招待中の人を作らない |
| P3-D15 | 招待中の行の操作は **「招待を再送」だけ**。招待の取り消し（アーカイブなど）は PR-3 では作らない（§9） | spec §3-2「行の操作: 招待中の行「招待を再送」」 |
| P3-D16 | メールの本文は日本語のテキストと、同じ内容の簡単な HTML。件名と本文は §4-6 の文言どおり。テンプレートのライブラリ（react-email など）は入れない | 依存を増やさない |
| P3-D17 | 公開のページ（ログインしていなくても開ける）は3つ: `/invite/[token]`・`/forgot-password`・`/reset-password/[token]`。置き場所はログイン画面と同じルートグループ（§2 で実測）。proxy の「ログイン不要の道」に足す | spec §6 PR-3「招待を受けるページ（proxy.ts:6-8 に追記）」 |
| P3-D18 | AuditLog に残すもの: 招待を送った・招待を再送した・招待を受けた（本人）・パスワードを再設定した（本人）。★再設定の**受付**（メールを送った）は残さない（登録の有無が分かる情報を残さないため）。トークンの生の値は残さない | 既存の AuditLog の書き方に合わせる（§2 で実測） |

### 環境変数（P3-D2）

| 名前 | 既定 | 中身 |
|---|---|---|
| `RESEND_API_KEY` | なし | Resend の API キー（shunya-pms 専用に新しく作る・saagara のキーと共用しない） |
| `MAIL_FROM_ADDRESS` | `noreply@shunya.cc` | 送信元アドレス |
| `MAIL_FROM_NAME` | `PMS` | 送信元の表示名 |
| `INVITE_TOKEN_TTL_HOURS` | `72` | 招待リンクの有効期限（時間） |
| `PASSWORD_RESET_TOKEN_TTL_MINUTES` | `60` | 再設定リンクの有効期限（分） |
| `APP_BASE_URL` | dev は `http://localhost:3001`・本番は**必須**（無ければ送らずにエラー） | メールに書くリンクの頭。本番は `https://shunya-pms-web-production.up.railway.app` |

- 数値の環境変数は、数でない・0 以下なら既定を使う（純関数にしてテストを書く）
- ★`AUTH_URL` / `NEXTAUTH_URL` が既にあれば、それを `APP_BASE_URL` の代わりにせず、別に持つ（§2 で有無を測るだけ）

## §2 RECON（★実装の前に流す・read-only）

### 2-1. 実態の確認

    cd ~/shunya-production-system
    date
    git switch main && git pull --ff-only
    git log --oneline -5
    gh pr list --state open
    git status --porcelain

- 期待: main の先頭に B-252 のマージ（615ded6 以降）・open PR なし・作業ツリーが空

### 2-2. 現物を測る（結果を報告に貼る）

    # ① User の全文（passwordHash の NULL 可否・passwordChangedAt / lockedUntil / failedLoginAttempts の有無）
    awk '/^model User \{/,/^\}/' prisma/schema.prisma
    # ② トークン系の休眠モデルが無いか（名前で推量しない・一覧を目で見る）
    grep -n '^model ' prisma/schema.prisma | grep -i -E 'token|verif|invite|reset|session|email'
    grep -rn 'VerificationToken\|prisma\.session\|prisma\.emailMessage' src/ | head
    # ③ proxy のログイン不要の道
    cat src/proxy.ts
    # ④ ログイン画面の場所と、同じグループのページ
    ls "src/app/(auth)" 2>/dev/null; find src/app -path '*login*' -name 'page.tsx'
    # ⑤ authorize の中身（status の判定・email の小文字化の有無）
    sed -n '40,95p' src/lib/auth.ts
    # ⑥ PR-2 のユーザーの action と画面（招待ボタンを足す場所）
    grep -n 'export async function' src/lib/actions/users.ts
    ls "src/app/(app)/settings/users/"
    # ⑦ AuditLog の書き方（actorUserId の列名・entityType の値）
    awk '/^model AuditLog \{/,/^\}/' prisma/schema.prisma
    grep -n 'auditLog.create' src/lib/actions/users.ts | head -3
    # ⑧ 環境変数の有無（値は出さない・名前だけ）
    grep -o -E '^[A-Z_]+' .env | sort
    # ⑨ migration の運用と最新の名前
    ls prisma/migrations | tail -3
    grep -n '"start"\|"build"' package.json
    # ⑩ 画面の文言で「PR-3」「準備中」「後続」が残っていないか
    grep -rn -E 'PR-3|準備中|後続|招待' "src/app/(app)/settings" "src/app/(auth)" src/components 2>/dev/null | grep -v import

### 2-3. 停止条件（当たったら実装に入らず、測った結果を報告して止まる）

- ②でトークン・招待・再設定のための器が**既に schema にある**（休眠モデルなら受け皿になるかを先に判断する）
- ①で `email` が @unique でない、または User に `companyId` が無い
- ③で proxy が「ログイン不要の道」をパスの一覧以外の形で持っている（足し方が §4-5 と変わる）
- ⑧で `RESEND_*` / `MAIL_*` / `APP_BASE_URL` の名前が既に別の意味で使われている
- open PR がある・main が B-252 より古い

## §3 schema と migration（ADD TABLE ×1・CREATE TYPE ×1）

### 3-1. schema（名前は仮。§2 の結果で既存の命名に合わせる）

    enum UserTokenPurpose {
      INVITE          // 招待
      PASSWORD_RESET  // パスワード再設定
    }

    model UserToken {
      id          String           @id @default(uuid())
      companyId   String           @map("company_id")
      userId      String           @map("user_id")
      purpose     UserTokenPurpose
      tokenHash   String           @unique @map("token_hash") @db.VarChar(64)   // SHA-256 の16進
      expiresAt   DateTime         @map("expires_at")
      usedAt      DateTime?        @map("used_at")
      revokedAt   DateTime?        @map("revoked_at")
      createdByUserId String?      @map("created_by_user_id")                  // 招待した人。再設定は null
      createdAt   DateTime         @default(now()) @map("created_at")

      @@index([companyId, userId, purpose])
      @@map("user_tokens")
    }

- ★house style に合わせる: id の型・`@default`・時刻の型・`@relation` を張るかは、**既存の小さな表（B-123 の締めの表など）と同じ書き方**にする（§2 で手本を1つ選び、報告に書く）
- ★`deletedAt` は持たない（使い終わり＝`usedAt`、無効＝`revokedAt`）。物理削除はしない

### 3-2. migration（手書き・1本）

★このリポジトリでは `prisma migrate dev` を使わない（dev DB に `_prisma_migrations` が無く、DB 全体の reset を要求する）。`prisma migrate reset` と `--accept-data-loss` も使わない・提案しない。

1. 【dev：postgres-development】接続先が `hopper.proxy.rlwy.net:12921` であることを確かめる
2. `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` をドライランで見る
3. `npx prisma db push` で dev に反映する
4. `prisma/migrations/{YYYYMMDD}000100_b205_pr3_user_tokens/migration.sql` を**手書き**する（日付は実装日。§2 ⑨ の最新より後）。冒頭に根拠のコメントを数行（既存の手本に合わせる）
5. 手順2と同じ `migrate diff` を流し、**出力が空**（dev と schema が一致）であることを確かめる。手書きの SQL が prisma の出す SQL と同じ中身であることも見比べる
6. 本番は Railway の `start: prisma migrate deploy` で自動適用（手で流さない）

- 期待する DDL は **CREATE TYPE 1つ・CREATE TABLE 1つ・CREATE INDEX（unique と通常）・外部キー（張る場合のみ）だけ**
- ★停止条件: 手書きの SQL か `migrate diff` の出力に、`user_tokens` と `UserTokenPurpose` 以外への DDL（他の表への ALTER・DROP）が1行でも出たら止める

## §4 実装

### 4-1. 環境変数を読む所（P3-D2）

- 新規 `src/lib/mail/config.ts`（★`src/lib/mail.ts` と `src/lib/mail/` を同時に作らない。`@/lib/auth` と同じ衝突を避ける）
  - `getMailConfig()`: §1 の表の6つを読み、既定で埋めて返す。`apiKey` は無ければ `null`
  - `getAppBaseUrl()`: 本番で無ければ throw（呼び出し側で画面の文に変える）。末尾の `/` は取る
  - 数値の読み取りは純関数（`parsePositiveInt(raw, fallback)`）にしてテストを書く

### 4-2. 送信（P3-D13・D-8）

- `npm install resend`（★バージョンは入れた時点の最新の安定版。package-lock も commit する）
- 新規 `src/lib/mail/send.ts`:
  - `sendMail({ to, subject, text, html })`: 戻り値は `{ ok: true, id } | { ok: false, reason: "NOT_CONFIGURED" | "SEND_FAILED", message }`
  - API キーが無いとき: 本番は `NOT_CONFIGURED`。dev は送らずに `console.info("[mail:dev] to=… subject=…\n" + text)` を出して `{ ok: true, id: "dev-console" }`
  - Resend のエラーは握りつぶさず `SEND_FAILED` で返す（message に Resend の文をそのまま入れない・ログには出す）
- ★B-049・B-219 で使い回すので、招待や再設定の知識を `send.ts` に入れない

### 4-3. トークン（P3-D3〜D-5）

- 新規 `src/lib/user-tokens.ts`:
  - `generateToken()`: `crypto.randomBytes(32).toString("base64url")`
  - `hashToken(raw)`: SHA-256 の16進（純関数・テストあり）
  - `issueUserToken(tx, { companyId, userId, purpose, ttlMs, createdByUserId })`: 同じ人・同じ用途の未使用（`usedAt` も `revokedAt` も null）を `revokedAt = now` にしてから、新しい行を作る。戻り値は生のトークン（★呼び出し側はメール本文にだけ使う）
  - `findValidToken(raw, purpose)`: ハッシュで引き、`usedAt` / `revokedAt` が null・`expiresAt > now` のものだけ返す。期限切れ・使用済みは区別して返す（画面の文を出し分けるため）

### 4-4. 招待（P3-D9〜D-11・D-14・D-15・P2-D3）

`src/lib/actions/users.ts` に足す:

- `inviteUser({ lastName, firstName, email, role })`:
  1. `canManageCompany` でなければ拒否・EXTERNAL 拒否
  2. role は ASSIGNABLE_ROLES のどれか。OWNER なら操作する人が OWNER でなければ拒否（P2-D3）
  3. email は trim → 小文字。形を zod で確かめる
  4. 同じ email の User が（全社で）居れば「このメールアドレスは既に使われています」
  5. トランザクション: User を INVITED で作る（P3-D10）→ `issueUserToken`（INVITE・TTL は `INVITE_TOKEN_TTL_HOURS`）→ AuditLog（P3-D18）→ **最後に** `sendMail`。失敗なら throw してトランザクションを戻す（P3-D14）
  6. 失敗の文: 未設定は「メールの送信が設定されていません（運営者に連絡してください）」・送信失敗は「招待メールを送れませんでした。時間をおいてもう一度試してください」
  7. `revalidatePath("/settings", "layout")`
- `resendInvitation({ userId })`:
  - 権限・同じ会社・相手が INVITED・P2-D3（相手が OWNER ならオーナーだけ）を確かめる
  - トランザクション: `issueUserToken`（前の招待トークンは revoked）→ AuditLog → 最後に送信（失敗なら戻す）
- 画面（`/settings/users`）:
  - 見出しの右に「＋ ユーザーを招待」（オーナー・管理者だけ）。押すとダイアログ: 姓／名／メールアドレス／役割（プルダウン・管理者には「オーナー」を出さない）→「招待メールを送る」
  - 招待中の行の操作に「招待を再送」（確認は挟まない・送ったら「招待メールを送り直しました」）
  - 招待中の行に、最後に送った日時と期限を小さく出す（「3日後まで有効」など・期限切れなら「期限切れ」）。★表示名の取り方は既存の一覧に合わせる

### 4-5. 招待を受けるページ（P3-D11・P3-D17）

- `/invite/[token]`（ログイン不要）:
  - 開いたとき `findValidToken(token, INVITE)`。使えるなら会社名・氏名・メールを出し、パスワードと確認の2欄＋「パスワードを決めてはじめる」
  - 期限切れ: 「この招待リンクの有効期限が切れています。招待した人に再送を頼んでください。」
  - 使用済み・無効・見つからない: 「この招待リンクは使えません。」（区別しない）
  - 送信の action（`acceptInvitation({ token, password, passwordConfirm })`）: もう一度トークンを確かめ、相手の User が INVITED であることを確かめ、P3-D11 を1トランザクションで。成功したら `/login?invited=1` へ
- ★proxy のログイン不要の道に `/invite`・`/forgot-password`・`/reset-password` を足す（§2 ③の形に合わせる）
- ★ログインしている人が開いても使える（ログアウトはさせない）

### 4-6. パスワード再設定（P3-D6〜D-8・D-12・D-17）

- ログイン画面のパスワード欄の下に「パスワードを忘れた方」→ `/forgot-password`
- `/forgot-password`: メールアドレス1欄＋「再設定のメールを送る」。送ったら（登録の有無に関係なく）「登録されていれば、再設定のメールを送りました。メールのリンクは1時間有効です。」★「1時間」は環境変数の値から組み立てる
  - action `requestPasswordReset({ email })`: P3-D6・D-7。送信の失敗も画面には同じ文を返し、サーバのログに残す
- `/reset-password/[token]`: 新しいパスワードと確認の2欄＋「パスワードを変更する」。期限切れ・使えないときの文は §4-5 と同じ形（「この再設定リンクの有効期限が切れています。もう一度、再設定のメールを送ってください。」と「/forgot-password」へのリンク）
  - action `resetPassword({ token, password, passwordConfirm })`: P3-D12。成功したら `/login?reset=1`
- ログイン画面: `?invited=1` なら「パスワードを決めました。ログインしてください。」、`?reset=1` なら「パスワードを変更しました。新しいパスワードでログインしてください。」を上に出す

### 4-7. メールの文言（P3-D16・★件名と本文はこのとおり）

招待:

- 件名: 「【PMS】{会社名} から招待が届いています」
- 本文:

      {氏名} 様

      {招待した人の名前} さんから、PMS（{会社名}）への招待が届いています。
      次のリンクを開いて、パスワードを決めてください。

      {APP_BASE_URL}/invite/{token}

      このリンクの有効期限は {期限の日時（JST）} です。
      期限が切れた場合は、招待した人に再送を頼んでください。

      このメールに心当たりがない場合は、何もせずに破棄してください。
      ※このアドレスは送信専用です。返信はできません。

パスワード再設定:

- 件名: 「【PMS】パスワードの再設定」
- 本文:

      {氏名} 様

      パスワードの再設定を受け付けました。
      次のリンクを開いて、新しいパスワードを決めてください。

      {APP_BASE_URL}/reset-password/{token}

      このリンクの有効期限は {期限の日時（JST）} です。

      再設定をしていない場合は、このメールを破棄してください。パスワードは変わりません。
      ※このアドレスは送信専用です。返信はできません。

- ★会社名は Company の表示名（`companyName`）。期限の日時は JST で「2026/10/06 11:00」の形
- ★本文の組み立ては純関数（`buildInviteMail` / `buildPasswordResetMail`）にしてテストを書く（リンクと期限が入ること・生のトークンがリンクにだけ出ること）

### 4-8. 画面の文言の掃除

- §2 ⑩で見つかった「PR-3」「準備中」「後続」などのコメント・文言を、今の状態に直す（PR-1 / PR-2 で「PR-3 で足す」と書いた所）

## §5 変えないもの

- authorize の中身（`status !== "ACTIVE"` の throw はそのまま。INVITED は今までどおり入れない）
- D-6 の読み直し（auth.ts の jwt callback）
- 役割と権限・停止／再開／アーカイブ（PR-2）
- ログイン画面のエラーの文（停止の人の専用の文は §9）
- MASTER_ADMIN・tenantType 軸（B-242）・EXTERNAL（B-172）

## §6 確認（dev・http://localhost:3001・hopper:12921）

★このブランチに `git switch` してから `PORT=3001 npm run dev`（動いている dev サーバは止めて起動し直す）。
★Resend のキーを dev の `.env` に入れるかで2通り。**最初はキー無し（コンソールにリンクが出る）で確かめ、最後にキーありで実際に1通だけ送る。**
★宛先は慎太郎さんが受け取れるアドレス（Gmail の `+` 付きなど）を使う。`example.test` には届かない。

1. キー無し: オーナーで `/settings/users` →「＋ ユーザーを招待」→ 姓・名・メール（例 `shintaro1012+pms1@gmail.com`）・役割「一般スタッフ」→ 送る → 一覧に「招待中」で出る。dev サーバのコンソールに招待の本文とリンクが出る
2. そのリンクを別のブラウザ（シークレット）で開く → 会社名・氏名・メールが出る。8文字未満・確認と不一致はエラー → 正しく入れる → `/login?invited=1` の文 → そのアドレスでログインできる。一覧で「有効」になる
3. 同じリンクをもう一度開く →「この招待リンクは使えません。」
4. もう1人招待 →「招待を再送」→ コンソールに新しいリンク。**古いリンクは「使えません」・新しいリンクは使える**
5. 同じメールでもう一度招待 →「このメールアドレスは既に使われています」
6. 管理者（dev-admin@example.test）でログイン → 招待の役割に「オーナー」が出ない。見るだけの人（一般スタッフ）には「＋ ユーザーを招待」「招待を再送」が出ない
7. ログイン画面 →「パスワードを忘れた方」→ 登録のあるアドレス → 決まった文が出て、コンソールにリンク。登録の無いアドレス → **同じ文**で、コンソールに何も出ない
8. 同じアドレスで続けて受付 → 2分以内の2通目はコンソールに出ない（文は同じ）
9. 再設定のリンク → 新しいパスワード → `/login?reset=1` の文 → 新しいパスワードで入れる・古いパスワードでは入れない
10. 期限切れ: dev の `.env` で `PASSWORD_RESET_TOKEN_TTL_MINUTES=1` にして再起動 → 受付 → 2分待ってリンク →「有効期限が切れています」。★確認後に `.env` から消して再起動
11. 【dev：postgres-development】read-only で `select purpose, (used_at is not null) used, (revoked_at is not null) revoked, count(*) from user_tokens group by 1,2,3;` → 使った・無効にした・残っている数が、上の操作と合う。`token_hash` が64文字で、生のトークン（リンクの末尾）と一致しないことを1件見る
12. AuditLog に招待・再送・受諾・再設定が残り、トークンの生の値が入っていない
13. キーあり: dev の `.env` に `RESEND_API_KEY`（dev 用のキー）を入れて再起動 → 自分のアドレスへ招待を1通 → **実際に届く**。送信元が「PMS <noreply@shunya.cc>」・件名・本文・リンクが §4-7 のとおり。迷惑メールに入っていないか見る
14. `npx tsc --noEmit`・触ったファイルの lint・テストが通る。全体 lint の error が 11 から増えていない

## §7 Git / PR

- ブランチ: `feat/b205-pr3-mail-invite-reset`
- 本ブリーフを `docs/specs/b-205-pr3-implementation-brief-2026-10-03.md` として同じ PR に入れる
- 型・触ったファイルの lint がクリーンで、テストが通れば、commit → push → PR open まで自走してよい。マージは慎太郎さん
- PR 本文に書くこと: 足した環境変数の表・本番でマージ前に入れる環境変数（§8）・migration の SQL 全文・§2 の RECON の結果の要約
- commit の末尾:

      Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
      Claude-Session: https://claude.ai/code/session_01M12GEhsLtkq9SFWuc7XUAi

- PR 本文の末尾:

      🤖 Generated with [Claude Code](https://claude.com/claude-code)

      https://claude.ai/code/session_01M12GEhsLtkq9SFWuc7XUAi

## §8 本番への影響と手順（★マージ＝本番反映＝不可逆）

- schema: ADD TABLE ×1・CREATE TYPE ×1（非破壊・既存の表に触らない）。Railway の `migrate deploy` で自動適用
- ★**マージの前に**、本番の環境変数を入れる（入れないままマージすると、招待は「送信が設定されていません」で止まるだけで壊れはしない）:
  1. Resend で API キーを作る: 名前 `shunya-pms-production`・権限 Sending access・ドメイン shunya.cc（dev 用は別に `shunya-pms-dev` を作る）
  2. Railway の **shunya-pms-web**（本番のサービス）の Variables に `RESEND_API_KEY` と `APP_BASE_URL=https://shunya-pms-web-production.up.railway.app` を入れる。`MAIL_FROM_*`・`*_TTL_*` は既定でよければ入れない
  3. ★キーは本番の Variables と dev の `.env` にだけ置く。チャット・PR・コードに貼らない
- マージ後: 本番の `/settings/users` に「＋ ユーザーを招待」が出ること、ログイン画面に「パスワードを忘れた方」が出ることを見る。★本番で試しに招待するなら、自分の別アドレスへ1通だけ。試した招待中の人は残る（取り消しは §9）ので、試すかどうかは慎太郎さんが決める
- ★本番の users・companies には書き込まない（migration は新しい表を作るだけ）

## §9 今回やらないこと（行き先）

| 内容 | 行き先 |
|---|---|
| 招待の取り消し（招待中の人をアーカイブするなど） | 未起票（締めで BACKLOG を grep して起票） |
| パスワード変更でログイン中の他の端末を締め出す | B-199 |
| パスワードの強度の決まり・ログイン履歴・不正検知 | B-199 |
| 自分のプロフィール（表示名・パスワードの変更） | B-244 |
| 停止の人がログインしようとしたときの専用の文言 | 未起票（PR-2 §9 から持ち越し） |
| 送信元をテナントごとに変える（ホワイトラベル）・運営者用の管理画面 | B-242 |
| 送信用サブドメインへの切り替え・ドメイン移管 | 環境変数 `MAIL_FROM_ADDRESS` と Resend・DNS の設定で行う（コード変更なし） |
| 発注書・請求書のメール送付 | B-049・B-219（本 PR の `src/lib/mail/` を使う） |
| メールの到達・開封の記録（Resend の webhook） | 未起票（B-049 の設計時に判断） |

END-OF-BRIEF-B205-PR3
