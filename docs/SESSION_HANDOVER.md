# セッション引き継ぎメモ（CLOSE-AK・2026-10-05 17時台 JST）

## ⓪ 次セッションの最初の一手

- ★何よりも先に shunya-session-start を発動する。日付は date で取り直す
- 前のメモ（CLOSE-AJ）は本メモで置き換えた。原文は git show caad256:docs/SESSION_HANDOVER.md
- ★まず本締めの保存が main に入ったかを確かめる: git log origin/main --oneline -4 に CLOSE-AK の docs commit が3つ（引き継ぎメモ・BACKLOG・MEMO_INBOX）あること。tail -1 docs/SESSION_HANDOVER.md が END-OF-HANDOVER-CLOSE-AK であること
- ★慎太郎さんの予定: 「10月中頃にはスタッフも含めた実務で使用したいです。」（2026-10-03 21:14）
- ★スタッフの役割の確認は保留: 「スタッフの件は、近づいたら確認するので、設計を進めましょう。」（2026-10-05 00:07）。声がかかるまで、こちらから聞かない

## 1. プロジェクトの棲み分け

- 対象は shunya-pms（~/shunya-production-system・github.com/shintarokoenuma/shunya-pms・本番 https://shunya-pms-web-production.up.railway.app）
- saagara-v2 / earnpulse / swtras-showroom とは別物。スキルも別

## 2. 本日の完了（すべて main・squash）

| PR | squash | B番号 | 内容 |
|---|---|---|---|
| #187 | cc9d7e4 | B-260 | 役割と権限の表で、マウスを乗せた行の左の固定列の色を行に合わせた（role-permissions-form.tsx の1ファイル・TableRow に group、固定セル3か所に group-hover / group-has-aria-expanded で不透明な color-mix の背景）。本番で確認済み |
| #188 | ad9cff7 | B-208・B-250 | PDF のフォントを全字版に差し替え（Google Fonts 公式の可変フォントから wght 400/700 を切り出し・各 16,732 字・※ ～ ① ℃ ㎝ → などが出る）／全体の分綴を「文字の間で折れるが『-』は出さない」に／発注書の C# 列 11→15%（品名 26→24・単位 11→9）。dev で §3-1〜§3-6 合格・本番 PO-2026-0011 / PO-2026-0009 で確認済み |

- ★B-208 の重要な経緯: 1回目（6628314）は fontTools の instantiateVariableFont を updateFontNames 無しで使い、Regular・Bold とも PostScript 名が NotoSansJP-Thin になった。@react-pdf/pdfkit は同じ名前のフォントを使い回すため PDF のフォントが1つに潰れ、全文字が太字・字の対応が壊れ、WO-2026-0022 の合計 ¥984,000 が「4,000」と出た。dev で見つけ、7770532 で updateFontNames=True に切り出し直して解消（追補 docs/specs/b-208-b-250-addendum-2026-10-05.md）。新しいフォントの sha256: Regular 9e56988a…（5,766,828 bytes）・Bold 78d4066c…（5,761,624 bytes）
- 競合調査（M-048）: artifact「PMS 競合フローマップ」 https://claude.ai/artifact/MuSHx3VzYSFpkGfQW3X8xx 。GEN・アラジンオフィス・KKAP+ の公開ページには OEM 工程（サンプル〜縫製仕様書〜型紙〜原反計算〜工場別の指示書）と問い合わせ・企画・ムードボードが無い。shunya-pms の空きは在庫と買う側のお金（仕入・買掛・支払・輸入諸掛・原価の予実）。起票候補9件は慎太郎さん未決のため採番していない

## 3. 未マージ PR と動作確認

- 未マージ PR は無し（16:58 の gh pr list --state open が空）
- ブランチは main（本締めの保存ブロックで main に切り替え、ローカルの fix/b208-b250-pdf-font-hyphen は削除）

## 4. DB の状態

- 本日の2本の PR はどちらも migration なし。本番 migration 数は CLOSE-AJ 時点から変化なし（cc9d7e4 のデプロイログ「No pending migrations to apply.」・ad9cff7 のログは慎太郎さんが Railway で確認）
- dev（hopper.proxy.rlwy.net:12921）: PO-2026-0026（丸東[ダミー]・ドラフト）の明細1の C# に確認用の「カーキグリーン」が入ったまま（慎太郎さんが dev で編集・本日 12:24）。同じ発注に明細2「てすて」（仕入先品番 10000・デザイン番号 D-1・カラー C/#D300）がある（入れた経緯は未確認）。消すかは任意
- 本番: 確認はプレビューだけで、データの編集・ダウンロードはしていない

## 5. 本日の文書

- docs/specs/b-260-implementation-brief-2026-10-05.md（ナレッジ claude/ にも同じ本文）
- docs/specs/b-208-b-250-implementation-brief-2026-10-05.md（同上）
- docs/specs/b-208-b-250-addendum-2026-10-05.md（同上・フォント名の衝突の原因と直し方・D-8〜D-10）
- メモ受信箱の正本はナレッジ claude/MEMO_INBOX-append-2026-10-05-am.md と -pm.md。本締めで repo docs/MEMO_INBOX.md に M-048〜M-052 として同期した

## 6. 次にやること（優先順・冒頭に実態確認）

