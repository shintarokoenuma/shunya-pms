# B-114 PR-1 実装ブリーフ — 量産の納品書（受注から引き当て）（2026-09-22）

- 上位仕様: docs/specs/b-109-b-114-b-123-billing-spec-confirmation-v1_0-2026-09-22.md §2-1（D-2・D-17・D-19）
- 前提の実測: 2026-09-22 16:32 JST read-only recon（main d0470aa・dev hopper:12921）
- schema 変更: **なし**（DeliveryNoteItem.skuId / soId / soItemId と DeliveryNote.primarySoId / relatedSoIds は既存の休眠列。SoItem.deliveredQuantity / remainingQuantity・Sku.deliveredQuantity も既存）
- ブランチ: `feat/b-114-pr1-mass-delivery-note`

## 0. やること（1行）

納品書の引き当てダイアログに「受注（量産）」タブを足し、受注明細（SKU）から 1 SKU＝1行で明細を作れるようにする。単価は受注の単価を初期値にして行ごとに直せる。納品書を納品完了にした時、受注と SKU の納品済み数を算出し直す。

## 1. 現状（実測）

- `src/lib/actions/delivery-allocation.ts`（369行）`listAllocationCandidates(clientId)` は SAMPLE / WO 明細 / PO 明細の3種だけ。受注・SKU は見ていない。
- `allocation-dialog.tsx` はタブ SAMPLE / ORDER（＝発注明細）。`AllocationPickedRow` に skuId が無い。
- `validators/delivery-note.ts` の明細に skuId / soId / soItemId が無い。
- `delivery-notes.ts` `prepareDeliveryNote` は `skuId: null` 固定。受注・SKU の納品済み数を更新する処理は無い。
- `delivery-note-form.tsx` の `ItemRow` に skuId が無い。色・サイズは手入力。
- 手本: `sales-orders.ts` `recomputeSkuOrderedQuantities`（aggregate で算出し直して書く・delegate 注入で tx 内から呼ぶ）。
- `SalesOrderStatus`: TENTATIVE / CONFIRMED / IN_PRODUCTION / PARTIAL_DELIVERED / DELIVERED / COMPLETED / CANCELLED / ON_HOLD。

## 2. 変更

### 2-1. 候補の取得（delivery-allocation.ts）

- `AllocationCandidates` に `soItems: AllocationCandidateSoItem[]` を足す（既存の samples / orders / blocked / groups は不変）。
- 対象の受注: `companyId`・`clientId`・`deletedAt: null`・`isLatest: true`・`status in [CONFIRMED, IN_PRODUCTION, PARTIAL_DELIVERED, DELIVERED]`（TENTATIVE / ON_HOLD / CANCELLED / COMPLETED は出さない）。
- 1候補 = 1 SoItem（= 1 SKU）。持たせる値:
  - soId / soNumber / soItemId / skuId / productId
  - colorName（`ProductColorway.clientColorName` があればそれ、無ければ `Sku.colorName`）/ size（`Sku.size`）/ sizeOrder
  - orderedQuantity / unitPrice（SoItem.unitPrice・null 可）
  - **deliveredQuantity** = この soItemId を持つ納品書明細のうち、納品書が `deletedAt: null` かつ `status in [DELIVERED, RECEIVED]` の数量合計
  - **allocatedQuantity** = 同じく `status in [DRAFT, PENDING_APPROVAL, APPROVED, SHIPPED, IN_TRANSIT]` の数量合計（他の納品書に引き当て中）
  - remainingQuantity = orderedQuantity − deliveredQuantity − allocatedQuantity（マイナスは 0 で表示）
- SoItem → Sku → ProductColorway は scalar FK（house style）なので別クエリ＋Map で解決する（既存の Brand と同じやり方）。
- 並び: 受注番号 → 品番 → 色 → sizeOrder。

### 2-2. ダイアログ（allocation-dialog.tsx）

- タブを3つにする: サンプル／発注／**受注（量産）**。ボタン名「発注・サンプル・受注から引き当て」。
- 受注タブ: 受注番号の見出し → 品番の見出し（GroupHeading を流用）→ SKU 行（チェック・色・サイズ・受注・納品済・引当中・残り・単価）。
- 選んだ行の数量の初期値: 残り > 0 なら **残り**、残り ≤ 0 なら **空欄**（フォームの「1以上の整数」チェックで人が入れる）。残り 0 の行も候補には出し、チェックはできる（追加納品があり得るため）。
- 追加する行: productId / productName（Product.productName）/ clientProductCode（Product.clientProductCode）/ colorName / size / quantity / unit「枚」/ unitPrice（受注の単価・null なら空）/ **skuId / soId / soItemId** / **orderUnitPrice**（受注の単価・画面の差分表示専用）/ source* は null。
- 同じ soItemId をすでに明細に持っているときは、候補に「この納品書に追加済み」と出してチェックを外す（重複行の防止・UI のみ）。

### 2-3. フォーム（delivery-note-form.tsx）

- `ItemRow` / `emptyRow` / `handleAllocationAdd` / 送信ペイロードに skuId / soId / soItemId / orderUnitPrice を足す（orderUnitPrice は送らない）。
- **skuId がある行**（量産行）:
  - 品名の左に「量産」バッジ。色・サイズは読み取り専用（SKU と食い違わないように）。品番の選択も変更不可。
  - 単価が受注の単価と違うとき、行の背景を薄い警告色にし、単価欄の下に「受注 ¥2,800」と出す（参考画面の案A の見え方）。違うこと自体は正常（D-2）。
