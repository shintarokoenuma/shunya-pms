# 実装ブリーフ — SKU 生成 UI PR2（生成ダイアログ＋量産発注数インライン編集・一括）

## 【対象プロジェクト】
- repo: shintarokoenuma/shunya-pms
- local: ~/shunya-production-system
- prod: shunya-pms-web-production.up.railway.app
- ※ saagara-v2 とは完全に別物。これは shunya-pms。実行前に VS Code が ~/shunya-production-system を開いているか目視。

## 前提 spec
- `docs/specs/sku-design-spec-confirmation-v1_1-2026-06-21.md`（確定版）。
- PR1 は本番反映済み（colorwayId・生成 action・マトリクス改修）。**本 PR は UI のみ・migration なし**。
- 範囲: (a) SKU 生成ダイアログ（サイズ プルダウン複数選択 → 生成）＋ (b) マトリクスの **productionQuantity のみ**インライン編集（updateSkuQuantity 新設）。一括 1 PR。

---

## STEP 0. 着手前確認（read-only・罠抽出）

```bash
cd ~/shunya-production-system
git checkout main && git pull --ff-only
git log origin/main --oneline -2   # 先頭 fb14760(#90) を確認
git checkout -b feat/sku-generate-ui
```

罠抽出 grep（結果を貼り戻してから STEP 1 へ。特に (3)(4) で UI 配線先と既存作法を確定）:
```bash
# (1) page.tsx が defaultSizeOptions / categoryId を既に取得しているか（生成UIに渡す経路）
grep -nE "categoryId|defaultSizeOptions|ProductCategory|listColorways|QuantityMatrixSection|item\.id" "src/app/(app)/products/[id]/page.tsx" | head -20

# (2) 同ページ内ダイアログ＋server action の手本（colorway-section の作法）
ls "src/app/(app)/products/_components/" | grep -iE "colorway|dialog|section"
grep -nE "\"use client\"|useState|useTransition|router\.refresh|Dialog|onClick" "src/app/(app)/products/_components/colorway-section.tsx" 2>/dev/null | head -20

# (3) ProductCategory から defaultSizeOptions を引く既存 action があるか
grep -rnE "defaultSizeOptions|getProductCategory|findCategory" src/lib/actions/product-categories.ts 2>/dev/null | head

# (4) Sku 更新 action が本当に無いか（updateSkuQuantity 新設の根拠・重複防止）
grep -rniE "\.sku\.(update|upsert)" src/lib/actions/ 2>/dev/null || echo "(SKU 更新 action なし＝新設妥当)"

# (5) shadcn の Dialog / Select / Input が揃っているか
ls src/components/ui/ | grep -iE "dialog|select|input|button|checkbox"
```

判定: ブランチ作成・tsc/lint・staging は Claude Code 自走可。**マージ（②）は慎太郎さん**。本 PR は migration なしなので③は「No pending migrations to apply.」が正常（migration 行は出ない）。

---

## STEP 1. サイズ取得（defaultSizeOptions）

- `product-categories.ts` に、品番の categoryId からサイズ展開を引く取得を用意（既存に無ければ追加）:
  - 案: `getDefaultSizeOptions(productId)` or page で `product.category.defaultSizeOptions` を select。
  - page.tsx の Product 取得に `category: { select: { defaultSizeOptions: true } }` を足し、生成ダイアログへ props で渡す（STEP 0 (1) の結果で経路確定）。
- defaultSizeOptions が空/未設定の品番への対処: ダイアログで「カテゴリにサイズ展開が未設定です。商品カテゴリで設定するか、ここで手入力してください」とフォールバック（手入力も許容＝生成を止めない）。
- sizeOrder = 配列の index（提示順＝配列順）。

---

## STEP 2. 量産発注数 更新 action（`skus.ts`）

```ts
// productionQuantity のみ更新（orderedQuantity は SalesOrder=フェーズ2 の正・触らない）
export async function updateSkuQuantity(
  skuId: string,
  data: { productionQuantity: number },
): Promise<ActionResult<{ id: string }>> { ... }
```
- requireSession（house style ローカル定義）・companyId スコープ・soft-delete 考慮。
- `productionQuantity` の非負バリデーション。
- AuditLog（entityType: "Sku"・action: "UPDATE"・afterData に productionQuantity）。
- `revalidatePath(\`/products/${productId}\`)`（productId は sku から引く or 引数追加）。

---

## STEP 3. SKU 生成ダイアログ（新 component）

