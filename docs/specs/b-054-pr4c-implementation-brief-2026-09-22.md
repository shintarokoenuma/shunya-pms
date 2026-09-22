# 実装ブリーフ — B-054 PR-4c 縫製仕様書 PDF の出力ダイアログ（品番カルテから開く）

- 作成日: 2026-09-22 11:27 JST（date 取得）/ claude.ai
- 元になる仕様: v1.0（§0「出力前にページを選ぶ画面」・§5-3「各ページにどの絵型を載せるかは出すときに選ぶ・割り当てを保存する列は作らない」）／addendum v0.2 §3（4c の範囲）・D-34・D-35／v0.4 D-51〜D-55／v0.5
- 参考画面: https://claude.ai/artifact/USwXvJacifXYEYXx7qTMT6 （2026-09-22 11時台）
- 慎太郎さんの回答（原文）: 「モックの既定で進めてくだい。」（3枚目の加工 WO を既定で全部チェックするか、への回答を含む）
- 起点 commit: 58b56a9（2026-09-22 11:00 JST 実測・main）
- ライフサイクル: 5（仕様書）／8（量産発注＝工場へ渡す帳票）
- schema 変更: **なし**（migration なし）。PDF のルート（4a・4b）も変えない
- ★本書は addendum v0.6 を兼ねる（D-63〜D-70）。MEMO_INBOX へは締めで M-023 として索引を同期する

---

## 0. 実測（2026-09-22 11:00 JST・read-only・main 58b56a9）

| # | 実測 | 帰結 |
|---|---|---|
| 1 | カルテ `src/app/(app)/products/[id]/page.tsx` のヘッダ操作は「編集」ボタン＋`ProductActions`（352-364 行付近） | 「縫製仕様書」ボタンは「編集」の左に足す |
| 2 | `getProductOrders(productId)`（src/lib/actions/product-orders.ts）が PO/WO を返す。WO の select に **workType が無い**。`ProductOrderRow` は kind / id / number / status / title / counterpartyName / subtotalJpy / currency / workCategory / createdAt | workType（と sampleRound）を select と型に足す。page.tsx は既に `productOrders` を取得済みなので新規クエリは足さない |
| 3 | `getProductSketchUrls(productId)` が gcsPath / url / thumbUrl / caption / sortOrder を sortOrder 順で返す | 画像の選択に使う（新しい action は作らない） |
| 4 | `src/components/pdf/pdf-preview-dialog.tsx` の `usePdfPreview().open(endpoint, ids, fallbackName)` は POST `{ids}` 専用。`PdfPreviewDialog` は iframe＋ダウンロード。`order-pdf-preview-button.tsx` は DL 時に GCS 控え（/api/order-pdf-archive）を呼ぶ | 縫製仕様書のルートは GET＋クエリなので、hook に GET で開く関数を足す（既存の open は変えない）。控えの保存は PO/WO 専用なので呼ばない |
| 5 | shadcn の dialog / checkbox / radio-group / select / switch は src/components/ui/ に既存 | 追加インストール不要 |

## 1. 確定事項（addendum v0.6 相当）

