# セッション引き継ぎメモ（2026-09-08 早朝 締め）

2026-09-07 朝 08:53 開始 → 2026-09-08 06:30 締め。★このセッションは日をまたいだ（5回目・約22時間）。

## ⓪ 最初にすること（例外なし）

shunya-session-start スキルを発動する。発動せずに指示文を出さない。
発動後 read-only の recon を1本流し、date を今日の日付と曜日まで照合して一致・不一致を書く。
★このメモが保存されたかを最初に確認する:
  git log --oneline -3 -- docs/SESSION_HANDOVER.md と grep -c '^## ' docs/SESSION_HANDOVER.md

## ① このセッションでやったこと

1. B-170（クライアント名寄せ基盤）を、仕様確認書 v0.1 → v1.0 → 実装ブリーフ → 実装 → PR #142 マージ → 本番稼働まで一気通貫で通した
2. ★本番反映を実測で確認した（本番 URL でカラーウェイ一覧に「先方色名 未登録」バッジが表示＝migrate deploy 成功）
3. ★migration の正運用が判明した（⑥）。ブリーフの migrate dev 前提は誤りだった
4. B-195（サイズ対応表）・B-196（発注一覧の品番）を新規起票
5. メモ受信箱（claude/MEMO_INBOX.md・docs/MEMO_INBOX.md）を新設

## ② 前メモの宿題の消化状況

| 前メモ | 内容 | 結果 |
|---|---|---|
| ⓪ | メモの保存確認 | 済 772cbd4・見出し15件・201行・SHA-256 22f015bd |
| ⑩ | shunya-design-reread に 2026-09-07 の節が入ったか | 済 ★入っていた（143行・推量 grep 禁止・session-close 訂正・「手前の空きが常に停止の材料とは限らない」すべて在） |
| ⑫ | 「他に気づいた点はありますか」 | ★**3セッションぶりに回収**。実務3問への回答（②）＋ 発注一覧の気づき（B-196）を得た |
| ⑦ | B-170 の仕様確認書 | 済 v1.0 まで確定し、実装・本番稼働まで到達 |

## ③ 現在の git 状態（2026-09-08 06:31 JST 実測）

- branch: main / HEAD: 605b343 / origin/main と同期・未 push なし / open PR: 0件
- 作業ツリー: ★クリーン（untracked ゼロ）
- 本セッションで main に入ったコミット: e167809 / f64e712 / aaf4bb9 / 0746b36 / 0dc29a4 / 605b343（この締めの保存分を除く）

## ④ B-170 の設計確定（慎太郎さん Q0〜Q6・仕様確認書 v1.0）

| Q | 決定 |
|---|---|
| Q0 スコープ | 案X: **保持と表示に絞る**。照合・正規化・突き合わせ画面は B-149 へ移管 |
| Q1 品番 | 1品番＝1クライアント専用 → 新テーブル不要。Product.clientProductCode を正とする |
| Q2 色名 | 案2-A: ProductColorway に clientColorName を1列追加 |
| Q3 色コード | 不要。色名のみ（後から非破壊で追加可） |
| Q4 画面 | Q0 の帰結で決着。B-170 は品番カルテでの入力のみ |
| Q5 clientSkuCode | 残置＋schema に休眠コメント（DROP しない） |
| Q6 未登録の扱い | 先方品番が未登録の品番は専用オーダーページに出さない |
| §6-2 | ★配色にも同じ規則。先方色名が未登録の配色も出さない。配色の未入力警告は B-171 |

★実務の裏付け（慎太郎さん 2026-09-07）: 先方品番は1種だが各社で表示桁数と英数字が違う／色はクライアント別にも生地メーカー別にも変わるので自社カラーで統一する／サイズ対応は後回し可。

★設計上の重要な発見: **本命の B-171（専用オーダーページ）では先方が一覧から選ぶため文字列の照合が発生しない。** 照合が要るのは移行期の B-149（Excel 取込）だけ。この切り分けで B-170 が小さくなった。

## ⑤ B-170 の実装（PR #142・本番稼働済み）

