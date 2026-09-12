# B-202 品番カルテ 1画面化（案C・仕様書型）仕様確認書 v1.0 (2026-09-12)

- 種別: spec confirmation（確定版）。v0.1（同日・ナレッジのみ）を supersede する
- ライフサイクル: ステップ3（品番発番・品番カルテ）の横断UI。★背骨の新規ステップを開ける作業ではない
- 原マイルストーン: M番号なし（UI・情報設計）。M4（受注MVP）は B-148 PR-2b で到達済み
- 出典: メモ受信箱 M-008 / M-009 / M-010（慎太郎さん 2026-09-12）／ B-173 動線マップ v1.0 ／ B-094 縫製指示 v1.0 ／ B-101+B-096 進行 v1.0 ／ B-027 絵型 v1.1
- 実測: RECON-L（2026-09-12 08:45 / 09:18 / 09:21 JST・main 48f662d・read-only・DB 無触）
- ★本書にしかない識別文字列: RECON-L
- 起票: B-202（本書 §5-1 の範囲）＋ B-203（表示設定の共通基盤・将来）
- ★本ファイルはプロジェクトナレッジ `claude/b-202-product-karte-one-screen-spec-confirmation-v1_0-2026-09-12.md` と同一本文である。片方だけを編集しないこと

---

## 0. 結論（先に6行）

1. **案C（1画面固定＋引き出し）を採用**。案A（現状スクロール）・案B（タブ）は不採用
2. 1画面に置くのは **7面**（ヘッダ／絵型／品番・分類／縫製指示／SKU 数量／進行／メモ）。BOM・見積・原価・伝票・書類は引き出し
3. ★**進行はもともと直列ではなかった。** 本件は表示の修正であり、schema は変えない（B-101 v1.0 の設計を維持）
4. ★**メモは休眠中の `Comment` を起こす**（ログ型・履歴が残る）。`Product.internalNotes`（上書き型）は残したまま併存
5. ★**Comment の使わない機能は表示スイッチで隠す。今回は段階1（メモ欄の中だけ）**。最終的には画面横断の共通設定（段階3）を目指す → B-203
6. 関連書類（輸出インボイス等）はモデルが既存。本体は B-110 の領域で、カルテ側は紐付け一覧のみ

---

## 1. 確定事項

### D-1 案C（仕様書型・1画面）を採用する

現場の Excel 縫製仕様書（B-094 の一次資料 M-65 パッチJKT / 26A-SH01 ウエスタンSH）と同じ考え方を採る。
工場に渡せば作れる情報を固定の1画面に置き、金額・伝票・書類は引き出しで開く。

- 原文（M-009）「C案が良さそうですね」「概ね、入っていると思う」
- ★北極星「品番カルテで完結」（product-sample v1.0 §4-1）は維持する。完結は保つが、一度に見せる量を絞る

### D-2 1画面に置くもの（7面）

| # | 面 | 出所（すべて実在） |
|---|---|---|
| 1 | ヘッダ（社内品番・先方品番・状態・シーズン・数量・納期） | `Product.productCode` / `clientProductCode` / `status` / `season` / `productionQty` / `plannedDeliveryDate` |
| 2 | 絵型（タブ切替） | `Product.sketchImages`(Json) / `sketchThumbPath` |
| 3 | 品番・分類 | `categoryId` / `modelCodeId` / `clientId` / `brandId` |
| 4 | 縫製指示（固定5＋縫製6の11項目） | `Product.sewingInstructions`(Json)・B-094 |
| 5 | SKU 数量（色×サイズ） | `Sku` / `ProductColorway`・`quantity-matrix-section.tsx` |
| 6 | 進行 | `ProgressTask`（phase=PRODUCTION の12行）・B-101 |
| 7 | メモ（進行の直下） | ★`Comment`（D-7） |

引き出しへ送るもの: 資材表 BOM（1,285行）／マーキング実測（605行）／資材所要量／概算量産見積（2,064行）／量産見積／量産原価／受注／発注／★関連書類／サンプル製作ラウンド／メタ情報。

