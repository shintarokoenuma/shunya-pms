# B-205 PR-2 実装ブリーフ（ユーザー・役割と権限・画面を開くたびの役割の読み直し・判定の一本化）2026-09-27

- 識別子: B205-PR2
- 上位: `docs/specs/b-205-settings-spec-confirmation-v1_0-2026-09-27.md`（SETTINGS-V10・D-1〜D-24）
- 前の PR: #173（PR-1・squash a79428e・マージ済み）
- 根拠の実測: RECON-R14（2026-09-27 23:13・23:20）/ RECON-PR2（23:29）。いずれも main a79428e・read-only・dev hopper:12921
- 一次資料（画面）: 参考画面「PMS 設定ページ 参考画面」案B（Version 2・「役割と権限」を含む） https://claude.ai/artifact/XrcQWHt5WWsnJGQXcCNpUB
- ブランチ: `feat/b205-pr2-users-roles`（main から切る。main 直 push 禁止）

---

## §0 この PR でやること（4行）

1. 役割と状態を、画面を開くたびに DB から読み直す（D-6）。停止・アーカイブの人は、次に画面を開いたときにログアウトさせる
2. 設定ページの目次に「ユーザー」を足す。一覧・役割の変更・停止／再開／アーカイブ／停止に戻す（D-17・D-18・D-19・R-10）
3. 設定ページの目次に「役割と権限」を足す。設定の4項目を、役割ごとに「見る／隠す」で切り替える（D-13・D-16・D-20）
4. 「オーナー・管理者か」の判定2か所を1つの関数にまとめる（spec §5-1）

schema 変更なし（D-20）。メール送信なし（招待は PR-3）。

## §1 確定事項

### spec v1.0 から（本 PR で効くもの）

| D | 内容 |
|---|---|
| D-6 | 画面を開くたびに User の行で role・status を確かめる。役割の変更と停止は、次に画面を開いた時点で効く |
| D-11 | オーナー・管理者以外は既定で「見るだけ」。役割ごとに見せる・隠すを選べる |
| D-13 | 「役割と権限」は行＝項目・列＝役割。オーナー・管理者の列は「変更できる」で固定。他の役割は1マスずつ「見る／隠す」。表を変えられるのはオーナー・管理者だけ |
| D-14 | 役割の選択肢は7つ（オーナー・管理者・生産管理・経理・営業・デザイナー・一般スタッフ）。EXTERNAL は出さない |
| D-16 | 「役割と権限」が未設定なら、4項目とも全員「見る」 |
| D-17 | 最後のオーナーは、役割の変更・停止・アーカイブができない。自分の役割は自分で変えられない |
| D-18 | 使わなくなった人は停止／再開が基本。アーカイブ（一覧から隠す）も足す。`UserStatus.ARCHIVED` を使う。deletedAt は使わない |
| D-19 | 「見るだけ」の人には、ユーザーのメールと最終ログインを見せない（画面でも action の戻り値でも） |
| D-20 | 役割と権限は `CompanySetting.securitySettings.rolePermissions` に置く。他のキーは残したまま書き戻す。行が無い・未設定なら D-16 |

### 本ブリーフで決めたこと（P2-D）

