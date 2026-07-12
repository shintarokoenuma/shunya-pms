# shunya-pms セッション引き継ぎメモ（2026-07-12 / プロジェクトナレッジ全件同期（QE系15本）・session-handoverスキル鉄則4追加・後回し禁止原則の恒久化）

## ⓪ プロジェクト棲み分け（毎回先頭・要目視確認）
対象: shunya-pms（repo: github.com/shintarokoenuma/shunya-pms / local: ~/shunya-production-system / 本番: shunya-pms-web-production.up.railway.app）。saagara-v2 とは別物。Claude Code 着手前に VS Code が ~/shunya-production-system を指しているか目視確認。

## 1. 本セッションの位置づけ
2026-07-10 handover（a34fb1a）の続き。QE-1 spec 着手時に「repo には tracked 済みだがプロジェクトナレッジ未登録の spec 群」が発覚し design-reread がブロックされたため、本セッションは claude.ai 側の整備に専念した。repo へのコード変更・PR・migration・DB 接続は一切なし（repo 側は a34fb1a のまま）。QE-1 の設計本体は別チャット「QE-1見積エンジン仕様設計の着手」で並行進行中。

## 2. 完了事項（すべて claude.ai 側）
1. **プロジェクトナレッジ同期（QE 系15本・全件完了）**: qe-0 v1.0／qe-0d v1.0／qe-1 v1.0／qe1r 系5本（allocation-key・initial-cost-flag・initial-cost-redesign・road-a・tax-addendum）／quotation-pdf-and-list 3本（v0.1・v0.2・brief）／quotation-rough-estimate 3本（v0.1・addendum v0.2・brief）／sample-quotation-concept v0.1。全件を検索で実体検収済み。重複（quotation-rough-estimate v0.1 の二重登録）は1枚削除で解消。
2. **shunya-session-handover スキル更新（鉄則4追加）**: handover 作成時に「セッション中に確定した spec/addendum のナレッジ登録案内（ファイル名明示・全件一括・後回し禁止・検索で実体検収）」を必須化。claude.ai に置き換えアップロード済み。
3. **メモリー恒久ルール追加**:「一部だけ対応して残りは後回し」を提案しない（全プロジェクト共通・同期/登録/修正は対象全件を即時完了・部分対応は理由明示＋承認必須）。

## 3. 本日 main にマージされた PR / コミット
なし（repo 無変更。origin/main 先頭 = a34fb1a のはず。※並行の QE-1 チャットが push していれば先頭が変わっている可能性あり→STEP 0 で確認）。

## 4. DB状態（本日接続なし・2026-07-10 から不変）
- dev（hopper.proxy.rlwy.net:12921）: RE-2026-0001（版代行 LABOR+flag、裁断縫製仕上げ行=CMT_FEE）。費目 43件。migration 41本目相当
- 本番（shuttle.proxy.rlwy.net:16099）: RE-2026-0001（is_separate_billing=true 2行・提示額15600/26000）。費目 43件。migration 41本目・重複17行は意図的残置

## 5. 未マージ PR
- PR #94（feat/b-065-po-import-colorway）: open/pause 継続（QE-1/B-069 設計に吸収見込み）

## 6. ナレッジ登録状況（鉄則4・本セッションから必須記載）
- QE 系15本: 全件登録済み・検索検収済み・重複なし。未登録の確定 spec なし
- 残宿題: QE 系以外の docs/specs/（tracked 56本）とナレッジの全量突き合わせは未実施。git ls-files docs/specs/ docs/reference/ の出力を Claude.ai に渡せば残りの未登録全リストを提示できる（QE-1 作業には影響しないため優先度低・ただし後回しでなく次の区切りで実施）

## 7. 次セッションで最初にやること（優先順）
1. このメモで状態復元 → git log origin/main -5 で実態確認（QE-1 チャットの push 有無を含む）
2. **QE-1 見積エンジン spec 設計の継続**（別チャットで進行中ならそちらを継続）: design-reread は qe-0 v1.0・qe-1 v1.0 の原文＋live schema（Bom/BomItem/CostCategory/RoughEstimate/WoItem/PoItem・enum Currency）読み直しから。制約: v1=JPY/USD・指定数モードのカット代欠落（qe-1 §4 の宿題）・初期費用別枠（絶対防衛線）・引き当てキー再検討（材料側 supplierId 化済みの現状確認）
3. QE 系以外の specs のナレッジ全量突き合わせ（§6 残宿題）

## 8. 本日の教訓
- **repo とプロジェクトナレッジは自動同期されない別の保管庫**。spec 確定のたびにナレッジ追加案内を handover に組み込む（鉄則4としてスキル化済み）
- **「一部だけ・後回し」は将来のエラーの温床**。同期系タスクは全件即時完了が原則（メモリー恒久化済み）
- 登録状況は記憶やファイル名一覧でなく検索で実体確認する（重複・欠落は名前だけでは見えない）
- claude.ai と Claude Code（VS Code）は別アプリ。コンテキスト操作は claude.ai 側・repo 操作は Claude Code 側、と迷ったら入口を確認する