### D-3 絵型はタブにする（M-009 の2）

- `Product.sketchImages` は配列で、要素は `{gcsPath, thumbGcsPath, caption?, sortOrder}`（B-027 spec §2-1）
- 専用 action `product-sketches.ts` が配列まるごとを last-write-wins で更新している
- ★器は足りている。「前身頃／後身頃／仕様図／写真」を面として区別する属性は無いため、`caption` を面名に使うか面キーを足すかは §4 Q2

### D-4 進行は直列に描かない（M-009 の3）

- ★schema に直列の制約は無い。`ProgressTaskStatus` は5値（NOT_STARTED / IN_PROGRESS / DONE / BLOCKED / SKIPPED）で、B-101 v1.0 §3-5 は「仕上げができない工場の案件では FINISHING を SKIPPED にする」と確定済み
- ★自動算出は IN_PROGRESS までで、DONE は必ず人が押す（B-101 v1.0 §2・P16）。この原則は変えない
- したがって本件は表示の修正である。棒グラフ（直列の暗示）をやめ、行ごとの状態を色と形で描き分ける
- ★「行の並び順を案件ごとに変えたい」という読みが残る。`sortOrder` は列として存在するがユーザーが並べ替える action は存在しない（実測）。§4 Q3

### D-5 関連書類はカルテ側に「紐付けと一覧」だけを置く（M-009 の1）

- 貿易書類のモデルは既に schema にある（`TradeTransaction` / `CommercialInvoice` / `CommercialInvoiceItem` / `PackingList` / `PackingListItem` / `CertificateOfOrigin` / `FtaApplication` / `BillOfLading` / `AirWaybill` / `CustomsDeclaration` / `TradeDocumentFile` / `ImportExportComplianceLog`）
- 書類そのものの生成・管理は B-110 の領域。★本件で書類本体を作らない
- カルテ側は引き出しに「書類名・番号・発行日・紐付け先伝票・状態」の一覧を出すだけとする

### D-6 1〜6面は既存の列だけで描ける

RECON-L で全て実在を確認した。schema 変更が要るのは D-7（メモ）と、Q2 を「面キーを足す」で決めた場合のみ。

### D-7 ★メモは休眠中の `Comment` を起こす（M-010）

- 原文（M-010）「１で進めて不要な列を非表示にする設定を加えたい。」＝提示した案1（Comment 案）
- ログ型とする。誰が・いつ・何を書いたかが積み上がる。`Product.internalNotes`（上書き型・実装済み）は残したまま併存し、本件では触らない
- `Comment` は schema 完備・src 実使用ゼロの完全休眠。多態（`attachedToType` / `attachedToId`）なので、将来 発注・受注・見積にも同じ仕組みでメモを付けられる

初版で使う列:

    companyId / attachedToType("product") / attachedToId(productId) / content / contentFormat
    authorUserId / authorRole / createdAt / updatedAt / deletedAt

初版で使わない列（D-8 のスイッチで隠す）:

    parentCommentId・threadRootId（返信スレッド）／ mentionedUserIds・CommentMention（メンション）
    attachments（添付）／ commentType・priority（種別・重要度）
    isResolved・resolvedByUserId・resolvedAt・resolutionNotes（解決状態）
    isPinned（ピン留め）／ reactions（リアクション）／ language・translations（多言語）
    isEdited・editedAt・originalContent（編集履歴）★内部記録として使う可能性あり（Q6）

- ★社外ユーザー（B-172 の `role=EXTERNAL`）にメモを出さない。`Comment.isExternalAuthor` があるため将来は社外にも開ける設計だが、初版は既定拒否の側に置く（B-172 D-4 のホワイトリストに入れない）
- ★migration は ADD TABLE 相当（`comments` / `comment_mentions`）で非破壊。既存データは動かない

### D-8 ★表示スイッチは「段階1（メモ欄の中だけ）」で作る（M-010）