| D | 内容 | 根拠 |
|---|---|---|
| P2-D1（R-14） | 読み直しは `src/lib/auth.ts` の `callbacks.jwt` の1か所に置く。ログイン直後（`user` がある時）以外の呼び出しで、`prisma.user.findUnique({ where: { id: token.id }, select: { role, status, companyId, deletedAt } })` を1回読む。行が無い・`deletedAt` がある・`status !== "ACTIVE"`・`companyId` が token と違う、のどれかなら **`null` を返す**（ログアウト）。それ以外は `token.role = row.role` に書き換えて返す | RECON-R14: proxy.ts は `auth()` の wrapper で `req.auth` の有無だけ見る。role を読む所は全部 `session.user.role` 経由。runtime の宣言は無し（既定）。`jwt` の戻り値の型は `Awaitable<JWT \| null>`（@auth/core 0.41.2 index.d.ts・next-auth 5.0.0-beta.31・next 16.2.6） |
| P2-D2（R-10） | 状態の変更は次の4つだけ。これ以外はサーバで拒否する: 有効→停止（「停止」）／停止→有効（「再開」）／停止→アーカイブ（「アーカイブ」）／アーカイブ→停止（「停止に戻す」）。招待中の行は PR-2 では操作なし | R-10 の回答（2026-09-27 23:0x）: 「停止の人だけ（推奨）」「停止に戻す（推奨）」「「アーカイブ」で統一（推奨）」 |
| P2-D3 | オーナーに関わる操作（誰かをオーナーにする・オーナーの役割を変える・オーナーを停止／アーカイブ／再開／停止に戻す）は **オーナーだけ**。管理者はオーナー以外の人を扱える。管理者の役割のプルダウンに「オーナー」を出さず、オーナーの行は操作なし | 回答「オーナーだけ（推奨）」（2026-09-27 23:3x） |
| P2-D4 | 「最後のオーナー」＝同じ会社に、その人以外の **有効（ACTIVE）かつ deletedAt なし** のオーナーが0人。この人をオーナー以外にする・停止・アーカイブするのを拒否する。判定と更新は同じトランザクションで行う。★注: P2-D3（オーナーを動かせるのはオーナーだけ）と D-17（自分は変えられない）により、操作する人自身が「有効なオーナー」として必ず残るので、この拒否は今の画面・action の経路では起きない。将来の経路（PR-3 以降・B-242）への備えとして残し、純関数のテストで確かめる | D-17 |
| P2-D5 | 判定の一本化: 新規 `src/lib/permissions.ts` に `canManageCompany(role: UserRole \| string \| null \| undefined): boolean`（OWNER / ADMIN）。`canManageCompanySettings`（src/lib/types/ui-preferences.ts:23）と `canReopenPeriod`（src/lib/period-close/lock.ts:42）を消し、呼び出し6か所を置き換える。★`src/lib/auth/` というディレクトリは作らない（`src/lib/auth.ts` と `@/lib/auth` の解決がぶつかる） | spec §5-1。RECON-PR2 の呼び出し元: closings/page.tsx:47・period-closes.ts:519・company-settings.ts:78,95・company-profile.ts:96,112,171 |
| P2-D6 | 役割と状態の日本語名を新規 `src/lib/constants/user-roles.ts` に置く。`ROLE_LABELS`（OWNER オーナー／ADMIN 管理者／PRODUCTION 生産管理／ACCOUNTING 経理／SALES 営業／DESIGNER デザイナー／STAFF 一般スタッフ／EXTERNAL 社外ユーザー）・`ASSIGNABLE_ROLES`（EXTERNAL を除く7つ）・`STATUS_LABELS`（ACTIVE 有効／INVITED 招待中／SUSPENDED 停止／ARCHIVED アーカイブ） | RECON-PR2: 役割の表示名の定義は src に0件 |
| P2-D7 | 役割と権限の形: `securitySettings.rolePermissions.settings.{company\|bank\|users\|display}.{PRODUCTION\|ACCOUNTING\|SALES\|DESIGNER\|STAFF} = "view" \| "hidden"`。キーが無ければ "view"（D-16）。OWNER / ADMIN は保存しない（常に変更できる）。★B-243（仮）で `settings` と並ぶ名前空間（cost・billing など）を足せる形にする | spec §4-3・D-12 |
| P2-D8 | 「隠す」にした項目: 目次に出さない・その URL を開いたら見える最初の項目へ redirect（見える項目が「役割と権限」だけならそこへ）・設定ページ用の読み取り action も拒否する。★**品番カルテのメモの表示設定（`getMemoUiPreferences`）は止めない**（カルテは設定ページではない） | spec §5-2 |
| P2-D9 | 「役割と権限」の画面そのものは表の行に無い。オーナー・管理者は変更でき、それ以外の人は **見るだけ**（D-11 の既定）で出す | D-11・D-13 |
| P2-D10 | ユーザー一覧に出すのは、同じ会社で `deletedAt` なし・role が EXTERNAL でない・`isExternalUser` が false の人。アーカイブの人は既定で出さず、「アーカイブも表示」をオンにしたときだけ出す（URL は `?archived=1`） | D-14・D-18・B-172 |
| P2-D11 | 「停止」と「アーカイブ」は確認を挟む（「再開」「停止に戻す」は挟まない）。役割はプルダウンを変えた時点で保存する | モック文言「「停止」は確認を挟みます。」。アーカイブは Claude の判断（一覧から消える操作なので停止に揃えた） |
| P2-D12 | 「＋ ユーザーを招待」「招待を再送」は PR-2 では **出さない**（押せないボタンを置かない・P1-D4 と同じ考え）。PR-3 で出す | spec §3-2「PR-3 まで動かない」 |
| P2-D13 | dev の確認用ユーザーを作るスクリプトを足す（§4-8）。接続先が dev（hopper.proxy.rlwy.net:12921）でなければ何もせず exit 1 | RECON-PR2: dev のユーザーはオーナー1人だけで、役割の変更・停止・最後のオーナーを確かめられない |

