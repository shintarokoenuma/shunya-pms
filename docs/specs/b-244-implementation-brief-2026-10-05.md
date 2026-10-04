# B-244 実装ブリーフ — 自分のプロフィール（名前・パスワードの変更）（2026-10-05）

- 対象: shunya-pms・main `9889396`（CLOSE-AI）を claude.ai 側で直接読んで作成（2026-10-05 00:0x〜00:2x JST）
- 根拠: BACKLOG B-244（B-205 spec v1.0 §8 R-9）・慎太郎さんの回答（ナレッジ claude/MEMO_INBOX-append-2026-10-05.md）
  - 00:07「スタッフの件は、近づいたら確認するので、設計を進めましょう。」
  - 00:13「A. 切る」（パスワードを変えたら、ほかの端末のログインも切る）
- schema・migration: **なし**（User の lastName・firstName・displayName・passwordHash・passwordChangedAt を使う）

## 1. 現状（main 9889396 の現物）

- ユーザーメニュー `src/components/app-shell/user-menu.tsx` の「プロフィール」は `DropdownMenuItem disabled`
- ヘッダーの名前は `session.user.name`。`src/lib/auth.ts` の authorize で `name: user.displayName` を焼くだけで、jwt コールバックは role・status・companyId・deletedAt しか読み直さない → 名前を変えてもログインし直すまで出ない。displayName が null（招待で入った人）だと app-shell.tsx がメールの @ の前を出す
- パスワードの規則: `src/lib/validators/user-management.ts` の passwordField（8文字以上・72バイト以下・強度は B-199）。bcryptjs・コスト 12（password-reset.ts）
- 再設定（password-reset.ts）と招待の受諾（invitations.ts）は passwordChangedAt を書くが、jwt は passwordChangedAt を見ていない → パスワードを変えても、ほかの端末のログインは残る
- 名前の出し方は users.ts の personName（displayName ?? "姓 名"）
- ログイン画面 `src/app/(auth)/login/page.tsx` は ?invited=1 / ?reset=1 で上に文を出す作り

## 2. 決定事項

- **D-1 画面は /profile**（新規 `src/app/(app)/profile/page.tsx`）。ログインしている人なら誰でも開ける（役割と権限の対象外）。「設定」の下に置かない（設定は「オーナーと管理者だけが変更できます」の画面のため）。ユーザーメニューの「プロフィール」を /profile へのリンクにする
- **D-2 名前**: 姓（必須・100文字以内）・名（必須・100文字以内）・表示名（任意・200文字以内・空なら null）。表示名が null なら「姓 名」を出す。メールアドレス・役割は表示だけ（変えられない）
- **D-3 名前はすぐ画面に出る**: jwt コールバックの読み直しに displayName・lastName・firstName を足し、`token.name = displayName ?? "姓 名"`。session コールバックで `session.user.name = token.name`。authorize の `name` も同じ式にする（ログイン直後から「姓 名」が出る）
- **D-4 パスワード**: 今のパスワード・新しいパスワード・確認用の3つ。新しいパスワードの規則は passwordField と同じ。今のパスワードが違えば「今のパスワードが違います」。新しいものが今と同じなら「今と同じパスワードです」。bcrypt コスト 12。passwordChangedAt を今にする。AuditLog（UPDATE・afterData は passwordChangedAt だけ・ハッシュは残さない）
- **D-5 パスワードを変えたら全端末のログインを切る**（00:13「A. 切る」）:
  - ログインした時刻を token に持つ: jwt で `user` があるとき（ログイン直後）`token.loginAt = Date.now()`
  - 読み直しのたびに、`row.passwordChangedAt` が `token.loginAt` より後なら null（＝ログアウト）
  - token に loginAt が無い（このデプロイ前からログインしている人）は、その場で `token.loginAt = Date.now()` として扱い、締め出さない（デプロイで全員がログアウトしないように）
  - 判定は純関数（例 `src/lib/session-validity.ts` の `isSessionStale(passwordChangedAt, loginAt)`）に出してテストする
  - 効き目はメールでの再設定（password-reset.ts）・招待の受諾にも同じく付く（受諾はログイン前なので影響なし）
  - 変えた本人: 保存に成功したら画面から `signOut({ callbackUrl: "/login?passwordChanged=1" })`。ログイン画面は ?passwordChanged=1 で「パスワードを変更しました。新しいパスワードでログインしてください。」を出す（?reset=1 と同じ作り）
- **D-6 本人だけ**: action は userId を受け取らない。`session.user.id` と `companyId`・`deletedAt: null`・`status: ACTIVE` で行を引く（AGENTS.md）
- **D-7 作らないもの**: メールアドレスの変更・言語・タイムゾーン・電話・アイコン画像・今のパスワードを何度も間違えたときの制限（B-255 で扱う）・パスワードの強度（B-199）

