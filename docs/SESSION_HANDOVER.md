# セッション引き継ぎメモ（CLOSE-AC・2026-09-27 01時台 JST）

## ⓪ 次セッションの最初の一手

★何よりも先に `shunya-session-start` を発動する。日付は必ず `date` で取り直す。
★次にプロジェクトナレッジ `claude/MEMO_INBOX-append-2026-09-26.md` を読む（B-205 の Q1〜Q5 と M-041 の原文。正本はナレッジ側）。
★前のメモ（CLOSE-AB）は本メモで置き換えた。原文は `git show 928a5af:docs/SESSION_HANDOVER.md`。

## 1. プロジェクトの棲み分け

- 本件は shunya-pms（~/shunya-production-system・github.com/shintarokoenuma/shunya-pms）
- saagara-v2 / earnpulse / swtras-showroom は別プロジェクト

## 2. 本セッションでやったこと（2026-09-26 22時台〜2026-09-27 01時台 JST・コードの変更なし）

- session-start: 22:26 JST に main 928a5af・open PR 0・作業ツリー clean・.env は dev（hopper）を確認
- CLOSE-AB §9-1 の dev 後片付けを read-only で確認 → 済み
  - 藤崎テキスタイル［ダミー］09/01〜09/30 は2行とも REOPENED（2行目は 20:41 締め → 21:34:48 解除）
  - PO-2026-0027 / WO-2026-0025 は 20:39 JST に論理削除済み（対照の PO-2026-0009 / WO-2026-0001 は未削除）
- B-205（設定ページ）の設計の論点を決めた。RECON-SET（22:54）・RECON-MAIL（23:48）を dev read-only で実施。Q1〜Q5 を確定。★仕様確認書は未作成
- ナレッジに `claude/b-109-pr6-implementation-brief-2026-09-26.md`（v1.0）は無かった。ルートの `b-109-pr6-implementation-brief-2026-09-26.md` が v1.1 を含む（途中に旧終端 END-OF-BRIEF-B109-PR6 があるので、最後の -V1_1 まで読む）（claude.ai 側で確認）

## 3. 確定した設計（B-205・原文は claude/MEMO_INBOX-append-2026-09-26.md）

- ★M-041（慎太郎さん 2026-09-26）: システムの制作者（運営者）は慎太郎さん個人。shunya はシステムを利用するクライアント（テナント）の1社。利用する会社の自社情報は DB に持つ
- Q1: 自社情報はテナントごとに `Company` に持つ。既存列（〒・住所・電話・メール・登録番号）を使い、FAX と振込先（Json・Invoice.bankInfo と同じ形）の2列を足す（nullable の ADD COLUMN ×2）。定数 `COMPANY_PROFILE` は廃止の方向。空の項目は空欄で出して画面で知らせる（shunya の値を予備にしない）
- Q2: 帳票の社名は `Company.legalEntity`（正式名称）。空なら `companyName`（画面の表示名「shunya」）
- Q3: 新しいユーザーは招待メール（UserStatus.INVITED を使う）。招待トークンの小さな表を新設し、パスワード再設定と共用する（トークンはハッシュで保存・有効期限・使用日時）
- Q4: 画面を開くたびに DB の User の行で role・status を確かめる（今は JWT にログイン時の値が焼き付き、変えても次のログインまで効かない＝auth.ts:94-99）
- Q5: 送信元は当面 shunya.cc の送信用サブドメイン（Resend）。全テナント共通。shunya.cc は Squarespace で管理（有効期限 2027-03-09）。近くドメインを移管するので、そのときに送信元を変える（環境変数と DNS の差し替え・コード変更なし）。★移管で DNS の管理先が変わるなら Resend のレコードも写す
- メール送信の基盤は B-049（発注書の送付）・B-219（請求書の送付）と共用する前提で作る
- PR の見込み: 1 自社情報・振込先 → 2 ユーザー一覧・role の変更・無効化・Q4 → 3 メール送信の基盤＋招待＋パスワード再設定

## 4. 実測した事実（RECON-SET / RECON-MAIL・main 928a5af・dev read-only）

- Company に FAX と振込先の列は無い。dev の Company は shunya の1行（MASTER_ADMIN・住所も登録番号も空）
- `COMPANY_PROFILE` は帳票9か所と invoices.ts・delivery-notes.ts が読む（全テナント共通の固定値）
- prisma.company の書き込み 0 件／prisma.user の create・role 変更 0 件／画面の users・settings ディレクトリ無し／nav の /settings は enabled:false
- OWNER・ADMIN の判定の配列は2か所（src/lib/types/ui-preferences.ts:21・src/lib/period-close/lock.ts:40）
- dev のユーザーは shunya の OWNER 1人（ACTIVE）。company_settings は1行
- メール送信の器は無い（resend 等のライブラリ・RESEND_* などの環境変数・送信コード・token/invite/reset の表とも無い）
- 休眠の Notification / EmailMessage / Session は招待トークンの器には合わない
- 未ログインで開けるのは /login・/・/api/auth だけ（src/proxy.ts:6-8）。招待を受けるページは proxy.ts への追記が要る
- ★本番の Company の値は未測定

## 5. 完了状態

- 完了にした B 番号は無い。B-205 は未着手のまま（定義欄に確定事項を追記）

## 6. 未マージ PR

無し（22:26 JST 時点）。

## 7. dev / 本番 DB の状態（★この節が host ↔ 環境の唯一の正）

| 環境 | host | 状態 |
|---|---|---|
| dev | `hopper.proxy.rlwy.net:12921` | 下の確認用データあり |
| 本番 | `shuttle.proxy.rlwy.net:16099` | 本セッションは触れていない。本番では締め・解除を一度も押していない |