### spec v1.0 の記述の訂正（本 PR で記録するだけ）

- §4-5「B-202 D-19 の `fetchUserSummariesByIds` は deletedAt で絞らない」→ **この関数は実在しない**（RECON-PR2 で0件・名前違いの export も無し）。名前は各所で `displayName ?? \`${lastName} ${firstName}\`` と組んでいる（comments.ts:94・clients.ts:547・sewing-spec-data.ts:146）。アーカイブは deletedAt を触らないので、過去のメモ・担当者の名前は残る、という結論は変わらない

## §2 現物（RECON-R14・RECON-PR2・main a79428e）

### 2-1. 認証

- `src/lib/auth.ts`（113行）: `PrismaAdapter(prisma)`・`session: { strategy: "jwt" }`・`pages.signIn = "/login"`
  - authorize（:46-90）: email で User を読む → `status !== "ACTIVE"` なら throw → bcrypt → 失敗で `failedLoginAttempts+1`／成功で reset＋`lastLoginAt` → `{ id, email, name: displayName, companyId, tenantType, role }`
  - `callbacks.jwt`（:94-101）: `if (user)` の時だけ token に id / companyId / tenantType / role を入れる
  - `callbacks.session`（:103-110）: token から session.user へ写す（DB は読まない）
  - ★authorize は `deletedAt` を見ていない（P2-D1 の jwt では見る）
- `src/proxy.ts`: `export default auth((req) => …)`。`req.auth` が無ければ `/login` へ。role・status は読まない
- ログイン画面（`src/app/(auth)/login/page.tsx:26-30`）: `result?.error` なら「メールアドレスまたはパスワードが正しくありません」。停止の人も同じ文になる（★本 PR では変えない・§9）

### 2-2. User

- 列: companyId / email @unique / passwordHash / firstName / lastName / displayName? / role（既定 STAFF）/ isExternalUser / status（既定 ACTIVE）/ lastLoginAt? / deletedAt? ほか。`@@index([companyId, role])`・`@@index([companyId, status])`
- enum UserRole: OWNER / ADMIN / PRODUCTION / ACCOUNTING / SALES / DESIGNER / STAFF / EXTERNAL
- enum UserStatus: ACTIVE / INVITED / SUSPENDED / ARCHIVED
- User を書き込むのは auth.ts:66・:74 だけ（role・status を変える経路は0件）
- dev: `shunya-master-tenant-id` に OWNER・ACTIVE の1人だけ

### 2-3. 判定と設定

- `src/lib/types/ui-preferences.ts:21-24` `COMPANY_SETTING_MANAGER_ROLES = ["OWNER","ADMIN"]`・`canManageCompanySettings(role: string | null | undefined)`
- `src/lib/period-close/lock.ts:40-43` `PERIOD_REOPEN_ROLES`・`canReopenPeriod(role: UserRole | null | undefined)`
- `securitySettings` を読み書きする所は0件。既定は `src/lib/company-setting-defaults.ts:16` の `{}` だけ（`COMPANY_SETTING_REQUIRED_JSON_DEFAULTS`・必須 Json 7本）

