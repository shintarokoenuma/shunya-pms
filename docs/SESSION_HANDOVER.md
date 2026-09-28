# セッション引き継ぎメモ（CLOSE-AD・2026-09-28 19時台 JST）

## ⓪ 次セッションの最初の一手

★何よりも先に `shunya-session-start` を発動する。日付は必ず `date` で取り直す。
★次にプロジェクトナレッジ `claude/MEMO_INBOX-append-2026-09-28.md` を読む（本番のログインの事故・メールアドレスの割り当て・今後の流れの原文。正本はナレッジ側）。
★前のメモ（CLOSE-AC）は本メモで置き換えた。原文は `git show 7288f73:docs/SESSION_HANDOVER.md`。

## 1. プロジェクトの棲み分け

- 本件は shunya-pms（~/shunya-production-system・github.com/shintarokoenuma/shunya-pms）
- saagara-v2 / earnpulse / swtras-showroom は別プロジェクト

## 2. 本セッションでやったこと（2026-09-27 09時台〜2026-09-28 19時台 JST）

- B-205（設定ページ）: 参考画面で案B（左に目次の1ページ）に決定 → 仕様確認書 v0.1 → addendum v0.1 → v1.0（D-1〜D-24）
- PR-1 #173（自社情報・振込先・表示設定・帳票の読み先を Company に）を 2026-09-27 夜にマージ（squash a79428e）。★マージ前の dev の §6 は実施されないままマージされた（本番の請求書 0 件のため影響は小さい）
- D-24: 本番の設定ページで自社情報と振込先を慎太郎さんが入力（2026-09-27 夜）
- PR-2 の実装ブリーフ（B205-PR2・P2-D1〜D13）→ PR #174（ユーザー・役割と権限・画面を開くたびの読み直し・判定の一本化）
- PR #174 に追加の commit: 0d9e6a5（ユーザー表の見切れ）/ 1070da0（停止の人へのログインの文）/ 474ed3e（ログイン画面のテストアカウント表示を本番で出さない）
- PR #174 の dev 確認（localhost:3001・dev=hopper）: §6-0〜§6-12 と停止の文（正しいパスワード → 停止の文・違うパスワード → 今までの文）がすべて合格
- ★本番のログインの事故と対処（2026-09-28・詳細は §11-1）
- PR #174 を 2026-09-28 18:37 JST にマージ（squash a7b342d）。マージ後の本番確認: /settings/users に自分（info@shunya.cc・オーナー・有効・「自分」）／ログイン画面のテスト表示が消えた
- 締め ブロック1: BACKLOG（B-243〜B-247 起票・B-205 を進行中に）・MEMO_INBOX M-042/M-043 を main に push（7288f73）

## 3. 確定した設計（B-205 PR-2 までの要点）

- 設定ページは案B。目次: 自社情報・振込先・ユーザー・表示設定・役割と権限（spec v1.0）
- 画面を開くたびに DB の User を読み直す（P2-D1・src/lib/auth.ts の callbacks.jwt）。有効でない・deletedAt あり・companyId が違う → null（ログアウト）
- 状態の変更は4つだけ: 有効→停止／停止→有効（再開）／停止→アーカイブ／アーカイブ→停止（停止に戻す）（R-10 の回答・P2-D2）
- オーナーに関わる操作はオーナーだけ（AskUserQuestion「オーナーだけ（推奨）」）。管理者のプルダウンにオーナーは出ない
- 役割と権限は CompanySetting.securitySettings.rolePermissions.settings.{company|bank|users|display}.{役割} = view / hidden。未設定は view（D-16）。オーナー・管理者は保存しない
- 停止・アーカイブの人が正しいパスワードで来たときだけ「このアカウントは停止されています。管理者にお問い合わせください。」（auth.ts の AccountSuspendedError・code = account_suspended）。違うパスワードは今までの文
- 見るだけの人には、ユーザー一覧のメールと最終ログインを出さない（D-19）

## 4. 実測した事実

