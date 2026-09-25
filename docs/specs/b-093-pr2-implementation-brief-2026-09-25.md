# B-093 PR-2 実装ブリーフ（スマートフォン表示：品番一覧のカード化と、狭い幅で絵型が潰れる問題）

- 日付: 2026-09-25
- 対象: B-093 モバイル対応の2本目（PR-1 ブリーフ D-8 で繰り延べた項目の一部）
- ライフサイクル: 横断（UI）
- schema / migration / action の変更: なし（画面のみ・revert 可）

## §0 一次資料

- PR-1（#167・803743a）マージ後、慎太郎さんが本番の iPhone で品番一覧を見て「本番が画像が細くなってる」（2026-09-25 15:19）
- read-only の実測（2026-09-25 15:24 JST・main 803743a）
  - `src/app/(app)/products/_components/products-table.tsx:78` 絵型 `<img className="h-24 w-24 rounded border object-cover">`、:56 列見出し `w-[112px]`（auto レイアウトでは希望幅でしかない）
  - `src/components/ui/table.tsx:86` TableCell 既定に `whitespace-nowrap`（:73 TableHead も同じ）、:11 外枠 `overflow-x-auto`
  - 原因: Tailwind preflight の `img { max-width:100%; height:auto }` により、絵型は高さ 96px のまま幅だけセル幅まで縮む。auto レイアウトの表ではパーセント max-width の画像は最小幅 0 扱い。ステータス・量産数・「詳細」は nowrap で縮まず、日本語の品名は 1 文字幅まで縮む。表がはみ出す前に列が縮み切るので横スクロールも起きない。→ 品名が 1〜2 文字で折り返し、絵型が縦長に切り抜かれる（M-033 の崩れも同じ原因）
- 品番カルテ `src/app/(app)/products/[id]/page.tsx:889` DetailRow `grid grid-cols-[160px_1fr]`（ラベル 160px 固定で、狭い幅では値が 1 語ずつ折り返す）

## §1 確定事項

- **D-1** 品番一覧は 768px（md）未満でカード表示、768px 以上は今の表。境界は PR-1 D-2 と同じ md
- **D-2** カード 1 枚 = 1 品番。左に絵型 80px の正方形（`shrink-0`・`object-cover`・無いときは今と同じ ImageOff の枠）、右に縦並びで 品名（折り返し可）／品番（primary・等幅）／社内品番（secondary があれば）／英名（あれば）／ブランド・シーズン・カテゴリ（小さめ・「品番と不一致」バッジも今と同じ条件で出す）／状態バッジ＋量産数（0 は「—」）。カード全体を `/products/{id}` へのリンクにする
- **D-3** 表（768px 以上）の絵型に `shrink-0 max-w-none` を足し、品名セルに最小幅（`min-w-[12rem]`）を付ける。狭いタブレット幅では表の中だけが横に動く
- **D-4** 品番カルテ DetailRow（page.tsx:889）を `grid-cols-[96px_1fr] sm:grid-cols-[160px_1fr]` にする
- **D-5** 今回やらないこと: 他の一覧（受注・発注・請求ほか約 39 ファイル）のカード化（画像列が無く、はみ出して横スクロールになるだけで潰れにくい・未確認）→ B-093 の3本目以降／タブレット幅のアイコン帯 → B-092

## §2 変更するファイル（予定）

| ファイル | 変更 |
|---|---|
| `src/app/(app)/products/_components/products-table.tsx` | md 未満のカード表示（D-1・D-2）を追加し、表を `hidden md:block` で包む。表の絵型と品名セル（D-3） |
| `src/app/(app)/products/[id]/page.tsx` | :889 DetailRow（D-4） |

★判定ロジック（isClassificationMismatch・primary/secondary・状態ラベル）はカードと表で共用し、二重に書かない。

## §3 確認（dev・http://localhost:3001）

1. iPhone 12 Pro（390px）で /products: カードで並び、絵型が正方形で潰れていない。品名が読める
2. カードを押すと品番カルテが開く
3. 「品番と不一致」「状態」「量産数」がカードにも出ている（表と同じ値）
4. 幅 800px 前後（Responsive で幅を入力）: 表で表示され、絵型が潰れていない。はみ出す分は表の中だけ横に動く
5. PC 幅（1280px）: 今と同じ表
6. 品番カルテの「品番・分類」で、工場名などの値が 1 語ずつ折り返さない

## §4 本番への影響

画面の見た目だけ。データ・schema・action は触らない。問題があれば revert で戻せる。