### 2-4. 設定ページ（PR-1）

- `src/app/(app)/settings/layout.tsx`: `auth()` → 未ログインは `/login`・EXTERNAL は `/dashboard`。h1「設定」＋説明＋`<SettingsNav />`＋children
- `src/app/(app)/settings/_components/settings-nav.tsx`（client）: `SETTINGS_NAV_ITEMS` は定数3つ（company / bank / display）
- 手本の action: `src/lib/actions/company-profile.ts`（`requireSession`:31 → EXTERNAL 拒否 → `canManageCompanySettings` → 書き込み → `prisma.auditLog.create`:141,189 → `revalidatePath("/settings", "layout")`:154,205）

## §3 schema と migration

- **変更なし**（D-20）。`prisma/schema.prisma` と `prisma/migrations/` に触らない
- ★完了の条件: `git diff main --stat -- prisma/` が空

## §4 実装

### 4-1. 画面を開くたびの読み直し（P2-D1）

`src/lib/auth.ts` の `callbacks.jwt` を次の形にする（形を示す。細部は実装で整える）:

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.companyId = …; token.tenantType = …; token.role = …
        return token
      }
      if (!token.id) return null
      const row = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { role: true, status: true, companyId: true, deletedAt: true },
      })
      if (!row || row.deletedAt || row.status !== "ACTIVE" || row.companyId !== token.companyId) return null
      token.role = row.role
      return token
    }

- `session` callback は変えない（token を写すだけ）
- ★1回の画面表示で `auth()` は proxy・layout・page・action から複数回呼ばれ、そのたびに主キーで1行読む。今の人数では問題にしない（§9 に記録）
- ★`null` を返したあとは `req.auth` も `auth()` も空になる。proxy が `/login` へ送る。`(app)` の layout が未ログインで `/login` へ送ることも §6 で確かめる

### 4-2. 判定の一本化（P2-D5）

- 新規 `src/lib/permissions.ts`:
  - `MANAGER_ROLES = ["OWNER", "ADMIN"] as const`
  - `canManageCompany(role): boolean`
  - `isOwner(role): boolean`
- `canManageCompanySettings`・`COMPANY_SETTING_MANAGER_ROLES`・`canReopenPeriod`・`PERIOD_REOPEN_ROLES` を消し、呼び出しを `canManageCompany` に置き換える
- ★完了の条件: `grep -rn "canManageCompanySettings\|canReopenPeriod\|COMPANY_SETTING_MANAGER_ROLES\|PERIOD_REOPEN_ROLES" src` が **0件**（陽性対照: main で同じ grep を流すと呼び出し元を含めて 10 行以上出る）
- ★ほかの export が同じファイル（ui-preferences.ts・lock.ts）から使われているので、ファイルごと消さない

### 4-3. 役割と状態の名前（P2-D6）

新規 `src/lib/constants/user-roles.ts`: `ROLE_LABELS`・`ASSIGNABLE_ROLES`・`STATUS_LABELS`・設定ページで切り替えられる役割 `CONFIGURABLE_ROLES = ["PRODUCTION","ACCOUNTING","SALES","DESIGNER","STAFF"]`

### 4-4. 役割と権限（D-13・D-16・D-20・P2-D7〜D-9）

- 新規 `src/lib/settings-visibility.ts`（名前は仮）:
  - `SETTINGS_SECTIONS = ["company","bank","users","display"] as const`
  - `getRolePermissions(companyId)`: CompanySetting を読み、`securitySettings.rolePermissions` を形を確かめて取り出す（壊れた値・未設定は空＝全員「見る」）
  - `canSeeSettingsSection(perms, role, section)`: OWNER / ADMIN は常に true。それ以外は `perms.settings?.[section]?.[role] !== "hidden"`
  - 純関数の部分はテストを書く（`*.test.ts`・既存の company-issuer.test.ts と同じ書き方）
