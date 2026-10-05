# B-260 実装ブリーフ — 「役割と権限」の表で、固定した項目列の hover の色を行に合わせる（2026-10-05）

- 対象: shunya-pms・main caad256 を recon（2026-10-05 10:09 JST・read-only）して作成
- 根拠: BACKLOG B-260。B-257（PR #184）の dev 確認で観察（2026-10-04）。慎太郎さん 2026-10-05 10:05「はい、それで進みましょう。」（B-260 を単独の PR で先に出し、B-258 は調べてからブリーフにする）・10:08「元々のやり方で進めましょう。」
- 範囲: src/app/(app)/settings/_components/role-permissions-form.tsx だけ。schema・migration・action・validator・src/components/ui/table.tsx は触らない
- 重要度: 低（見た目だけ。保存・権限の判定は変わらない）

## 1. 現状（main caad256 の現物）

- TableRow の既定クラス（src/components/ui/table.tsx の TableRow）: border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted
- 項目列（B-257 D-1）は3か所で sticky left-0 z-10 border-r bg-card: 見出し :79（TableHead）／設定の表 :122（TableCell）／「画面」の表 :148（TableCell）。それぞれの行は :78・:121・:146 の TableRow
- 原因: 行の hover の色（半透明の muted 50%）は tr に付くが、固定セルは自分の不透明な bg-card を上に重ねるので、固定セルだけ元の色のまま残る。行の中の Select を開いている間（has-aria-expanded）も同じ
- 固定セルの背景は、横スクロールで下を流れる列を隠すため不透明でなければならない。bg-muted/50 をそのまま付けると透ける
- 色: --card は light 1 / dark 0.205、--muted は light 0.97 / dark 0.269（src/app/globals.css:61・69・96・104）

## 2. 決定事項

- D-1 行に group を付ける: :78・:121・:146 の TableRow に className="group"
- D-2 固定セルに、行と同じ見え方の不透明な色を付ける。3か所の固定セルに次の2つを足す

    group-hover:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))]
    group-has-aria-expanded:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))]

  color-mix で「card の上に muted を 50% 重ねた色」を不透明で作るので、透けず、行のほかのセルとほぼ同じ色になる。dark もトークンから計算されるので別の指定は要らない
- D-3 クラスの文字列は1か所の定数にまとめてよい（例 const STICKY_ROW_BG = "group-hover:bg-[...] group-has-aria-expanded:bg-[...]"）。Tailwind が拾えるよう、文字列リテラル全体をそのまま書く（文字列を組み立てない）
- D-4 dev の確認で、Select を開いている間に固定セルだけ色が残る（group-has-aria-expanded が効かない）場合は、group-has-[[aria-expanded=true]]: に置き換えて同じ PR に commit を足す。どちらで効いたかを PR 本文に書く
- D-5 採らなかった案: (1) group-hover:bg-muted（不透明だが行の見かけより一段濃い） (2) 疑似要素で色を重ねる（作りが重い） (3) この表だけ行の hover を消す（今の動きを変える）
- D-6 変えないもの: 文言・列・aria-label・保存の動き・B-257 の幅と固定・SelectValue の書き方（{VIS_LABELS[value]} を子に渡す形）

## 3. 確認（dev・localhost:3001・管理者 dev-admin）

1. http://localhost:3001/settings/roles を開き、設定の表・「画面」の表の各行にマウスを乗せる。左の項目列も含めて行全体が同じ色になる（項目列だけ白く残らない）
2. 行のプルダウン（見る／隠す）を開いている間も、項目列が行のほかのセルと同じ色
3. 見出しの行にマウスを乗せても、「項目」の見出しセルだけ色がずれない
4. ウィンドウを狭くして横スクロールし、項目列の下をほかの列が流れても透けて見えない（マウスを乗せている間も）
5. 保存は押さなくてよい（値は変えない）

## 4. 本番への影響

- マージ＝Railway の main 自動デプロイ＝本番反映（不可逆）。見た目だけ。データ・権限の判定は変わらない。migration なし

## 5. 作業の約束

- ブランチ fix/b260-sticky-hover-bg（main caad256 から）。PR 必須
- npx tsc --noEmit・触ったファイルの eslint・repo 全体の lint error 合計が着手前から増えていないこと、が通れば commit → push → PR open まで。マージは慎太郎さん
- 本書を docs/specs/b-260-implementation-brief-2026-10-05.md として PR に同梱する（ナレッジ claude/b-260-implementation-brief-2026-10-05.md と同じ本文）

## 6. 本 PR で作らないもの

- src/components/ui/table.tsx の既定を変えること（ほかの表すべてに効く）
- B-258（Select の空欄）。子なしの SelectValue は 65 ファイル・185 箇所（2026-10-05 10:02 の recon）。実際に空欄になる範囲と直し方（共通部品で直せるか）を別に調べてからブリーフにする
- B-258 の定義欄の訂正（role-permissions-form は B-243 の時点で対策済みで、子なしは 0）は締めで BACKLOG に追記する

END-OF-BRIEF-B260
