# shunya-pms セッション引き継ぎメモ（2026-07-10 午後 / backup-safety-check初回実行（Drive導入・3層防御成立）・ファイル整理第2〜3弾完了（未追跡33→0・tracked化24本））

## ⓪ プロジェクト棲み分け（毎回先頭・要目視確認）
対象: shunya-pms（repo: github.com/shintarokoenuma/shunya-pms / local: ~/shunya-production-system / 本番: shunya-pms-web-production.up.railway.app）。saagara-v2 とは別物。Claude Code 着手前に VS Code が ~/shunya-production-system を指しているか目視確認。

## 1. 本セッションの位置づけ
同日午前の handover（e5c8ff0）から継続。①project-backup-safety-check スキルの初回実行を完了（Google Drive for desktop 導入 → 3層防御成立・検証済み）、②ファイル整理 第2〜3弾を完了し未追跡 33→0、正規 spec/brief 24本を tracked 化（ba25ec6）。コード変更・PR・migration・DB 接続は本日なし。

## 2. 本日 main にマージされた PR
なし。docs 直 push 2本のみ: e5c8ff0（午前 handover）・ba25ec6（正規資料24本 tracked 化）＋本メモ。

## 3. backup-safety-check 初回実行の結果（✅ 3層防御成立）
- Google Drive for desktop 導入完了（shintaro@shunya.cc・~/Library/CloudStorage/GoogleDrive-shintaro@shunya.cc/）。同期フォルダ選択はスキップ（rsync 退避方式を採用・repo を Drive 同期に入れない原則を維持）
- ~/shunya-backups/ → マイドライブ/dev-backups/shunya-pms/ へ rsync --ignore-existing で同期。ローカル vs Drive の find diff 完全一致で検収済み（ドットファイル .env系2件含む）
- 2段階認証: 2021/11/26 より有効を確認済み → .env 系を Drive に置く前提クリア
- 態勢判定: ①GitHub（追跡分）✅ ②Drive 退避 ✅ ③操作前セーフティコピー ✅

## 4. ファイル整理 第2〜3弾の結果（未追跡 33→0）
- 第2弾: docs/package-lock.json（実体は S-4 spec v1.0 の誤称コピー・tracked と完全一致）削除／docs/code-suggestion-feature.md（tracked と表記差のみ）削除／docs/CLAUDE.md（shunya-ivr 迷子）退避
- 第3弾②: files 11/ の shunya-ivr 迷子2件（CLAUDE.md・ai-classifier.md）→ cleanup2/misplaced-shunya-ivr/ へ退避・dir 削除
- 第3弾③-A: files 9 の phase1a-10 半角重複を削除／files 10 の seed CSV 3件（履歴資料・現行 seed は prisma/seed.ts）→ cleanup2/seed-history/ へ退避・dir 削除
- 第3弾③-B: 正規資料24本を tracked 化（コミット ba25ec6）。docs/specs/ 一括・現名維持。例外2件: HANDOFF-quality-label-app → docs/reference/（品質表示メーカーアプリの shunya-pms 統合用取り込み資料・将来の品質表示機能の一次資料）、master-naming-conventions-append → 日付付与で docs/specs/ へ
- 後始末: .DS_Store 5個を物理削除（.gitignore:24 で除外済み・追記不要）。files 9〜12/ dir 全廃
- 最終状態: 未追跡 0・追跡クリーン・docs/specs/ tracked 56件・docs/reference/ 1件。以後 git status の未追跡は real な作業差分のみ
- すべて「セーフティコピー → 同一性検証 → Drive 同期 → 削除直前再検証 → 除去」の型で実施し事故ゼロ（第1弾 files.zip の教訓が機能）

## 5. DB状態（本日変更・接続なし）
- dev（hopper.proxy.rlwy.net:12921）: RE-2026-0001（版代行 LABOR+flag、裁断縫製仕上げ行=CMT_FEE）。費目 43件。migration 41本目相当
- 本番（shuttle.proxy.rlwy.net:16099）: RE-2026-0001（is_separate_billing=true 2行・提示額15600/26000）。費目 43件。migration 41本目・重複17行は意図的残置

## 6. 未マージ PR
- PR #94（feat/b-065-po-import-colorway）: open/pause 継続。主客転倒の設計誤りにより要再設計（正: PO 作成フォームに colorway select → PoItem が productColorwayId を持つ。取込は区分選択のみ）。QE-1/B-069 設計に吸収の可能性大

## 7. 次セッションで最初にやること（優先順）
1. このメモで状態復元 → git log origin/main -5 で実態確認（先頭は本メモのコミット、その下 ba25ec6・e5c8ff0）
2. **QE-1 見積エンジン spec 着手（推奨・本丸）**: design-reread（Step 0 対象確認ゲート）として quotation-rough-estimate-spec-confirmation-v0_1（QE-0）・quotation_engine 系ドキュメント・BOM/費目まわりの live schema を読み直してから設計判断。多通貨は v1=JPY/USD（QE-0 §1 の QE-3+ 先送りを上書き確認済み）・EUR等ブロック。初期費用は別枠（is_separate_billing）＝per-unit は MATERIAL+LABOR のみ、の絶対制約を維持
3. （QE-1 を選ばない場合）B-065 再設計
4. Drive 退避の運用: 以後 ~/shunya-backups/ に退避物を足したら rsync --ignore-existing で dev-backups/shunya-pms/ へ同期（--delete 禁止）

## 8. その他バックログ（変更なし）
- ラベル定数の重複解消／引き当て検索 status フィルタ／WorkOrder DRAFT 編集／PO 作成後カルテ内留まり／PO 明細行複製／enum INITIAL_COST 物理削除（将来）
- 過去分: B-048・Q1c・Q1b・色違い=別品番明文化・ベトナム免税輸出書類・invoice×PO 突合・B-023〜B-028
- 新規: docs/reference/HANDOFF-quality-label-app（品質表示機能の統合検討時の一次資料として参照）

## 9. 本日の教訓
- 「セーフティコピー → 同一性検証 → Drive 同期 → 削除直前再検証 → 除去」の型は24本規模でも事故ゼロで機能。今後の不可逆操作の標準形とする
- mv -n と basename 衝突事前検査を全 mv に適用（本日は衝突ゼロで通過）
- 誤称ファイルは中身で判定（docs/package-lock.json の実体は S-4 spec だった）。ファイル名を信用しない
- ドットファイルは Drive のブラウザ一覧で見えないことがある → 検収は find の diff で行う
- .gitignore 追記の前に git check-ignore -v で既存ルールを確認（重複追記の防止）