- `src/app/(app)/products/_components/sku-generate-dialog.tsx`（"use client"）:
  - 手本 = colorway-section.tsx の作法（Dialog ＋ useState/useTransition ＋ server action 直叩き ＋ router.refresh）。
  - props: `productId` / `defaultSizeOptions: string[]` / （任意）ACTIVE カラーウェイ件数（0 件なら生成不可の注意表示）。
  - UI: サイズを **プルダウン（複数選択）** で選ぶ（defaultSizeOptions が選択肢）。＋手入力フォールバック。
  - 「SKU 生成」押下 → `createSkusForProduct(productId, sizes)`（数量は渡さず 0 生成）→ 成功で router.refresh → ダイアログ閉じ。
  - 型は中立モジュール（`@/lib/types/sku`）から import（index-browser 罠回避）。actions ファイルからの型 import は避ける。

---

## STEP 4. マトリクスに生成導線＋インライン編集（`quantity-matrix-section.tsx`）

- ヘッダに「SKU 生成」ボタン（sku-generate-dialog を開く）。空状態（skus.length===0）にも生成導線を出す。
- **productionQuantity セル（下段）をインライン編集可**に:
  - 下段の数値を Input（type=number）に。onBlur or Enter で `updateSkuQuantity(sku.id, { productionQuantity })` → useTransition → router.refresh。
  - **上段 orderedQuantity は read-only のまま**（フェーズ1 では編集させない）。
  - 「—」セル（SKU 未登録）は編集不可。
- props 追加: `productId` / `defaultSizeOptions`（生成ダイアログへ渡す）。page.tsx 側の `<QuantityMatrixSection>` 呼び出しに props 追加。
- 注意: このファイルは "use client"。型 import は `@/lib/types/sku` のみ。

---

## STEP 5. 検証・PR

```bash
npx tsc --noEmit          # 0
npm run lint              # 0
npm run build             # success
```
ローカル目視（dev・**createSkusForProduct のランタイム初実行確認が主目的**）:
- 【dev起動の罠】schema 変更は無いが、新 action/型を確実に反映するため: `lsof -ti:3000,3001 | xargs kill -9` → `npx prisma generate` → `rm -rf .next` → `npm run dev`。
- 事前掃除: PR1 の検証 SKU 12件が dev に残っている。**「UI 経由の生成が初回 create として走る様子」を見たいので、一度 dev の当該品番 SKU を消してから**目視するのが確認になる（消さないと全部 upsert の update 経路になり create が走らない）。掃除は一時 script で `prisma.sku.deleteMany({ where: { productId } })`（コミットしない）。
- 目視ポイント:
  1. 品番詳細（AOI）でマトリクスが空 →「SKU 生成」ボタン → サイズ プルダウンに defaultSizeOptions が出る → 複数選択 → 生成 → **4 ACTIVE カラーウェイ × 選択サイズの行が出る**（柄 D/F も）。← createSkusForProduct 本体が初実行され成功すること。
  2. 下段（量産発注数）セルを編集 → 数値入力 → 反映（updateSkuQuantity）。上段（受注数）は編集できない。
  3. ARCHIVED の A は生成対象に出ない。行順 C→B→D→F。
  4. categoryId に defaultSizeOptions が無い品番でフォールバック（手入力 or 注意表示）が出る。
- 目視 OK なら `git add`（**明示パスのみ**・一時 script は add しない）→ commit → push → PR open（自走可）。
- マージ②は慎太郎さん。**migration なし PR なので③は「No pending migrations to apply.」が正常**（Applying migration 行は出ない）。

---

## 罠リマインド
- `git add -A` / `git add .` 禁止。明示パスのみ。一時 script はコミットしない。
- index-browser: 型は `@/lib/types/sku` から。新 client component（生成ダイアログ）も actions から型 import しない。
- 監査網羅型: Sku に監査網羅は無い（PR1 STEP 0 で確認済み）。updateSkuQuantity の AuditLog は手書き afterData 方式。
- 本番確認の罠: 本番 skus=0。本番マトリクスは空＝正常。検証データを本番に入れない。本 PR は UI のみ＝本番③は migration なし。

## スコープ外（将来）
- 商品カテゴリ画面での defaultSizeOptions 編集 UI（無ければ別起票）。
- orderedQuantity の編集（フェーズ2・SalesOrder で正を持つ）。
- サイズ体系のグルーピング（品種別サイズ辞書）。