- 新規 action `src/lib/actions/role-permissions.ts`:
  - `getRolePermissionsView()`: 誰でも読める（EXTERNAL は拒否）。`canManage` を返す
  - `updateRolePermissions(input)`: `canManageCompany` でなければ拒否。zod で形を確かめる（キーは SETTINGS_SECTIONS × CONFIGURABLE_ROLES・値は "view" | "hidden"）。**今の securitySettings の他のキーを残したまま** `rolePermissions` だけ書き換えて upsert（create 側は `COMPANY_SETTING_REQUIRED_JSON_DEFAULTS` で埋める・B-202 PR-4 と同じ）。AuditLog に前後の値。`revalidatePath("/settings", "layout")`
- 画面 `src/app/(app)/settings/roles/page.tsx`: 文言は §4-7

### 4-5. 目次と「隠す」の効かせ方（P2-D8）

- `settings/layout.tsx` で `getRolePermissions` と `session.user.role` から見える項目を決め、`<SettingsNav items={…} />` に渡す。`settings-nav.tsx` は定数ではなく props の items を描く
- 目次の並び（spec §3-1）: 自社情報・振込先・ユーザー・表示設定・役割と権限
- 各項目のページ（company / bank / users / display）の先頭で、見えなければ見える最初の項目へ `redirect`。`/settings` の redirect 先も見える最初の項目にする
- 設定ページ用の読み取り action（`getCompanyProfile`・ユーザー一覧）も、見えない項目なら拒否する
- ★`getMemoUiPreferences`（品番カルテ）には入れない

### 4-6. ユーザー（D-17〜D-19・P2-D2〜D-4・P2-D10〜D-12）

新規 action `src/lib/actions/users.ts`:

- `listCompanyUsers({ includeArchived })`: P2-D10 の条件。並びは状態（有効→招待中→停止→アーカイブ）→名前。返す項目は id・名前（`displayName ?? 姓 名`）・role・status・isSelf。**`canManageCompany` のときだけ** email・lastLoginAt を足す（D-19・戻り値から落とす）
- `updateUserRole({ userId, role })`:
  - `canManageCompany` でなければ拒否
  - 自分なら拒否（D-17）
  - 相手が同じ会社・EXTERNAL でない・deletedAt なし、を確かめる
  - 新しい role は ASSIGNABLE_ROLES のどれか
  - 相手が OWNER、または新しい role が OWNER なら、操作する人が OWNER でなければ拒否（P2-D3）
  - 相手が OWNER で新しい role が OWNER 以外なら、最後のオーナーか調べる（P2-D4・同じトランザクション）
- `changeUserStatus({ userId, action: "suspend" | "resume" | "archive" | "unarchive" })`:
  - 上と同じく、権限・自分・同じ会社・P2-D3 を確かめる
  - 遷移は P2-D2 の4つだけ（純関数 `nextUserStatus(from, action)` を作りテストを書く）
  - suspend / archive で相手が OWNER なら最後のオーナーか調べる（P2-D4）
- どれも AuditLog に前後の値（entityType は既存の書き方に合わせる・company-profile.ts を見る）・`revalidatePath("/settings", "layout")`
- 失敗の文言は利用者に分かる日本語で1文ずつ（例「最後のオーナーは変更できません」「自分の役割は変更できません」「オーナーの変更はオーナーだけができます」）

画面 `src/app/(app)/settings/users/page.tsx` ＋ 一覧の部品:

- 列: 名前／メール／役割／状態／最終ログイン／（操作）。見るだけの人にはメール・最終ログインの列を出さない
- 役割: 変更できる行はその場のプルダウン（ASSIGNABLE_ROLES・管理者が見るときは「オーナー」を出さない）。変更できない行は文字だけ
- 状態: バッジ「有効」「招待中」「停止」「アーカイブ」
- 操作: 有効「停止」／停止「再開」「アーカイブ」／アーカイブ「停止に戻す」／招待中は操作なし／自分の行は「自分」／管理者から見たオーナーの行は操作なし
- 切り替え「アーカイブも表示」（`?archived=1`）
- 見るだけの人にはプルダウン・操作・確認を出さない（action でも拒否）

### 4-7. 画面の文言（★モック案B の原文・spec v1.0 §3-2。R-10 で決めた名前を足す）