- 本番の users は info@shunya.cc の1行だけ（オーナー・有効）（2026-09-28・Data タブの SELECT）
- 本番の Company は D-24 で入力済み（2026-09-27 夜・画面で確認）
- Auth.js はログインに失敗するたびに `[auth][error] CredentialsSignin` をログに出す（停止の文も同じ仕組み）。1行なら打ち間違いの類で異常ではない
- seed（prisma/seed.ts:27・136）はまだ shin@shunya.jp を固定のパスワードで作り、値を出力する（B-246）

## 5. 完了状態

- B-205: 進行中（PR-1・PR-2 マージ済み。残りは PR-3）
- 完了にした B 番号は無い

## 6. 未マージ PR

無し（2026-09-28 18:58 JST に gh pr list で確認）。

## 7. dev / 本番 DB の状態（★この節が host ↔ 環境の唯一の正）

| 環境 | host | 状態 |
|---|---|---|
| dev | `hopper.proxy.rlwy.net:12921`（postgres-development） | 下の確認用データあり |
| 本番 | `shuttle.proxy.rlwy.net:16099`（postgres-production） | users は info@shunya.cc の1人。自社情報・振込先は入力済み。AUTH_SECRET は 2026-09-28 に入れ替え済み。締め・解除は一度も押していない |

dev に残っているもの:

- 確認用ユーザー4人（scripts/dev-create-test-users.ts・パスワードは env DEV_TEST_USER_PASSWORD）
- ★役割と権限の「振込先 × 一般スタッフ」が「隠す」のまま（戻すなら「見る」）
- 品番カルテのメモ「確認用 一般スタッフ テスト」（09/28 18:34）
- CLOSE-AB から持ち越しの締め・入金の確認用データ（period_closes・PAY-2026-0011 など）
- dev サーバ（PID 99806・PORT 3001）が main の作業ツリーで起動したまま

## 8. 本日の文書

- repo `docs/specs/`: b-205-settings-spec-confirmation-v1_0-2026-09-27.md / b-205-pr1-implementation-brief-2026-09-27.md / b-205-pr2-implementation-brief-2026-09-27.md（いずれも PR に同梱してマージ済み）
- ナレッジ `claude/`: 上の3本と spec v0.1・addendum v0.1、MEMO_INBOX-append-2026-09-27.md・-2026-09-28.md（claude.ai 側で作成）
- repo `docs/MEMO_INBOX.md` に M-042（動画・ナレッジからの同期）と M-043（本セッションの決定）を追記（7288f73）
- ★PR-2 ブリーフには停止の文（1070da0）とテスト表示（474ed3e）の追加が書かれていない。記録は M-043 と本メモ

## 9. 次にやること（優先順・冒頭に実態確認）

| 順 | 内容 | ステップ | 規模 | 本番影響 |
|---|---|---|---|---|
| 0 | `git log origin/main --oneline -5` / `gh pr list --state open` で実態確認 | — | 小 | 無し |
| 1 | 本番の発注書 PDF を1枚出して目視（会社名・〒・住所・TEL/FAX・「TEL:」の二重が無いこと）。D-24 の残り | 横断（帳票） | 小 | 無し（read-only） |
| 2 | B-246: seed のパスワードを env から読み、値を出力しない | 横断（セキュリティ） | 小 | マージで本番反映（seed は手動実行のみ） |
| 3 | B-205 PR-3: R-7（招待リンクの期限・送信用サブドメイン名・送信元アドレス）を決める → ブリーフ → メール基盤（Resend）・招待・パスワード再設定。その後 shintaro@shunya.cc を招待 | 横断（基盤） | 中〜大 | ADD TABLE ×1・環境変数・DNS（shunya.cc） |
| 4 | B-244: 自分のプロフィール（表示名・パスワードの変更） | 横断（基盤） | 小〜中 | マージで本番反映 |
| 5 | B-243: 役割ごとの出し分けを原価・請求・入金・発注へ（「締める」を誰に出すかも） | 横断（基盤） | 大 | 同上 |
| 6 | B-113（受領印の納品書）・B-233 / B-234 / B-236 / B-237 / B-241・B-231 / B-232・B-215（CLOSE-AC から持ち越し） | 11 / 12 / 横断 | 小〜中 | 同上 |
| 7 | B-242: 運営者（shintarokoenuma1012@gmail.com）と shunya テナントの分離 | 横断 | 大 | 同上 |