慎太郎さんの確定: 「最終は3まで行きたいが、今回は1で良い」。

| 段階 | 範囲 | 本件での扱い |
|---|---|---|
| 段階1 | メモ欄（Comment）の項目だけ | ★B-202 で作る |
| 段階2 | カルテ画面全体の表示項目（面・各面の項目・アイテム種別ごとの既定） | 送り |
| 段階3 | システム全体の共通仕組み（発注・受注・見積・納品にも効く） | ★最終目標。B-203 |

- 段階1 のスイッチ対象は D-7 の「使わない列」。既定はすべてオフ（本文・書いた人・日時だけの素朴なメモ欄で始める）
- ★スイッチの保存先は未確定（§4 Q4）。`CompanySetting` / `SystemConfiguration` が schema に実在するが実使用は未測定
- ★段階1 で作るスイッチは、段階3 の基盤ができたときにそこへ移す前提で設計する（設定の名前空間を分けておく）

---

## 2. 実測の根拠（RECON-L・2026-09-12）

### 2-1. 現状のカルテ詳細

- `src/app/(app)/products/[id]/page.tsx` = 677行。セクションは18（進行 / サンプル製作ラウンド / 基本情報 / 品番・分類 / シーズン / 数量・納期 / 絵型 / 色×数量 / 受注 / 資材表(BOM) / マーキング実測 / 資材所要量 / 縫製指示 / 概算量産見積 / 量産見積 / 量産原価 / 発注 / メタ情報）
- `_components` は23ファイル・7,977行。重い順に rough-estimate 2,064 / bom 1,285 / product-form 659 / colorway 616 / marking 605
- ★B-094 §4-1 のセクション順の記載は現物と一致した

### 2-2. メモの器（3つとも実在）

| 器 | 実測 |
|---|---|
| `Product.internalNotes` (Text) | 実装済み。`products/[id]/page.tsx:643-644` の「メタ情報」で表示。編集は `product-form.tsx:579`。validator は `optionalString(10000)`。Sample / SalesOrder / DeliveryNote でも同名列を使用 |
| `ProgressTask.notes` (Text) | 実装済み。`production-progress-checklist.tsx:136/170/172/236` で行ごとに保持。B-101 v1.0 §7 は「分納・部分完了はメモ欄に書く」と確定済み |
| `Comment` + `CommentMention` | schema 完備・src 実使用 0件（完全休眠）。D-7 の列一覧のとおり |

### 2-3. 進行

- `ProgressTaskStatus` = 5値。`ProgressTask` に直列の制約は無い（`sortOrder` の並びのみ）
- ★ユーザーによる並べ替え action は存在しない（sortOrder の書き込みは PROCESSING 行の自動採番のみ）
- ★`assigneeType` / `checkedByExternal` / `checkedAt` = 外部開放の受け皿が既にある（B-022 由来）

### 2-4. BACKLOG（重複起票の防止）

- 332行 / B行 201件 / 最大 B-201 / 番号重複なし。次番号は B-202
- 既存で受けている領域: 絵型 B-027/B-082/B-090（完了）／進行 B-096・B-101・B-106／書類 B-109・B-110／表示 B-132・B-176・B-091／メモ運用 B-160（★Google ドキュメント側の話で本件とは別物）
- ★引き継ぎメモ⑦の「BACKLOG は 201行」は件数を行数と書いた取り違え（正しくは 201件・332行）

---

## 3. 実装の骨子（実装ブリーフで詳細化する）

1. `products/[id]/page.tsx` を「1画面（7面）＋引き出し」に組み替える。各 Section コンポーネントは原則そのまま流用し、引き出しの中に入れる
2. 1画面側に、既存 Section の要約表示を新設する（絵型タブ・縫製指示11項目・SKU マトリクス・進行・メモ）
3. `Comment` を起こす: validator（Zod）／action（作成・編集・論理削除・一覧）／UI（メモ欄）。★全クエリに `companyId` を含める。★削除は `deletedAt` の論理削除。★特権アクセスは AuditLog に記録（プロジェクトの鉄則1・3・6）
4. 段階1の表示スイッチ（D-8）。保存先は Q4 の確定後
5. 引き出しの開閉状態を URL に持たせるかは §4 Q5