- 目次: 「ユーザー」／「招待・役割・停止」、「役割と権限」／「役割ごとに見せる・隠す」
- ユーザー: 見出し「ユーザー」。注記「役割のプルダウン：オーナー・管理者・生産管理・経理・営業・デザイナー・一般スタッフ（社外ユーザーは出しません）」。注記「役割はその場のプルダウンで変えます。「停止」は確認を挟みます。」
- ボタン: 「停止」「再開」「アーカイブ」「停止に戻す」。自分の行「自分」。切り替え「アーカイブも表示」
- 役割と権限: 見出し「役割と権限」・説明「役割ごとに、見せる項目と隠す項目を選びます。オーナーと管理者だけが変えられます」
  - 表の列: 項目／オーナー／管理者／生産管理／経理／営業／デザイナー／一般スタッフ
  - オーナー・管理者の列は「変更できる」（固定）。ほかは「見る／隠す」
  - 行: 自社情報・振込先・ユーザー・表示設定（★モックの網掛けの行＝原価・請求・入金・発注は出さない・B-243）
  - ボタン「保存」・注記「変えた設定は、その役割の人が次に画面を開いたときに効きます」
- ★「＋ ユーザーを招待」「招待を再送」は出さない（P2-D12）
- ★既存画面の文言の確認: `grep -rn -E "準備中|後続|PR-2|オーナーと管理者" "src/app/(app)/settings" src/components` を流し、PR-1 のコメント（settings-nav.tsx の「PR-2 で足す」など）を今の状態に直す

### 4-8. dev の確認用ユーザー（P2-D13）

新規 `scripts/dev-create-test-users.ts`（実行: `npx tsx scripts/dev-create-test-users.ts`）

- 最初に `DATABASE_URL` のホストとポートが `hopper.proxy.rlwy.net:12921` でなければ、何も書かずに exit 1
- パスワードは環境変数 `DEV_TEST_USER_PASSWORD` から取り、無ければ exit 1（コードに書かない）
- 会社 `shunya-master-tenant-id` に、email で upsert する（何度流しても同じ）:
  - `dev-admin@example.test`（ADMIN・ACTIVE・表示名「確認用 管理者」）
  - `dev-production@example.test`（PRODUCTION・ACTIVE・「確認用 生産管理」）
  - `dev-staff@example.test`（STAFF・ACTIVE・「確認用 一般スタッフ」）
  - `dev-owner2@example.test`（OWNER・ACTIVE・「確認用 オーナー2」）
- 作った・更新した行を1行ずつ表示する
- ★本番には流さない。PR 本文にもそう書く

## §5 変えないもの

- schema・migration（D-20）
- ログイン画面の文言（停止の人も同じ文になる・§9）
- authorize の中身（`status !== "ACTIVE"` の throw はそのまま）
- 品番カルテの表示設定の読み書き
- MASTER_ADMIN・tenantType 軸の判定（B-242）
- 招待・パスワード再設定・メール（PR-3）

## §6 確認（dev・http://localhost:3001・hopper:12921）

★このブランチに `git switch` してから `PORT=3001 npm run dev`（今動いている dev サーバは止めて起動し直す）。
★2人目以降は別のブラウザかシークレットウィンドウでログインする。