- B-245（auth ごとの1行読みの重さ）は人数が増えてから。B-247（Shopify・saagara 連動 → 切り分けて販売）は方針のメモで着手順は未定
- ★手前の空きステップ: 10. 検品（B-150）が未着手のまま。6（専用オーダーページ B-171 / B-172）・1・2・13 も未着手

## 10. ナレッジ登録状況（★予定。完了は次のチャットで project_search して確かめる）

- 差し替え: `SESSION_HANDOVER.md`（本メモ・claude.ai 側で project_write する予定）
- 差し替え依頼（慎太郎さん）: `BACKLOG.md`（repo の docs/BACKLOG.md・7288f73 の版）
- B-205 の spec・ブリーフ・MEMO 追記はナレッジ `claude/` に作成済み（claude.ai 側）。ナレッジ本体 `MEMO_INBOX.md` への統合は未実施

## 11. 注意点・残課題・教訓

1. ★本番のログインの事故（2026-09-28）: 本番の /login に開発用テストアカウントの表示があり、本番のオーナーのパスワードもその値だった。対処: アドレスを info@shunya.cc に・新しいパスワード（Mac で bcryptjs cost 12 の値を作り、UPDATE 文ごとクリップボードに入れて Data タブで実行）・AUTH_SECRET の入れ替え・PR #174 で表示を本番から消した。seed 側は B-246
2. ★DB・Railway の操作を案内するときは【本番：postgres-production】【dev：postgres-development】を先頭に書く（慎太郎さん「今後は、どちら分かりやすくコメントして下さい。」）
3. ★zsh はダブルクォートの中の `!` を履歴展開する。慎太郎さんのターミナルに貼るコマンドは `'…'` で囲み、`!` を使わない
4. ★D-6 により、停止した人は次に画面を開いた時点でログアウトされる。本番で自分を止めない（オーナーの操作はオーナーだけ・自分の行は操作なし）
5. ★本番では「締める」「解除する」を押さない
6. ★B-172 が実装されるまで、EXTERNAL の User を本番に作らない
7. ★新しく書くクエリは companyId と deletedAt: null を手書きする（AGENTS.md）
8. ★M番号・B番号は repo の現物の最大+1 で振る（今は M-043・B-247）
9. この Mac の grep は ugrep。アンカーの件数は `grep -cF` で数える
10. Claude Code の commit trailer は `Claude Fable 5.1` になることがある。履歴の書き換えはしない
11. PR-1 は dev の §6 を通さずにマージされた。PR-3 以降はマージ前に dev の確認を通す

## 12. スキルの反映

- 1件を提案: `shunya-environment-safety-check` に「本番・dev のラベルを毎回先頭に書く」と「本番の認証まわり（seed の固定パスワード・ログイン画面の表示・パスワード変更の手順・zsh の `!`）」を追加（claude.ai 側で提案カードを出す。保存は慎太郎さん）
- ★スキルの更新は次のチャットから有効

## 13. B-番号の増減（本セッション）

- 新規 5件: B-243（役割ごとの出し分けを他の画面へ）・B-244（自分のプロフィール）・B-245（auth ごとの1行読みの重さ）・B-246（seed の固定パスワード）・B-247（Shopify・saagara 連動 → 切り分けて販売）
- 状態変更 1件: B-205 未着手 → 進行中（定義の末尾に PR-1・PR-2 のマージを追記）
- 取り下げ 0件／番号未採番の合意 0件（Shopify の流れは B-247 で採番済み。M-042 の動画は未起票のまま）

## 14. 繰り延べた要件

- spec v1.0 §9 と PR-2 ブリーフ §9 を読んで確認: 役割ごとの出し分けの拡張 → B-243／R-9 → B-244／auth の重さ → B-245／停止の人への文 → PR #174 で実装済み／それ以外は既存の番号（B-242・B-172・B-049・B-219・B-205 PR-3）

## 15. ブランチ

main のまま終える。

END-OF-HANDOVER-CLOSE-AD
