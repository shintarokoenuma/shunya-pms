# shunya-pms セッション引き継ぎメモ（2026-07-10 / QE-1R残作業クローズ・CMT_FEE追加・ファイル整理第1弾（files.zip消失インシデント含む）・backup-safety-checkスキル新設）

## ⓪ プロジェクト棲み分け（毎回先頭・要目視確認）
対象: shunya-pms（repo: github.com/shintarokoenuma/shunya-pms / local: ~/shunya-production-system / 本番: shunya-pms-web-production.up.railway.app）。saagara-v2 とは別物。Claude Code 着手前に VS Code が ~/shunya-production-system を指しているか目視確認。

## 1. 本セッションの位置づけ
前セッション（PR #98/#99/#100）の残作業2件をクローズし、費目マスター CMT_FEE を両環境に追加。その後ファイル整理第1弾を実行したが、mv の basename 衝突で未追跡ファイル2件が上書き消失（復元経路なしと確定）。再発防止として全プロジェクト共通スキル project-backup-safety-check（Googleドライブ3層防御版）を新設・アップロード済み。コード変更・PR・migration は本日なし（docs 更新のみ）。

## 2. 本日 main にマージされた PR
なし（本メモの docs 直 push のみ）。

## 3. クローズした残作業（前メモ§4）
1. ✅ PR #100 本番③確認: RE/PO 費目プルダウンが見出し＋Lv2 のみ・分類グルーピング表示を慎太郎さんが目視確認
2. ✅ Lv1 費目残置行の選び直し:
   - 本番: 工賃行（品目「縫製依頼。」に改名）= REGULAR_SEWING で保存。版代=PLATE_FEE・パンチ代=EMBROIDERY_PUNCH_FEE・提示額15600/26000・サマリ整合（初期費用小計¥32,000・提示分¥41,600・総額¥1,731,600）確認済み
   - dev: 「裁断、縫製、仕上げ」行 = CMT_FEE で保存済み

## 4. 費目マスター追加: CMT_FEE（両環境）
- コード CMT_FEE／名称「裁断、縫製、仕上げ」／LABOR Lv2（親 SEWING 縫製費）／固定額／JPY／稼働中
- 用途: CMT一括請求用。縫製単体は従来どおり REGULAR_SEWING
- 本番 10:50・dev 同日、いずれも UI から追加・プルダウン表示確認済み。費目総数 43件（42＋CMT_FEE）

## 5. ファイル整理第1弾の結果
### 完了（repo 外退避先 ~/shunya-backups/ 直下・chmod 700）
- 前段: .env.backup-20260529-171630 / .env.bak / full_backup_20260529_104452.sql(.dump) の4件退避済み
- scripts/ 6件: docs/run-*.sh（2026-05-29 DB再構成期の作業スクリプト）
- archives/ 9件: docs/*.zip 3本・skill/*.zip 6本・.bak（※本来11件 → 下記インシデント）
- 削除2件（安全確認済み）: docs/ 直下の category-code v1_0・product-sample v1_0（docs/specs/ に同一 tracked あり・diff 再検証後に削除）
- 残り未追跡: 33件。git 追跡ファイルは無変更・status クリーン

### ★インシデント: files.zip 消失（本日の最重要教訓）
- mv の basename 衝突で2件が上書き消失: **root files.zip（107K・中身不明）**・docs/shunya-git-workflow.zip（2.7K・skill版と同系統で実害小）
- 原因: Claude の指示文が同名衝突チェックを含まなかった（inventory に同名が並んでいたのに見落とし）
- 復元調査（read-only）: Time Machine 未構成・Data ボリューム（disk3s5）スナップショットゼロ → **全復元経路が閉じており復元不可と確定**
- 慎太郎さん判断: 失われた前提で進める（files.zip は6月末の B-037 整理時に「作業ローカル副産物」分類だった経緯あり）

### 保留（判断待ち）
- docs/package-lock.json（187行）: root（14,322行）と別物 → 削除せず保留。素性確認が次

## 6. 新設スキル: project-backup-safety-check（全プロジェクト共通）
- claude.ai にアップロード済み（Googleドライブ版・外付けディスク不要）
- 3層防御: ①GitHub（追跡分）②Google ドライブ退避（~/*-backups/ → マイドライブ/dev-backups/ へ rsync --ignore-existing・--delete 禁止）③操作前セーフティコピー（mv/rm 前に cp）
- 発動: 新プロジェクト立ち上げ時・不可逆操作の直前・「バックアップ」言及時
- ★前提未確認: **Google Drive for desktop の導入有無が未確認**（~/Library/CloudStorage/GoogleDrive-*/ のマウント検査が次セッションの宿題）。Time Machine は外付け未所有のため不採用と決定

## 7. DB状態
- dev（hopper.proxy.rlwy.net:12921）: RE-2026-0001（版代行 LABOR+flag、裁断縫製仕上げ行=CMT_FEE）。費目 43件。migration 41本目相当まで適用
- 本番（shuttle.proxy.rlwy.net:16099）: RE-2026-0001（is_separate_billing=true 2行・提示額15600/26000維持）。費目 43件。migration 41本目適用済み・重複17行は意図的残置
- 本日 DB スキーマ変更なし（マスター1件追加と RE 行の費目選び直しのみ・すべて UI 経由）

## 8. 次セッションで最初にやること（優先順）
1. このメモで状態復元 → git log origin/main -5 で実態確認
2. **backup-safety-check スキルの初回実行**: Google Drive for desktop マウント確認 → 未導入なら導入案内 → ~/shunya-backups/ の Drive 初回同期（STEP 2）。これが済むまで削除を伴う整理は再開しない
3. ファイル整理 第2弾: docs/CLAUDE.md・code-suggestion-feature.md の diff → 正本判定。docs/package-lock.json（187行）の素性確認
4. ファイル整理 第3弾（方針要決定）: 固有 md 21本 → 推奨「spec/ブリーフは docs/specs/ へ tracked 化（docs単独=main直push 1回）・それ以外は退避」。files 9〜12/ も同時仕分け
5. QE-1 見積エンジン spec 着手 or B-065 再設計 — 慎太郎さんと相談して選択（推奨は QE-1）

## 9. その他バックログ（変更なし分は前メモ参照）
- ラベル定数の重複解消（labels.ts → lib/constants re-export 統合・低優先）
- 引き当て検索 status フィルタ／WorkOrder DRAFT 編集／PO 作成後カルテ内留まり／PO 明細行複製／enum INITIAL_COST 物理削除（将来）
- 過去分: B-048・Q1c・Q1b・色違い=別品番明文化・ベトナム免税輸出書類・invoice×PO 突合・B-023〜B-028

## 10. 本日の教訓
- ★**複数ファイルの単一ディレクトリへの mv は basename 衝突を事前検査する。`mv -n`（上書き禁止）を既定にする。衝突時はサブディレクトリ分け**（files.zip 消失の直接原因）
- ★**不可逆操作（mv/rm）の前に対象のセーフティコピーを取る**（cp → 退避 dir）。未追跡ファイルは git で復元できない
- inventory の判定項目に「同名ファイルの有無」を含める
- バックアップ態勢（復元経路）の検査は不可逆操作の前提条件。態勢ゼロなら削除・上書きを提案しない（スキル化済み）
- 削除は直前に diff/同一性を再検証してから（今回は機能した: 重複同一2本は安全に削除、package-lock.json は差分検知で正しく停止）
- Time Machine の宛先に Google ドライブは指定不可。クラウド退避は Drive for desktop 経由の rsync で代替