0. `DEV_TEST_USER_PASSWORD=… npx tsx scripts/dev-create-test-users.ts` → 4人が表示される。もう一度流しても人数が増えない
1. オーナー（慎太郎さん）で `/settings` → 目次が5つ（自社情報・振込先・ユーザー・表示設定・役割と権限）
2. ユーザー: 5人が出る。自分の行は「自分」で操作なし。メール・最終ログインの列がある
3. 確認用 生産管理の役割を「経理」に変える → 再読込で残る。そのユーザーの画面で次にページを開くと、右上などの役割表示が「経理」の値になる（D-6）
4. 確認用 一般スタッフを「停止」→ 確認が出る → 停止になる。一般スタッフの画面で次にページを開くと `/login` に戻される。ログインし直そうとしても入れない
5. 停止の行で「アーカイブ」→ 一覧から消える。「アーカイブも表示」で出てくる。「停止に戻す」で停止に戻る。「再開」で有効に戻り、ログインできる
6. 有効の行に「アーカイブ」が出ない。アーカイブの行に「再開」が出ない（P2-D2）
7. オーナー同士: オーナー（慎太郎さん）で確認用 オーナー2を「管理者」に変える → できる。オーナーに戻す → できる。オーナー2を停止 → できる（慎太郎さんが有効なオーナーとして残るため）。★「最後のオーナー」の拒否そのものは画面からは起こせない（P2-D4 の注）ので、判定の純関数のテストで確かめる
8. 管理者（確認用 管理者）でログイン → ユーザー一覧でオーナーの行は操作なし。役割のプルダウンに「オーナー」が出ない。ほかの人の役割は変えられる
9. 一般スタッフでログイン（再開した後）→ 設定はすべて見るだけ。ユーザー一覧にメール・最終ログインの列が無い。「役割と権限」は見るだけ
10. オーナーで「役割と権限」の「一般スタッフ × 振込先」を「隠す」にして保存 → 一般スタッフの画面で次にページを開くと目次から「振込先」が消え、`/settings/bank` を直接開くと別の項目へ移る
11. 同じ状態で、品番カルテのメモ（表示設定の効き）は一般スタッフでも今までどおり
12. 締めの画面（`/closings`）の「締めを戻す」がオーナーには出て、一般スタッフには出ない（判定の一本化の回帰）
13. `grep -rn "canManageCompanySettings\|canReopenPeriod\|COMPANY_SETTING_MANAGER_ROLES\|PERIOD_REOPEN_ROLES" src` が 0件
14. `git diff main --stat -- prisma/` が空

## §7 Git / PR

- ブランチ: `feat/b205-pr2-users-roles`（main a79428e 以降から切る）
- 本ブリーフを `docs/specs/b-205-pr2-implementation-brief-2026-09-27.md` として同じ PR に入れる
- 型（`npx tsc --noEmit`）と触ったファイルの lint がクリーンで、テスト（新しく書いた純関数のテストを含む）が通れば、commit → push → PR open まで自走してよい。全体 lint は既存の error 数（11）から増えていないこと。マージは慎太郎さん
- commit の末尾:

      Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
      Claude-Session: https://claude.ai/code/session_01Q4wqnk33gTUnimFRWsehUn

- PR 本文の末尾:

      🤖 Generated with [Claude Code](https://claude.com/claude-code)

      https://claude.ai/code/session_01Q4wqnk33gTUnimFRWsehUn

## §8 本番への影響と手順（★マージ＝本番反映＝不可逆）

- schema 変更なし。migration なし
- ★マージと同時に D-6 が効く: ログイン中の全員について、画面を開くたびに DB の状態を見る。有効でない人はその時点でログアウトされる
- マージ前（read-only）: 本番の users を状態・役割ごとに数える（Railway の Data タブで `select role, status, count(*) from users where deleted_at is null group by 1, 2;`）。有効なオーナーが1人以上いることを確かめる。0人なら止めて報告
- マージ後: 本番の `/settings/users` を開き、自分の行が「自分」で出ること、ログアウトされずに画面を移れることを確かめる（何も変更しない）
- ★dev の確認用ユーザーのスクリプトは本番に流さない

## §9 今回やらないこと（行き先）

| 内容 | 行き先 |
|---|---|
| 招待・招待を再送・パスワード再設定・メール送信の基盤 | B-205 PR-3（R-7 をブリーフ前に決める） |
| 停止の人がログインしようとしたときの専用の文言 | 未起票（締めで BACKLOG を grep して起票 or B-199 に追記） |
| 1回の画面表示で `auth()` のたびに User を1行読む重さ（人数が増えたら React の `cache` などでまとめる） | 未起票（締めで判断） |
| 役割ごとの出し分けを原価・請求・入金・発注の画面へ | 仮 B-243（締めで起票） |
| 自分のプロフィール（名前・パスワードの変更） | R-9（締めで BACKLOG を grep） |
| MASTER_ADMIN・運営者と shunya テナントの分離 | B-242 |
| 社外ユーザー（EXTERNAL） | B-172 |

END-OF-BRIEF-B205-PR2