dev に残っている確認用データ（CLOSE-AB から持ち越し・本セッションは read-only のみ）:

- period_closes: SLOW CURRENT 07/21〜08/20（REOPENED 1行＋CLOSED 1行）／SLOW CURRENT 06/21〜07/20 CLOSED／HINOKI 06/21〜07/20 CLOSED／なんば商店 07/16〜08/15 CLOSED／丸東 08/01〜08/31 CLOSED／藤崎 09/01〜09/30 は2行とも REOPENED（2026-09-26 22:29 に確認）
- マスター: なんば商店の締め日は 15。SLOW CURRENT は 20
- 入金: PAY-2026-0011（SLOW CURRENT・8/10・1,000円・締めた期間なので取消できない）。PAY-2026-0010 は取消済み
- PO-2026-0027 / WO-2026-0025 は論理削除済み（2026-09-26 22:29 に確認）

★dev サーバは PORT=3001。接続文字列は必ず `DATABASE_PUBLIC_URL`。`tail -c` の桁数を増やさない。

## 8. 本日の文書

- 新しい spec・addendum・ブリーフは無い
- プロジェクトナレッジ `claude/MEMO_INBOX-append-2026-09-26.md`（M-041・B-205 の Q1〜Q5・RECON-MAIL の要点）（claude.ai 側で作成）
- repo `docs/MEMO_INBOX.md` に M-041 を追記（本締め）

## 9. 次にやること（優先順・冒頭に実態確認）

| 順 | 内容 | ステップ | 規模 | 本番影響 |
|---|---|---|---|---|
| 0 | `git log origin/main --oneline -5` / `gh pr list --state open` で実態確認 | — | 小 | 無し |
| 1 | **B-205**: 「設定」ページの参考画面（2〜3案・現状を1案含む）を作り、選んでもらう → 仕様確認書 v0.1（Q1〜Q5 を写す） | 横断（基盤） | 中 | 無し（設計のみ） |
| 2 | B-205 PR-1: 自社情報・振込先（Company に2列・設定ページ・帳票を DB から読む）。★マージ前に本番の Company の値を read-only で測り、shunya の行に今の定数と同じ値を入れる方法を決める | 横断（基盤） | 中 | マージで本番反映 |
| 3 | B-205 PR-2（ユーザー一覧・role・無効化・Q4）→ PR-3（メール基盤＋招待＋パスワード再設定） | 横断（基盤） | 中〜大 | 同上 |
| 4 | B-113: 受領印を押した納品書のスキャン登録 | 11. 納品 | 中 | 同上 |
| 5 | B-233 / B-234 / B-236 / B-237 / B-241 の小さな直し | 7 / 12 / 横断 | 小〜中 | 同上 |
| 6 | B-231 / B-232（テナント分離の続き）。★B-171 / B-172 の本番投入より前 | 横断 | 中 | 同上 |
| 7 | B-215: 本番の端数処理（ERA・プレステージ）を直したかは未確認。慎太郎さんに聞く | 12. 請求 | 小 | ★本番の書き込み |

★手前の空きステップ: 10. 検品（B-150）が未着手のまま。6（専用オーダーページ B-171 / B-172）・1・2・13 も未着手。

## 10. ナレッジ登録状況（★この節は予定。完了は次のチャットで project_search して確かめる）

- 差し替え予定: `SESSION_HANDOVER.md`（本メモ）／`BACKLOG.md`（claude.ai 側で push を確認した後に project_write する予定）
- `claude/MEMO_INBOX-append-2026-09-26.md` はナレッジに作成済み（claude.ai 側）。ナレッジ本体 `MEMO_INBOX.md` への統合は未実施

## 11. 注意点・残課題・教訓

1. ★本番では「締める」「解除する」を押さない
2. ★本番の取引先の多くは締め日が未設定（月末扱い）。実運用の前にマスターへ入れる
3. ★B-205 では MASTER_ADMIN の判定（src 約90か所）に触れない。運営者と shunya の分離は B-242（ホワイトラベル W 系列に同じものがあれば取り下げ）
4. ★定数を DB に移すと、本番の shunya の Company の行が空なら帳票の自社情報が空欄になる。PR-1 のマージ前に必ず値を入れる
5. ★B-172 が実装されるまで、EXTERNAL の User を本番に作らない
6. ★新しく書くクエリは companyId と deletedAt: null を手書きする（AGENTS.md）
7. ★M番号・B番号は repo の現物の最大+1 で振る
8. ★量産発注の生成は、押すたびに PO / WO を新しく作る（B-142）
9. ★.env の変数名を grep するときは行頭で絞る（RECON-MAIL で `base_url` が `DATABASE_URL` に当たった）
10. ★本セッションは 0 時をまたいだ。日付はファイルに書く直前に取り直した
11. この Mac の grep は ugrep。アンカーの件数は `grep -cF` で数える
12. Claude Code の commit trailer は `Claude Fable 5.1` になることがある。履歴の書き換えはしない
13. 本番の請求書・納品書の紙面は未確認（最初の実データで確認する）

## 12. スキルの反映

- 更新なし（0件）。前回提案の `shunya-pr-url-checklist` の節は反映済みであることを本セッション冒頭に確認した（claude.ai 側で本体を grep）

## 13. B-番号の増減（本セッション）

- 新規 1件: B-242（運営者と shunya テナントの分離・M-041）
- 定義欄の追記 1件: B-205（Q1〜Q5 と RECON の要点）
- 状態変更 0件／取り下げ 0件／番号未採番の合意 0件

## 14. 繰り延べた要件

- 0件（仕様確認書を書いていない）。送信用サブドメイン名と送信元アドレスは B-205 PR-3 の実装ブリーフで決める

## 15. ブランチ

main のまま終える。

END-OF-HANDOVER-CLOSE-AC
