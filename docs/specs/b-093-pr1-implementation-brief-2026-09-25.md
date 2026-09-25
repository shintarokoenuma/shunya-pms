# B-093 PR-1 実装ブリーフ（スマートフォン表示：メニューの出し方とカルテ上部）

- 日付: 2026-09-25
- 対象: B-093 モバイル対応（レスポンシブ）の1本目
- ライフサイクル: 横断（UI）
- schema / migration / action の変更: なし（画面のみ・revert 可）

## §0 一次資料

- 仕様書 Part4 §8.3「レスポンシブWebサイト＋PWA」。モバイル優先機能は 写真のアップロード・進捗の確認と更新・案件一覧の閲覧・見積の確認
- `sidebar-ui-design-2026-05-27.md` §5.6「サイドバーがモバイル時にどう変形するか（ハンバーガーメニュー、ボトムタブ等）を別途設計する」＝未決だった
- メモ受信箱 M-033（2026-09-24・iPhone のスクリーンショット2枚）: サイドバーが画面の半分を占めたまま畳めない／品名が1〜2文字で折り返す／カルテのラベルが縦に崩れる
- 参考画面（3案）: https://claude.ai/artifact/W78UWGaWL6LYx8BZATdcoy （A 現状／B ハンバーガー／C 下部タブ）
- read-only の実測（2026-09-25 13:34 JST・main 51a9c9c）
  - `src/components/app-shell/sidebar.tsx:6` `<aside className="w-64 shrink-0 border-r bg-card flex flex-col h-screen sticky top-0">`（256px 固定・畳む指定なし）
  - `src/components/app-shell/app-shell.tsx:30-36` 外枠 `flex min-h-screen` → Sidebar ＋ `flex-1 flex flex-col min-w-0` → main `max-w-7xl mx-auto px-6 py-8`
  - `src/components/app-shell/header.tsx:17` `h-16 … px-6 sticky top-0 z-10`。左に会社名（:19）と MASTER_ADMIN の「管理者モード」（:20-24）、右に GlobalSearchTrigger（:28）と UserMenu（:29-34）
  - app-shell / header / sidebar / sidebar-nav / (app)/layout.tsx の sm: / md: / lg: はすべて 0。user-menu.tsx:30 に `hidden sm:block`、global-search-dialog.tsx:137 に kbd の sm: 指定のみ
  - `src/components/ui/` に sheet / drawer は無い（dialog / dropdown-menu / popover はある）
  - viewport 指定なし（Next.js 既定の width=device-width で足りる）／manifest なし
  - 品番カルテ `src/app/(app)/products/[id]/page.tsx:366` `<dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm …">`、HeaderStat は :898 `flex items-baseline gap-1.5`。本文2カラム :428 は `lg:` 済み
  - `src/components/ui/table.tsx:11` が表を `overflow-x-auto` で包んでいる（表は全画面で横スクロール可）

## §1 確定事項

- **D-1** 案B（左上の ☰ から全メニューを出す）で始める。下部タブ（案C）は使ってみて欲しくなったら後で足す。慎太郎さん原文「B で始めて後で C」（2026-09-25）
- **D-2** 境界は `md`（768px）。768px 未満でサイドバーを隠し、ヘッダ左に ☰ を出す。768px 以上は今と同じ
- **D-3** ☰ を押すと、左からメニューのパネルが出る（幅は 288px・画面の 85% を上限）。中身は `SidebarNav` をそのまま使う（並び・enabled・hidden は PC と同じ）。項目を押すと閉じる。外側のタップと Esc でも閉じる。ページを移動したら必ず閉じる
- **D-4** パネルの部品は shadcn の sheet を `src/components/ui/sheet.tsx` に追加して使う。追加できない場合は既存の `dialog` を左寄せにして作る。★新しい npm パッケージは増やさない（sheet が使う Radix の Dialog が既に入っていれば可。入っていなければ dialog の流用に切り替える）
- **D-5** ヘッダ（768px 未満）: 左に ☰・P のロゴ・「PMS」。会社名は 640px（sm）未満で隠す。★「管理者モード」の表示は隠さない（参考画面では省いたが、特権状態の表示なので残す・モックからの逸脱）。検索は 640px 未満ではアイコンだけにする（⌘K の表示は既に隠れている）
- **D-6** 本文の余白: 768px 未満は `px-4 py-4`、768px 以上は今と同じ `px-6 py-8`。ヘッダの左右余白も 768px 未満は `px-3`
- **D-7** 品番カルテ上部のシーズン・クライアント・想定数量・希望納期・担当者: 640px 未満は2列のマス目（ラベルを上・値を下）、640px 以上は今の横並びのまま
- **D-8** 今回やらないこと（既存の番号で受ける・新規採番しない）
  - 品番一覧のカード表示・各画面の表の列幅・`page.tsx:889` の `grid-cols-[160px_1fr]` → B-093 の2本目
  - タブレット幅（768〜1023px）でサイドバーをアイコンの帯に畳む → B-092
  - 下部タブ（案C） → B-093 の定義欄に追記
  - PWA（ホーム画面への追加・manifest） → B-093 の定義欄に追記

## §2 変更するファイル（予定）

| ファイル | 変更 |
|---|---|
| `src/components/ui/sheet.tsx` | 新規（D-4） |
| `src/components/app-shell/mobile-nav.tsx` | 新規。☰ ボタン＋パネル＋ページ移動で閉じる処理（client component） |
| `src/components/app-shell/sidebar.tsx` | `hidden md:flex` を足す |
| `src/components/app-shell/header.tsx` | 768px 未満で MobileNav とロゴを出す。会社名を 640px 未満で隠す。余白 |
| `src/components/app-shell/global-search-dialog.tsx` | 640px 未満はアイコンだけ（トリガーの文字を隠す） |
| `src/components/app-shell/app-shell.tsx` | main の余白（D-6） |
| `src/app/(app)/products/[id]/page.tsx` | :366 の dl と :898 の HeaderStat（D-7） |

★`SidebarNav` を PC とスマホの両方で使うので、SidebarNav の中身は変えない。パネルを閉じる処理は MobileNav 側で持つ（リンクのクリックを拾うか、pathname の変化で閉じる）。

## §3 確認（dev・http://localhost:3001）

Chrome の開発者ツールで端末を「iPhone 12 Pro（390px）」にして見る。最後に PC の幅に戻して見る。

1. 品番カルテ（例 /products/2cbb64eb-b597-41d0-a94a-471f61bedbfb）: サイドバーが無く、本文が画面いっぱいに出る
2. ヘッダ左の ☰ でメニューが左から出る。並びが PC と同じ（案件・取引・マスター）。型番は出ない（hidden のまま）
3. メニューの項目（例: 受注）を押すと、その画面に移り、パネルが閉じる
4. パネルの外側のタップ・Esc で閉じる
5. カルテ上部のシーズン〜担当者が2列のマス目に並ぶ
6. 検索のアイコンを押すと検索が開く。ユーザーメニューが開く。「管理者モード」が出ている
7. 品番一覧・受注一覧を開いて、横にはみ出してページ全体が横に動かない（表の中だけ横に動くのは可）
8. PC の幅（1280px）に戻すと、サイドバー・ヘッダ・カルテ上部が今と同じ見た目

## §4 本番への影響

画面の見た目だけ。データ・schema・action は触らない。問題があれば revert で戻せる。
