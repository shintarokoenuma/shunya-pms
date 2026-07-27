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

console.log(`✓ work-order validator (B-074): ${passed}/5 ケース PASS`)