- 編集ページの初期値（getDeliveryNote → initial.items）にも skuId / soId / soItemId を載せ、orderUnitPrice は getDeliveryNote で SoItem.unitPrice を引いて渡す。★編集で量産行が手入力行に化けないことが受け入れ条件。

### 2-4. validator（validators/delivery-note.ts）

- 明細に `skuId` / `soId` / `soItemId`（optionalRelationId）を足す。
- superRefine: `soItemId` があれば `skuId` と `soId` も必須（「量産の明細は受注の SKU が必要です」）。

### 2-5. 保存（delivery-notes.ts `prepareDeliveryNote`）

- 量産行（soItemId あり）をサーバで検証する（UI 任せにしない）:
  - SoItem が存在し、親の受注が `companyId` 一致・`deletedAt: null`・**clientId が納品書の clientId と一致**・status が 2-1 の対象
  - SoItem.skuId === 行の skuId、Sku.productId === 行の productId、Sku.companyId 一致
  - 1つでも外れたら `{ ok:false, error: "受注の明細と一致しない行があります（品番・SKU・クライアントを確認してください）" }`
- itemRows: `skuId: it.skuId ?? null`・`soId`・`soItemId` を入れる（`skuId: null` 固定をやめる）。
- ヘッダ: 量産行があれば `primarySoId` = 最初の soId、`relatedSoIds` = soId の重複なし配列。無ければ両方 null。
- ★サンプル行・発注行・手入力行の挙動は変えない。
- ★受注の数量を超えて引き当てても保存は止めない（分納・追加納品があり得る）。候補の「残り」で気づける。

### 2-6. 納品済み数の算出（D-17）

- 新しい関数 `recomputeDeliveredQuantities(tx, companyId, { soItemIds, skuIds })`（delivery-notes.ts 内・非 export で可）:
  - 各 soItemId: 納品書明細の数量合計（納品書 `companyId`・`deletedAt: null`・`status in [DELIVERED, RECEIVED]`）→ `SoItem.deliveredQuantity`、`remainingQuantity = max(orderedQuantity − deliveredQuantity, 0)`
  - 各 skuId: 同じ条件で skuId の数量合計 → `Sku.deliveredQuantity`
  - 加減算ではなく **毎回算出し直す**（DELIVERED から戻した・取消した時も同じ関数で正しくなる）
- 呼ぶ場所: `updateDeliveryNoteStatus`。状態更新と AuditLog と recompute を **1つの $transaction** に入れる。対象はその納品書の明細の soItemId / skuId（null を除く）。
- 受注の状態（PARTIAL_DELIVERED / DELIVERED への自動遷移）は **本 PR では変えない**（spec に無い・別途起票）。

### 2-7. 詳細画面（deliveries/[id]/page.tsx）

- 量産行の品名の横に「量産」バッジと受注番号（soId から引く）を出す。列構成は変えない。

## 3. 変えないもの

- schema・migration・サンプル／発注の引き当て・宛先解決・採番・金額計算（Math.round のまま）・ステータスの UI 4値・DRAFT 以外の編集禁止。

## 4. ゲート（Claude Code が自走してよい範囲）

- 型: `npx tsc --noEmit` がクリーン。
- lint: **触ったファイル**で error 0。全体 lint は既存 error が増えていないこと（baseline と比較）。
- commit → push → PR open まで自走してよい。**マージは慎太郎さん**。

## 5. dev での確認（localhost:3001・dev DB hopper:12921）

★dev の受注で使えるのは SO-2026-0002（CONFIRMED・葵アパレル[ダミー]・1明細・数量2・単価あり）だけ。SO-2026-0004（TENTATIVE・数量100・単価なし）を画面で「確定」にすると2件目の素材になる（dev のみ）。

1. 納品書の新規 → クライアント「葵アパレル[ダミー]」→ 引き当て → **受注（量産）タブ**に SO-2026-0002 の SKU が出る（受注2・納品済0・引当中0・残り2・単価あり）
2. 追加 → 明細に「量産」バッジの行。色・サイズが読み取り専用。単価が受注の単価
3. 単価を変える → 行の色が変わり「受注 ¥…」が出る
4. 保存（DRAFT）→ 詳細に「量産」バッジと受注番号。もう一度新規で引き当てると、その SKU の **引当中** が増えている
5. （DRAFT のうちに）編集画面を開いて保存し直す → 量産行が量産行のまま（バッジ・読み取り専用・受注の単価の表示が残る）
6. 詳細で状態を **納品完了** → 受注明細の納品済み数・残り、SKU の納品済み数が変わる（read-only SQL で確認）
7. 状態を **出荷済み** に戻す → 納品済み数が 0 に戻る
8. 回帰: サンプル／発注タブの引き当て・手入力行の保存・金額表示が今までどおり

## 6. 起票候補（締めで BACKLOG を grep してから）

- 受注の状態を納品に合わせて PARTIAL_DELIVERED / DELIVERED に進めるか（B-186 と同型の業務判断）
- 受注数を超える引き当ての扱い（警告を出すか）

END-OF-BRIEF-B114-PR1