| # | 事項 | 出典 |
|---|---|---|
| D-63 | 入口は品番カルテのヘッダ、「編集」の左に「縫製仕様書」ボタン。押すとダイアログが開く | モック §1 |
| D-64 | ダイアログは 1枚目（縫製工場用）・2枚目（採寸用）・3枚目（加工工場用）をチェックで選ぶ。ページごとに宛先 WO と画像を選ぶ。宛先の候補は D-34 の条件の WO だけ（1枚目＝SEWING／2枚目＝SEWING か INSPECTION／3枚目＝PRINTING・EMBROIDERY・WASHING・DYEING・FINISHING）。候補が無いページは灰色にして「この品番に◯◯の作業発注がありません。作業発注を作ると選べます」 | モック §2・D-21・D-34 |
| D-65 | 既定: 候補があるページだけチェック済み。宛先は量産（PRODUCTION）を先に、その中で新しい順の先頭。3枚目は加工 WO を全部並べ、**既定は全部チェック**（加工工場ごとに1枚・D-5） | モックの既定表・「モックの既定で進めてくだい。」 |
| D-66 | 画像はサムネを押した順に番号が付き、その順で紙面に載る。上限は 1枚目 1・2枚目 2・3枚目 4（WO ごと）。既定は sortOrder 最小の絵型1つ。2枚目だけ、キャプションに「サイズ」を含む画像（1つ目と別のもの）があれば2つ目に自動で選ぶ | モック §2・v1.0 §5-3・v0.4 D-51 / D-53 |
| D-67 | ページの順は 1枚目 → 2枚目 → 3枚目（3枚目の中は WO の並び順）。クエリは D-35 の形で組み立てる（`page=sewing:<woId>:<sortOrders>&page=measure:…&page=process:…`） | D-33・D-35 |
| D-68 | 出力は「プレビュー」→ 発注書と同じプレビュー画面（B-086 の PdfPreviewDialog）→ ダウンロード。GCS 控えの保存は行わない（控えの API は PO/WO 専用） | モック §2・§0 の4 |
| D-69 | 選んだ内容は保存しない（開くたびに既定から選び直す） | v1.0 §5-3 |
| D-70 | ★モックからの逸脱: フッターの「全 N ページ」は、付属のつづきを数えず「選んだ枚数（付属が16行以上なら1枚目のあとに『付属のつづき』が自動で付きます）」と出す。付属の行数を画面に持ってくるためだけに取得を増やさないため | Claude 既定（変更可） |

## 2. 変えること

1. `src/lib/actions/product-orders.ts`: WO の select に `workType`・`sampleRound` を足し、`ProductOrderRow` に `workType: WorkOrderType | null`・`sampleRound: string | null` を足す（PO 行は null）。既存の呼び出し側（ProductOrdersSection ほか）が壊れないこと
2. `src/components/pdf/pdf-preview-dialog.tsx`: `usePdfPreview` に GET で開く関数（例 `openUrl(url, fallbackName)`）を足す。既存の `open`（POST）は変えない
3. 新規 client component（例 `src/app/(app)/products/_components/sewing-spec-dialog.tsx`）: D-63〜D-70 のダイアログ。shadcn の Dialog / Checkbox / Select を使う。WO の表示は「WO番号　相手先名　作業の種類（WORK_ORDER_TYPE_LABELS）　区分の札（kindLabel と同じ規則）」。サムネは getProductSketchUrls の thumbUrl
4. `src/app/(app)/products/[id]/page.tsx`: ヘッダにボタンを置き、`productOrders`（WO だけ）と絵型の一覧を渡す。絵型の一覧が page.tsx で既に取得済みならそれを使い、無ければ getProductSketchUrls を1回呼ぶ
5. PDF のルート・紙面（4a・4b）は変えない

## 3. 守ること

- 全クエリに companyId（既存の action を使うので追加のクエリは作らない想定）
- setState を useEffect の中で同期的に呼ばない（React Compiler の lint・B-129 の既存 11 件を増やさない）
- 固定文言に ※ ～ ① ℃ ㎝ を使わない必要は PDF だけだが、画面の文言もモックの原文に合わせる
- 権限: ボタンはログインユーザー全員に出す（ルート側が auth と companyId で守っている）

## 4. 検証

- 触ったファイルの tsc / eslint がクリーン。全体 lint は 11 errors / 24 warnings から増えない
- dev（localhost:3001）: AOI-26SS-M-TS-001 のカルテでボタン → ダイアログ → 既定のチェック・宛先・画像 → プレビュー → ダウンロード。確認用の WO（SEWING×PRODUCTION f4da7a02…・SEWING×SAMPLE 5c01dba0…・WASHING×SAMPLE の [B-054 4b 確認用]）と絵型4枚が dev にある
- 候補が無いページの表示は、絵型も WO も無い別の品番のカルテで見る

## 改訂履歴

| 日付 | 内容 |
|---|---|
| 2026-09-22 | 新規。11:00 の read-only 実測と参考画面・「モックの既定で進めてくだい。」を反映。D-63〜D-70 |

END-OF-BRIEF-B054-PR4C