## 3. 作るもの・変えるもの

### 3-1. validator `src/lib/validators/user-management.ts`
- `updateMyProfileSchema`（lastName・firstName・displayName。trim。displayName の空文字は null に）
- `changeMyPasswordSchema`（currentPassword・password（passwordField）・passwordConfirm。確認の不一致は既存の PASSWORD_MISMATCH）

### 3-2. action 新規 `src/lib/actions/profile.ts`（"use server"）
- `getMyProfile()`: email・lastName・firstName・displayName・role を返す
- `updateMyProfile(input)`: D-2・D-6。AuditLog（UPDATE・before/after は名前の3列）。`revalidatePath("/", "layout")`
- `changeMyPassword(input)`: D-4・D-6。成功で `{ ok: true }`（サインアウトは画面側）
- ★"use server" のファイルから文字列の定数を export しない

### 3-3. 認証 `src/lib/auth.ts`
- D-3・D-5。select に displayName・lastName・firstName・passwordChangedAt を足す。型（next-auth の型拡張）に loginAt を足す

### 3-4. 画面
- 新規 `src/app/(app)/profile/page.tsx`（server）と `_components/profile-name-form.tsx`・`_components/change-password-form.tsx`（client）。見出し「プロフィール」。カード2枚（「名前」・「パスワード」）。メール・役割は名前のカードの上に表示だけ
- `user-menu.tsx`: 「プロフィール」を `asChild` で `<Link href="/profile">` に
- `src/app/(auth)/login/page.tsx`: ?passwordChanged=1 の文

### 3-5. テスト（`src/lib/user-management.test.ts` に ⑫ を足すか、新規 `src/lib/session-validity.test.ts`）
1. passwordChangedAt が null → 切らない
2. passwordChangedAt < loginAt → 切らない／passwordChangedAt > loginAt → 切る
3. updateMyProfileSchema: 姓・名が空は NG、表示名の空文字は null、101文字は NG
4. changeMyPasswordSchema: 7文字は NG、確認の不一致は NG

## 4. 確認（dev・localhost:3001）
★確認用ユーザーのパスワードは `<新しいパスワード>`（< と > を含む）。
1. 一般スタッフ（dev-staff）で右上のメニュー →「プロフィール」で /profile が開く。表示名を「スタッフ太郎」にして保存 → **ログインし直さずに**右上の名前が「スタッフ太郎」になる。表示名を空にして保存 → 「姓 名」に戻る
2. 同じ dev-staff を、別のブラウザ（シークレットウィンドウ）でもログインしておく
3. 最初のウィンドウでパスワードを変える（今のパスワードを間違えると「今のパスワードが違います」）→ 成功するとログイン画面へ戻り「パスワードを変更しました…」が出る
4. 別のウィンドウで Cmd+R → ログイン画面へ戻る（ほかの端末も切れた）
5. 新しいパスワードでログインできる。古いパスワードでは入れない
6. ★確認後、dev-staff のパスワードを `<新しいパスワード>` に戻す（プロフィールの画面で戻すか、scripts/dev-create-test-users.ts を流し直す）
7. オーナー・管理者でログインしたまま、デプロイ前からのセッションが切れないこと（dev サーバを再起動しても、ログイン中の画面が使い続けられる）

## 5. 本番への影響
- マージ＝Railway の main 自動デプロイ＝本番反映（不可逆）
- migration なし。デプロイ後もログイン中の人は切れない（D-5 の loginAt なしの扱い）
- 本番のオーナーの表示名「Shin」は、マージ後にオーナー本人が /profile で変えられる

## 6. 作業の約束
- ブランチ `feat/b244-my-profile`（main `9889396` から）。PR 必須
- `npx tsc --noEmit`・触ったファイルの lint・テスト・`npx next build`（3001 の dev を止めて実行 → `.next` を消す → このブランチで dev を 3001 で起動し直す。止めてよい＝慎太郎さん了承済み）が通れば commit → push → PR open まで。マージは慎太郎さん
- 新しいクエリは companyId と deletedAt: null を手書き（AGENTS.md）。User は TENANT_MODELS の対象外
- 本書を `docs/specs/b-244-implementation-brief-2026-10-05.md` として PR に同梱する

## 7. 本 PR で作らないもの
- D-7 の各項目（B-255・B-199 はそれぞれの番号で）
- 管理者がほかの人の名前を変える機能（今は招待の時に決めるだけ）

END-OF-BRIEF-B244