| 順 | 内容 | ステップ | 規模 |
|---|---|---|---|
| 1 | B-267 縫製仕様書 PDF の縫製指示と付属の仕様を全文折り返す（案1確定・入りきらない分は次のページ）。先に addendum v0.3 D-38・D-41・D-44 を読み直し、2枚目も全文にするか・送る単位を決める | 5. サンプル承認・仕様書 | 中 |
| 2 | B-266 発注書 PDF にデザイン番号（D/#）とカラーを出す。B-249（D/# の頭の付け方）と一緒に決める。列幅の決め直しが要る | 8. 量産発注 | 小〜中 |
| 3 | B-268 品番・数字を途中で折らない（NO_BREAK・列幅を先に確保）／縫製仕様書の ※ 回避の文言を戻す／sewing-spec-data.ts の古いコメント | 横断（帳票） | 小 |
| 4 | B-265 問い合わせ・企画（AI 補助・ムードボード）の設計相談。まず今の進め方を慎太郎さんに聞く | 1. 問い合わせ・2. 企画 | 大 |

- ★手前の空きステップ: 1（問い合わせ）・2（企画）は実装ゼロ → B-265
- どれから始めるかは慎太郎さんが未決（16:05 に「B-267 のブリーフ」か「締め」を聞き、締めを選んだ）

## 7. 注意点・残課題・教訓

- ★PDF のフォントを差し替えたら、埋め込みフォントの名前と数を確かめる（pdffonts / pypdf の /BaseFont）。Regular と Bold の PostScript 名（fontTools の name ID 6）が違うことをフォントファイルの時点でも見る。可変フォントの切り出しは updateFontNames=True
- ★帳票の確認は、取り出した文字列だけで合格にしない。画像にして目で見る。Claude Code の試しは文字列だけを見ていて潰れを見逃した
- ★慎太郎さんに PDF を claude.ai 側へ添付してもらえば、pdffonts・pdftotext・pdftoppm で直接調べられる（WO の原因はこれで特定した）。ダウンロードフォルダで同じファイルの取り違えが2回起きたので、スクリーンショットでもよい
- ★本番の確認はプレビューだけ（ダウンロード・編集はしない）
- B-258（Select の空欄）は再現するまで保留。慎太郎さん 10:55「２でいきましょう。」。空欄が出たらその画面と Next.js の Issue の中身を撮って再開
- dev 画面左下の Next.js「1 Issue」の中身は見ていない
- 発行元の社名（M-052・起票せず保留）: dev では請求書だけ「株式会社shunya」、納品書・発注書などは「shunya合同会社」。請求書は作成時の控え（issuerName）を優先し、空なら今の Company（invoice-data.ts:147）。納品書は今の Company（getCompanyIssuer）。本番の発注書は「株式会社shunya」と住所・TEL・FAX が出る。dev の Company の値と INV-2026-0004 の控えの値は未測定
- 本日の自分の誤り: Claude Code の要約の「221 か所」をそのまま受けかけた（正しくは 65 ファイル 185 か所）／B-208 ブリーフで OFL.txt を「追加」と書いた（既にあった）／B-260 ブリーフに next build を入れ忘れた／B-208 の §3-1 を全文字太字の状態で合格にした（取り消してやり直し）

## 8. ナレッジ登録状況

- ナレッジに登録済み（claude.ai 側で project_write・本日）: claude/b-260-implementation-brief-2026-10-05.md・claude/b-208-b-250-implementation-brief-2026-10-05.md・claude/b-208-b-250-addendum-2026-10-05.md・claude/MEMO_INBOX-append-2026-10-05-am.md・claude/MEMO_INBOX-append-2026-10-05-pm.md
- SESSION_HANDOVER.md: 本メモと同じ本文を claude.ai 側で project_write した（バイト一致は未検証）
- 慎太郎さんに差し替えを依頼: BACKLOG.md・MEMO_INBOX.md（repo の docs/ から）

## 9. B番号の増減

- 新規 4件: B-265（問い合わせ・企画・M-049）／B-266（発注書 PDF の D/# とカラー・M-050）／B-267（縫製仕様書の全文折り返し・M-051）／B-268（B-208 の後続・NO_BREAK など）
- 状態変更 3件: B-208・B-250・B-260 → 完了
- 定義欄への追記 1件: B-258（再現せず保留・185 か所・role-permissions-form は対策済みの訂正）
- 取り下げ 0件
- 番号未採番の合意 0件（M-049・M-051 は本締めで採番。M-048 の起票候補9件は慎太郎さん未決のため採番しない。M-052 は保留）

## 10. 繰り延べた要件

- 2件: B-208 ブリーフ §6 の「コードを途中で折らない（D-4）」と「縫製仕様書の ※ 回避を戻す（D-6）」→ B-268 に採番。多言語フォントは既存の B-151
- B-267 の未確定3点（2枚目も全文にするか・送る単位・数字の途中で折らないか）は B-267 の定義欄に書いた

## 11. スキルの更新

- shunya-pdf-document の更新案（§2 フォントを全字版・分綴の現状に書き換え、§7 確かめ方を追加）を claude.ai 側の提案カードで出した。保存は慎太郎さんがカードで行う。★保存されていれば次のチャットから有効（実行環境のスキルはチャット開始時点で固定される）

## 12. ブランチ

- main のまま終える（feature ブランチへ戻さない）

END-OF-HANDOVER-CLOSE-AK
