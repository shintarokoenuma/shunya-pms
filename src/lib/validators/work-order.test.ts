/**
 * B-074 / production-axis §2-2: 量産 WO（PRODUCTION）の工程明細数量 全行一致チェックの検証。
 *
 * このリポジトリには vitest/jest が無いため外部フレームワークを import せず、
 * 純粋な assert（throw）で書く。tsc が通ること＝最低限の型/ロジック健全性の担保。
 * 手動実行: `npx tsx src/lib/validators/work-order.test.ts`
 *
 * ケース:
 * ① PRODUCTION・全行同一数量 → OK
 * ② PRODUCTION・数量不一致 → items にエラー（メッセージ確認）
 * ③ PRODUCTION・1 行のみ → OK（比較対象なし）
 * ④ 非 PRODUCTION（SAMPLE）・数量不一致 → OK（B-074 は PRODUCTION 限定・既存 WO へ影響なし）
 * ⑤ PATTERN・数量不一致 → OK（同上）
 * ⑥ B-269 D-3: 合計数量（totalQuantity）: 省略/空文字/null → null、"570"/570 → 570、0・負数・小数・文字 → エラー
 */
import { WorkOrderType, WorkOrderCategory } from "@prisma/client"
import { workOrderInputSchema } from "./work-order"

let passed = 0
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg)
}

type Item = { workDescription: string; quantity: number; unit: string }
function base(category: WorkOrderCategory, items: Item[]) {
  return {
    factoryId: "factory-1",
    contractorId: null,
    workType: WorkOrderType.SEWING,
    workCategory: category,
    productId: "product-1",
    items,
  }
}
function item(quantity: number, desc = "縫製"): Item {
  return { workDescription: desc, quantity, unit: "枚" }
}

// ① PRODUCTION・全行同一数量 → OK
;(() => {
  const r = workOrderInputSchema.safeParse(
    base(WorkOrderCategory.PRODUCTION, [item(300, "縫製"), item(300, "仕上げ")]),
  )
  assert(r.success, "①PRODUCTION 全行同一数量は通過すべき")
  passed++
})()

// ② PRODUCTION・数量不一致 → NG（items にエラー）
;(() => {
  const r = workOrderInputSchema.safeParse(
    base(WorkOrderCategory.PRODUCTION, [item(300, "縫製"), item(250, "仕上げ")]),
  )
  assert(!r.success, "②PRODUCTION 数量不一致は失敗すべき")
  if (!r.success) {
    const issue = r.error.issues.find((i) => i.path.includes("items"))
    assert(!!issue, "②items パスにエラーが立つべき")
    assert(
      issue!.message === "量産 WO の工程数量は全行一致が必要です（品番分割を検討）",
      "②B-074 のメッセージが返るべき: " + issue!.message,
    )
  }
  passed++
})()

// ③ PRODUCTION・1 行のみ → OK
;(() => {
  const r = workOrderInputSchema.safeParse(
    base(WorkOrderCategory.PRODUCTION, [item(300, "縫製")]),
  )
  assert(r.success, "③PRODUCTION 単一行は通過すべき")
  passed++
})()

// ④ 非 PRODUCTION（SAMPLE）・数量不一致 → OK（既存 WO へ影響なし）
;(() => {
  const r = workOrderInputSchema.safeParse(
    base(WorkOrderCategory.SAMPLE, [item(1, "サンプル縫製"), item(2, "サンプル仕上げ")]),
  )
  assert(r.success, "④SAMPLE の数量不一致は B-074 の対象外で通過すべき")
  passed++
})()

// ⑤ PATTERN・数量不一致 → OK
;(() => {
  const r = workOrderInputSchema.safeParse(
    base(WorkOrderCategory.PATTERN, [item(1, "パターン"), item(3, "グレーディング")]),
  )
  assert(r.success, "⑤PATTERN の数量不一致は B-074 の対象外で通過すべき")
  passed++
})()

// ⑥ B-269 D-3: 合計数量（任意・1以上の整数・空は null）
;(() => {
  const ok = (v: unknown) =>
    workOrderInputSchema.safeParse({ ...base(WorkOrderCategory.PRODUCTION, [item(570, "縫製工賃")]), totalQuantity: v })
  const r0 = workOrderInputSchema.safeParse(base(WorkOrderCategory.PRODUCTION, [item(570, "縫製工賃")]))
  assert(r0.success && r0.data.totalQuantity === null, "⑥-1 省略は null")
  const r1 = ok("")
  assert(r1.success && r1.data.totalQuantity === null, "⑥-2 空文字は null")
  const r2 = ok(null)
  assert(r2.success && r2.data.totalQuantity === null, "⑥-3 null は null")
  const r3 = ok("570")
  assert(r3.success && r3.data.totalQuantity === 570, "⑥-4 文字列 570 は 570")
  const r4 = ok(600)
  assert(r4.success && r4.data.totalQuantity === 600, "⑥-5 数値 600 は 600")
  for (const bad of ["0", 0, -1, "1.5", "abc"]) {
    const r = ok(bad)
    assert(!r.success, `⑥-6 ${JSON.stringify(bad)} は失敗すべき`)
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.includes("totalQuantity"))
      assert(
        issue?.message === "合計数量は1以上の整数で入力してください",
        `⑥-6 ${JSON.stringify(bad)} のメッセージ: ${issue?.message}`,
      )
    }
  }
  passed++
})()

console.log(`✓ work-order validator (B-074 / B-269): ${passed}/6 ケース PASS`)
