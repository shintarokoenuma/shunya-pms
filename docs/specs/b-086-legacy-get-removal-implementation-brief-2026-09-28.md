# 実装ブリーフ: 使われていない単票の発注書 PDF（GET）を消す（B-086 §99 の決定）

## 0. 決定
- 慎太郎さん 2026-09-28 22:08 JST「Aで進めて下さい。」
- 対象: GET /api/purchase-orders/[id]/pdf と GET /api/work-orders/[id]/pdf
- 理由: 画面・scripts からの呼び出しが0件（2026-09-28 実測）。認証は画面と同じログインで、外部連動の用途は無い。この経路で出すと GCS の控え（order-pdf-archive）を通らない
- 触らないもの: POST /api/purchase-orders/pdf・POST /api/work-orders/pdf・order-pdf-archive・order-document.tsx（C# の二重表示は別件で起票予定。今回は直さない）

## 1. 手順
date
cd ~/shunya-production-system
git switch main && git pull --ff-only
git switch -c feat/b086-remove-legacy-order-pdf-get

### 1-1. 消す前の確認（呼び出しが増えていないこと）
grep -rn -E 'orders/\$\{[^}]*\}/pdf|orders/[^/"]+/pdf' src scripts | grep -v '^src/app/api/'
→ 0 行であること。1 行でも出たら止めて報告する
ls 'src/app/api/purchase-orders/[id]/pdf/route.ts' 'src/app/api/work-orders/[id]/pdf/route.ts'
→ 2 本とも存在すること（陽性対照）

### 1-2. 消す
git rm 'src/app/api/purchase-orders/[id]/pdf/route.ts' 'src/app/api/work-orders/[id]/pdf/route.ts'
消したあとに空になる [id]/pdf ・ [id] ディレクトリが残れば消す。★[id] の下にほかの route があれば残す（ls で確かめて報告する）

### 1-3. 一括ルートのコメントを直す
grep -n -F '[id]/pdf' src/app/api/purchase-orders/pdf/route.ts src/app/api/work-orders/pdf/route.ts
「既存 GET /api/…/[id]/pdf は残す（本 PR では削除しない）。」の行を、
「旧 GET /api/…/[id]/pdf は 2026-09-28 に削除（B-086 §99・慎太郎さんの判断）。」に置き換える（PO・WO それぞれ1行）

### 1-4. 使われなくなる関数の確認（消さずに報告だけ）
grep -rn 'renderOrderPdfBuffer\b' src
→ 定義以外で使っている所が0件になるなら報告する。今回は消さない

## 2. 検査
npx tsc --noEmit
npx eslint 'src/app/api/purchase-orders/pdf/route.ts' 'src/app/api/work-orders/pdf/route.ts'
全体の lint は既存の error 数から増えていないこと（main の数と比べて報告する）

## 3. dev での確認（http://localhost:3001・dev=hopper:12921）
★このブランチに git switch 済みの状態で、dev サーバを起動し直す（PORT=3001 npm run dev）
1. PO の詳細を1件開き、PDF のプレビューが今までどおり出る
2. WO の詳細を1件開き、PDF のプレビューが今までどおり出る
3. ログインしたブラウザで /api/purchase-orders/<1 の PO の id>/pdf を開くと 404
4. 同じく /api/work-orders/<2 の WO の id>/pdf が 404
★未ログインの curl は src/proxy.ts が /login へ 307 で転送するので、3・4 はブラウザで確かめる

## 4. Git / PR
- 本ブリーフを docs/specs/b-086-legacy-get-removal-implementation-brief-2026-09-28.md として同じ PR に入れる。保存後に次で確認する:
  tail -1 docs/specs/b-086-legacy-get-removal-implementation-brief-2026-09-28.md
  → 最終行が終端の行でなければ exit 1 で止める（件数は数えない。本文にこの手順の説明が入るため）
- 型と触ったファイルの lint がクリーンなら、commit → push → PR open まで自走してよい。マージは慎太郎さん
- commit の末尾: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- PR 本文には「本番への影響: 誰も使っていない URL 2本が 404 になる。画面の動作は変わらない。migration なし」と書く

## 5. 報告してほしいもの
1-1 の grep 結果（0 行か）／1-2 で消したディレクトリ／1-3 の差分／1-4 の結果／tsc・lint の結果／dev §3 の4点／PR の URL

END-OF-BRIEF-B086-LEGACY-GET