- commit: 6e934e1 → squash マージ 605b343（#142）。ブランチ削除済み
- 変更5ファイル・56挿入/1削除
- schema: ProductColorway.clientColorName（String? / VarChar(100)・2787行）＋ Sku.clientSkuCode に休眠コメント（2127行）
- migration: 20260908000000_b170_product_colorway_client_color_name（★手書き・ADD COLUMN 1文のみ）
- validator 1 / action 8 / UI 5 箇所に配線。★create・update とも trim してから空文字を null に落としている
- dev 動作確認: 未登録バッジ・新規登録・**編集して直せる**・**空にして保存で null**・**複合色名（BLACK×襟BLUEDENIM）**・見積系の回帰、すべて画面で確認
- ★本番: URL を開いてカラーウェイ一覧に未登録バッジが出ることを確認。**migrate deploy 成功＝本番 DB に列が入った**

★未確認のまま残したもの: 101文字が validator で弾かれるか／変更履歴に旧値・新値が載るか。どちらも軽微。

## ⑥ ★migration の正運用（今回いちばん重要な発見・次セッション必読）

**shunya-pms では prisma migrate dev を使ってはいけない。**

- dev DB には `_prisma_migrations` テーブルが**存在しない**（db push 由来。BACKLOG_EVIDENCE:2304「B-097 と同根」）
- そのため `migrate dev` は schema 全体を「全未適用」と誤認し、**DB 全体の reset（全データ消失）を要求する**。2026-09-08 に実際に要求され、実行せず停止した（被害ゼロ・dev データ無傷）
- 正しい三重ガード（docs に既に確定済み）:
  1. dev=hopper であることを確認
  2. `npx prisma db push` で dev に反映（ADD COLUMN は非破壊）
  3. **migration.sql を手書き**する（prisma 生成ではない。既存51本すべて手書き・3〜15行）
  4. `prisma migrate diff --from-schema-datasource --to-schema-datamodel --script` の出力と手書きが**一致すること**を検証（これが「migrate diff 空差分」に相当）
  5. 本番は Railway が `start: prisma migrate deploy` で自動適用
- 出典: BACKLOG_EVIDENCE.md:1529 / SALES_ORDER_QUANTITY_DESIGN.md:252 / package.json の start
- ★**本番 DB には履歴テーブルがある**（605b343 のデプロイで migrate deploy が成功し画面が出たことで実証）

★**docs/specs/b-170-implementation-brief-2026-09-07.md §2-2 は migrate dev 前提のまま誤っている。** 次セッションで訂正すること（⑦の1）。

## ⑦ 次にやること

| 順 | 内容 | ライフサイクル | 規模 | 備考 |
|---|---|---|---|---|
| 1 | 実装ブリーフ §2-2 の訂正（migrate dev → db push＋手書き migration＋diff 一致） | — | 小 | ★誤った手順が repo に残っている。次に読む人が同じ轍を踏む |
| 2 | B-172（クライアント認証・権限） | 6 → 7 | 大 | ★権限の穴が原価漏洩に直結。B-171 の前提 |
| 3 | B-171（専用オーダーページ） | 6 → 7 | 大 | 受注の本命の入口。B-170 と B-172 が前提。§6-2 の非表示規則と未入力警告もここ |
| 4 | B-149（Excel 取込） | 6 → 7 | 大 | ★照合・正規化・突き合わせ画面が B-170 から移管されている |

後続候補（順位未定）: B-196（発注一覧の品番表示）／B-188 + B-091 / B-189 / B-194 / B-166。
背骨で空いている手前のステップ: 1・2 は未実装。5（仕様書 = B-146/B-147）は MVP実装計画書 §10.1 の最優先課題2番目のまま休眠。原マイルストーンは M4 の途中で、入口（6）を開ける作業が続く。

## ⑧ 環境（変更なし）

- dev DB: hopper.proxy.rlwy.net:12921 / 本番 DB: shuttle.proxy.rlwy.net:16099
- ローカル dev: PORT=3001 npm run dev → http://localhost:3001（3000 ではない）
- 本番: https://shunya-pms-web-production.up.railway.app
- 接続文字列は DATABASE_PUBLIC_URL を使う
- ★dev には `_prisma_migrations` が無い（⑥）。本番にはある
- バックアップ態勢: Google Drive マウント済み・マイドライブ/dev-backups/shunya-pms/ 稼働

## ⑨ このセッションの失敗と対策（★4件・すべて Claude 側）

1. ★**grep のヒット行を、どのモデルに属するか確認せずに結論した。** `supplierColorName`（2814行）を ProductColorway の列だと断定したが、実際は次のモデル BomItemColorway（2808-）の列で、しかも仕入先方向だった。同じ出力の中に「ProductColorway 全文に含まれていない」という反証があったのに読み落とした。
   → **grep のヒットは行番号だけで判断せず、`awk 'NR<=N && /^model /{m=$2} END{print m}'` で帰属を確定してから使う**（shunya-design-reread に提案）
