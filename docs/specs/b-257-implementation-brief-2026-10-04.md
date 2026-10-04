# B-257 実装ブリーフ — 「役割と権限」の表のはみ出しを直す（2026-10-04）

- 対象: shunya-pms・main `64ee0a6`（B-243 PR-3 = PR #183 のマージ後）を claude.ai 側で直接読んで作成（2026-10-04 22:35〜22:50 JST）
- 根拠: BACKLOG B-257。B-243 PR-3 で「画面」の表が5行になり、dev・本番とも右端の一般スタッフの列と、左の行名（発注・受注・納品…）が切れて読めない（2026-10-04 22:2x〜22:32 のスクリーンショット）。慎太郎さん 22:34「はい、それでいきましょう。」（PR-4 より先に B-257）
- 範囲: `src/app/(app)/settings/_components/role-permissions-form.tsx` だけ。schema・migration・action・validator は**触らない**
- spec との関係: B-205 spec v1.0 のモック案B の列（項目／オーナー／管理者／生産管理／経理／営業／デザイナー／一般スタッフ）と文言は変えない。見た目の幅と並びの作りだけを直す

## 1. 現状（main 64ee0a6 の現物）

- 表は2つ（設定の4行・「画面」の5行）。どちらも `<div className="overflow-x-auto rounded-md border"><Table>…`。`Table` 自身も `overflow-x-auto` の入れ物を持つ（入れ物が二重）
- `TableHead`・`TableCell` は shadcn の既定で `whitespace-nowrap`。「画面」の表の項目列は説明（AREA_HINTS・例「量産見積・概算見積・原価・BOM の単価」）も1行で伸びる
- 列の最小幅: 項目 110px・オーナー／管理者 各 90px・設定できる5役割 各 110px。Select は `w-[96px]`
- 8列の合計が、設定の右側の枠（左に目次があるので画面の半分強）に収まらず、横スクロールになる。スクロールすると項目列も流れていくので、どの行かが分からなくなる

## 2. 決定事項

- **D-1 項目の列を左に固定する**（両方の表）: 項目の `TableHead`・`TableCell` に `sticky left-0 z-10 bg-card`。横にスクロールしても行名が残る。右端に影の線を付ける（例 `shadow-[1px_0_0_0_var(--border)]` か `border-r`）
- **D-2 説明は折り返す**: 「画面」の表の項目のセルは `whitespace-normal` にし、幅を `w-[168px] min-w-[168px]` に固定。説明（AREA_HINTS）は2行まで折り返してよい。ラベル（AREA_LABELS）は1行のまま
- **D-3 選択の列を細くする**: Select の幅を `w-[84px]`、5役割の列の `min-w-[110px]` を外す（中身の幅に任せる）。オーナー・管理者の列の `min-w-[90px]` も外す
- **D-4 入れ物を一重にする**: 外側の `div` は `rounded-md border` だけにして `overflow-x-auto` を外す（`Table` の入れ物が横スクロールを持つ）。sticky が効く入れ物を1つにするため
- **D-5 変えないもの**: 列の並び・見出しの文字・「変更できる」「見る／隠す」の文字・aria-label・保存の動き・B-258 の対策（`<SelectValue>{VIS_LABELS[value]}</SelectValue>`）
- ★これで横スクロールが無くなるとは限らない（画面の幅しだい）。**狙いは「スクロールしても行名が読める」と「よくある幅（ノート PC の 1440px 前後）では一般スタッフの列まで収まる」**

## 3. 確認（dev・localhost:3001・管理者 dev-admin）

1. http://localhost:3001/settings/roles をいつもの幅で開く。設定の表・「画面」の表とも、一般スタッフの列の「見る／隠す」が切れずに見える
2. ブラウザの幅を狭くする（ウィンドウを半分くらいに）。表が横スクロールになっても、左の「項目」の列（自社情報…／発注・原価・見積・受注・納品・経理と説明）が残ったまま右の列だけ流れる
3. 値を1つ変えて保存 → Cmd+R で残っている → 元に戻して保存（今までと同じ動き）。一般スタッフ（dev-staff）で開いたときは「見る／隠す」の文字だけが並ぶ（選べない）

## 4. 本番への影響
- マージ＝Railway の main 自動デプロイ＝本番反映（不可逆）。見た目だけの変更。データ・権限の判定は変わらない
- migration なし

## 5. 作業の約束
- ブランチ `fix/b257-role-permissions-table-width`（main `64ee0a6` から）。PR 必須
- `npx tsc --noEmit`・触ったファイルの lint・`npx tsx src/lib/user-management.test.ts`・`npx next build`（dev サーバを止めて実行し、後で `.next` を消して dev を 3001 で起動し直す。止めてよい＝慎太郎さん了承済み）が通れば commit → push → PR open まで。マージは慎太郎さん
- 本書を `docs/specs/b-257-implementation-brief-2026-10-04.md` として PR に同梱する

## 6. 本 PR で作らないもの
- 列の統合（オーナー・管理者を1列にする等）・スマホ向けの縦並び表示（必要になったら別番号）
- B-258 の他の画面（closings-filters・client-form など）
- B-243 PR-4（マスターの取引条件）

END-OF-BRIEF-B257
