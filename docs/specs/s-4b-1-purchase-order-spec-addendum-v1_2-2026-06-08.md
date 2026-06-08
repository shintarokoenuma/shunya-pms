# 仕様追補議事録 — S-4b-1 仕入先発注（PO）明細 サイズ数値化・単位調整（v1.2 確定版）

- 作成日: 2026-06-08 / Claude.ai
- 作成者: 慎太郎さん + Claude
- バージョン: **v1.2（確定・実装着手可能）**
- 位置づけ: v1.1（実務化）をローカルで実際に操作した結果のUI改善。明細フォームの「サイズ」入力が打ちづらかったため、数値＋単位に分解する。
- 上位仕様: `docs/specs/s-4b-1-purchase-order-spec-addendum-v1_1-2026-06-08.md`（v1.1）
- 前提: PR #64（未マージ）に積み増す。**本番にはまだ S-4b-1 系の migration が1本も入っていない**（v1.1 の `s4b1_po_item_practical_fields` も dev のみ・未マージ）。

---

## 0. 経緯（なぜ v1.1 を作り替えるか）

v1.1 で `sizeSpec`（VarChar100・文字列1本）として実装したサイズ欄を、ローカルで実際に操作したところ「`20cm` のように数値と単位を1欄に打つのが面倒」と判明。慎太郎さんの判断で、**数値と単位を分ける（A案）** へ方針転換する。

v1.1 時点では「単位混在（cm/mm/リーニュL）で統計が成立しにくい」ため文字列1本としていたが、今回サイズ単位を **cm/mm/m/inch（すべて長さ系で換算可能）** に絞り、**L（リーニュ）を使わない**ことで、混在の懸念が解消。数値分解が妥当になった。

---

## 1. 確定事項（G1〜G3）

### G1. サイズ：数値＋単位に分解（A案・✓ 確定）

- v1.1 の `sizeSpec`（VarChar100）を**廃止**し、以下の2カラムに置換:
  - `sizeValue` … **Decimal(15,4)・任意**。inch の小数（1/2=0.5）・cm の小数（2.5）に対応するため Decimal。
  - `sizeUnit` … **VarChar(10)・任意**。候補 = `cm` / `mm` / `m` / `inch`。**L（リーニュ）は使わない**。
- UI: 数値入力欄 ＋ 単位プルダウン（cm/mm/m/inch）。
- 用途: ファスナー長・ボタン径など、こちらが指定する寸法。長さ系に統一されるため、将来の範囲検索・集計・単位換算（B-039）がそのまま可能になる。

### G2. 数量の単位（`unit`）サジェスト：g のみ追加（✓ 確定）

- 既存サジェスト（個 / m / 反 / 一式 / kg / 巻 / セット / 枚 等）に **`g`（グラム）のみ追加**。
- 他（kg・反 等）は既に候補に入っているため追加不要。schema 変更なし（UI の datalist 候補追加のみ）。

### G3. migration（A案・DROP COLUMN を含むが本番未マージで安全・✓ 確定）

```sql
-- 追加 migration（v1.1 の s4b1_po_item_practical_fields に続く2本目）
ALTER TABLE "po_items"
  ADD COLUMN "size_value" DECIMAL(15,4),   -- サイズ数値（任意）
  ADD COLUMN "size_unit"  VARCHAR(10),     -- cm/mm/m/inch（任意）
  DROP COLUMN "size_spec";                 -- v1.1 で追加した文字列カラムを廃止
```

- **DROP COLUMN を含むが安全な理由**:
  - v1.1 の `size_spec` を含む migration は**本番に未適用**（PR #64 未マージ）。本番に `size_spec` は存在しない。
  - dev には v1.1 の `migrate dev` で `size_spec` が適用済みだが、**dev の po_items はデータ0**（v1.1 検証で掃除済み）。破壊するデータが無い。
  - よってこの DROP は「データのある本番カラムを消す」のではなく「未リリースの中間カラムを作り替える」操作。実害ゼロ。
- **段階停止プロトコル（v1.1 と同一）**: dev に `migrate dev` で適用・差分 SQL を目視（`DROP COLUMN size_spec` が想定どおり1回のみ・`ADD COLUMN ×2` であること）→ **本番投入前に Claude.ai 側で一度止める** → 承認後にマージ（＝`migrate deploy`）。
- 着手前ガードで dev の `po_items` 件数を確認（0 でない場合は掃除 or 報告）。

---

## 2. 影響範囲

- **Prisma schema**: PoItem の `sizeSpec` を削除し、`sizeValue Decimal? @db.Decimal(15,4)` ＋ `sizeUnit String? @db.VarChar(10)` を追加。
- **validator**（`purchase-order.ts`）: `sizeSpec` を削除し、`sizeValue`（任意・数値）＋ `sizeUnit`（任意・enum 的に cm/mm/m/inch を許容、ただし schema は VarChar なので Zod 側で候補チェック）に置換。
- **actions**（`purchase-orders.ts`）: `buildItemRows` の `sizeSpec` を `sizeValue`/`sizeUnit` に置換。getPurchaseOrder が PoItem 全体を返しているなら自動追従。
- **UI**:
  - フォーム ItemRow: サイズ欄を「数値 input ＋ 単位 select(cm/mm/m/inch)」に作り替え。数量の単位 datalist に `g` を追加。
  - 詳細表示（`[id]/page.tsx`）: サイズ表示を `{sizeValue}{sizeUnit}`（両方あるときのみ・例「20cm」）に。
  - 編集（`[id]/edit/page.tsx`）: defaultValues を `sizeValue`/`sizeUnit` に置換。
- PR #64 に積み増し（migration 2本目 + 論理/UI 修正）。マージは慎太郎さん確認後。

---

## 3. PR #64 の migration が2本になる点（申し送り）

- 1本目: `s4b1_po_item_practical_fields`（v1.1・ADD ×3 + DROP NOT NULL ×2）
- 2本目: 今回（v1.2・ADD ×2 + DROP COLUMN size_spec ×1）
- 本番にはまだ1本も入っていないため、マージ時に2本が順に `migrate deploy` で適用される。正常な流れ。
- 本番投入前の SQL レビューは、実質的に今回の2本目（特に DROP COLUMN size_spec）を重点確認。

---

## 4. 確定状況

| # | 論点 | 確定 |
|---|---|---|
| G1 | サイズ | A案＝`sizeValue`(Decimal15,4)＋`sizeUnit`(cm/mm/m/inch)。L 不使用。`sizeSpec` 廃止 |
| G2 | 数量単位 | サジェストに `g` のみ追加（他は既存） |
| G3 | migration | ADD ×2 + DROP COLUMN size_spec ×1。本番未マージ・dev データ0で安全。段階停止 |

→ 本書 v1.2 確定。次は **追加 migration 込み実装ブリーフ**（PR #64 に積み増し・段階停止つき）。

---

## 改訂履歴

| 日付 | バージョン | 内容 | 担当 |
|---|---|---|---|
| 2026-06-08 | v1.0 | S-4b-1（PO系）骨格確定 | 慎太郎さん + Claude |
| 2026-06-08 | v1.1 | 実務化（明細詳細項目・金額未定・単位プルダウン・migration非破壊・B-038〜041起票） | 慎太郎さん + Claude |
| 2026-06-08 | v1.2 | サイズを数値＋単位に分解（sizeValue Decimal15,4 + sizeUnit cm/mm/m/inch・L不使用・sizeSpec廃止）。数量単位に g 追加。追加 migration（DROP COLUMN含むが本番未マージで安全） | 慎太郎さん + Claude |