2. ★**自分が書いた検証の除外条件が、検証対象そのものを消していた。** B-195 の追加を確認する grep に `grep -v 'B-170'` を掛けたが、B-195 の説明文に「B-170 仕様確認書」が含まれていたため新規行が消え、**空の出力が「合格」に見えた**。件数の算術で気づいた。
   → **除外条件付きの検証を書いたら、その条件が対象を消していないかを1回考える。空の出力を合格と読まない**（file-write-verification に提案）
3. ★**実装手順を地の文に書き、Claude Code に届かなかった。** シェルのガードだけをコードブロックに入れ、手順1〜7を外に書いた。Claude Code にはブロックだけが渡り、ブランチを切っただけで実装が始まらなかった。file-write-verification 鉄則1 そのものの違反。
   → **手順は必ずコードブロックの中に入れる。地の文に手順を書かない**（file-write-verification に提案）
4. ★**その repo の migration 運用を実測せずに実装ブリーフを書いた。** 手本（supplierColorName）の4層は実測したのに、`prisma migrate dev` が使えるかは測らず前提にした。結果 dev DB の reset 要求まで行った（実害ゼロ）。ブリーフの §9 未確認事項にも挙げていない。
   → **実装ブリーフを書く前に、その repo の migration 運用（migrate dev か db push か・手書きか生成か・本番の適用経路）を実測する**（shunya-design-reread に提案）

★2・3・4 はいずれも「測っていないことを前提にした」形。1 は「測ったが読み違えた」形。**Claude Code 側の停止判断（reset を実行せず止めた・実装が無いのに検証しなかった）は3回とも正しく機能した。**

## ⑩ スキルの状態

- shunya-design-reread … 143行。2026-09-07 の節が反映済み（確認済み）。★本締めで2件の追加を提案
- shunya-environment-safety-check … 231行。★参照が「§⑥」のままだが現行メモでは環境は §⑧。本締めで訂正を提案。あわせて「migrate dev を使わない」を追加
- file-write-verification … 780行。★本締めで2件の追加を提案（⑨2・⑨3）
- skill-packager … 174行（2026-09-07 更新済み・変更なし）
- ★スキルは**次のチャットから有効**。このセッションでは反映されない

## ⑪ ナレッジの同期状態（2026-09-08 06:30 時点）

★次の6件をプロジェクトナレッジに登録／差し替えすること。

| ファイル | 扱い |
|---|---|
| docs/specs/b-170-client-name-mapping-spec-confirmation-v1_0-2026-09-07.md | ★新規登録（設計の正） |
| docs/specs/b-170-client-name-mapping-spec-confirmation-v0_1-2026-09-07.md | 新規登録（履歴） |
| docs/specs/b-170-implementation-brief-2026-09-07.md | ★新規登録。ただし §2-2 は誤り（⑥）。訂正後に差し替える |
| docs/BACKLOG.md | ★差し替え（B-170/B-149/B-056 追記・B-195/B-196 起票） |
| docs/SESSION_HANDOVER.md | ★差し替え（本メモ） |
| docs/MEMO_INBOX.md | 新規登録（claude/MEMO_INBOX.md と同内容） |

## ⑫ 繰り延べた要件

- サイズの対応表（v1.0 §8 でスコープ外）→ **B-195 に採番済み**
- 能動的な未入力警告（ブリーフ §5 で本PR範囲外）→ **B-171 の定義欄に紐づけ済み**（新規採番せず・番号を増やさずに規律を満たす）
- 番号未採番のまま浮いている要件: **0件**

## ⑬ B番号の増減

- 新規起票: 2件（B-195 サイズ対応表 / B-196 発注一覧の品番）
- 状態変更: 3件（B-170 に v1.0 確定を追記 / B-149 に照合責務の移管を追記 / B-056 に Excel 取込を追記）
- 取り下げ: 0件／番号未採番の合意: 0件
- BACKLOG の B行総数: 195 → 196

## ⑭ 締めの注意

- docs を main に commit した日なので main のまま終える
- 締めの保存ブロックは raw 出力を見届けてから「完了」と書く
- ★次セッションの順序: ⓪の保存確認 → ⑩のスキル反映確認 → ⑦の1（ブリーフ §2-2 訂正）→ ⑦の2（B-172）
- ★⑥（migration の正運用）は次に schema を触る時に必ず読む。migrate dev を打たない