★migration 運用は変更なし: `prisma migrate dev` は使わない。`migrate diff` ドライラン → `db push` → 手書き migration → 出力と手書きの一致検証 → 本番は Railway の `migrate deploy`。`migrate reset` と `--accept-data-loss` は実行も提案もしない。
★実装ブリーフを書く前に `npx prisma migrate status` ほか3点を再実測する（design-reread の鉄則）。

---

## 4. 残る未確定（実装ブリーフまでに埋める）

- Q2 絵型の「面」の持ち方 — `caption` を面名として使うか、面を表すキーを足すか（後者は Json の形の変更）
- Q3 「順序通りにならない」の意味 — (a) 並行・対象外が画面から読めない＝表示の修正 / (b) 行の並び順を案件ごとに変えたい＝並べ替え action の新設 / (c) 両方
- Q4 ★段階1の表示スイッチの保存先 — `CompanySetting` / `SystemConfiguration`（実使用は未測定）を使うか新設か。あわせて「会社で1つ」か「ユーザーごと」か。★段階3（B-203）へ移せる形にする
- Q5 引き出しの形 — 下開き／右パネル／別ページ。URL に状態を持たせるか
- Q6 メモの編集履歴 — `isEdited` / `originalContent` を内部記録として使うか（表示はしない）
- Q7 A4 印刷（B-054 段1「品番サマリー1枚 PDF」）と同じ紙面にするか
- Q8 進行の状態（SKIPPED / BLOCKED）を画面が描き分けているか — ★未実測。`production-progress-checklist.tsx` に文字列ヒットが無かったが、ラベル定数を別ファイルから import している可能性があるため断定しない
- Q9 1画面に載せる「受注」 — 今は引き出しだが、B-171 が動き出すと1画面側に要るかもしれない

---

## 5. スコープ外と、それを受ける B番号

| 要件 | 受け先 |
|---|---|
| 貿易書類の本体（C/I・P/L・原産地証明・通関） | B-110 |
| 進行表ボード（品番×工程マトリクス） | B-096 |
| 納品書による進行タスクの自動算出 | B-106 |
| 休眠機能のグレー表示 | B-132 |
| 先方品番の明記位置 | B-176 |
| 品番サマリー1枚 PDF | B-054 |
| サンプル側の DONE 判定の是正 | B-104 |
| 外部（工場）による進行チェック | B-022 |
| メモを社外ユーザーに開放するか | B-172（既定拒否のまま） |
| ★表示項目の出し分け 段階2・段階3 | B-203（新規） |

### 5-1. B-202 に含める範囲

含める: 1画面化（7面）／絵型タブ／進行の表示修正／メモ欄（Comment を起こす）／段階1の表示スイッチ／関連書類の紐付け一覧のみ。
含めない: 上の表の10件。

### 5-2. B-203（新規起票）

表示項目の出し分けの共通基盤（段階2・段階3）。品番カルテだけでなく発注・受注・見積・納品でも、画面に出す項目を設定で切り替えられるようにする。★慎太郎さんの最終目標（M-010・2026-09-12「最終は3まで行きたいが、今回は1で良い」）。B-202 の段階1スイッチは、本番号の基盤ができたらそこへ移す。

---

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-09-12 | v0.1 | 初版（ナレッジのみ）。D-1〜D-6 を確定、Q1〜Q7 を未確定として残す |
| 2026-09-12 | v1.0（本版） | Q1 を確定（メモ＝`Comment` を起こす＝D-7）。D-8（表示スイッチは段階1・最終目標は段階3）を追加。B-203 を起票対象に追加。未確定を Q2〜Q9 に整理 |
