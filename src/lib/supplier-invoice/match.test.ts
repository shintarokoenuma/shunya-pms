/**
 * B-212 PR-1（§3）: match.ts の検証（テストランナー非依存・DB 非接続）。手動実行: npx tsx src/lib/supplier-invoice/match.test.ts
 */
import {
  buildProductIndex,
  counterpartKey,
  matchCounterpart,
  matchProduct,
  normalizeKey,
  splitTargetTokens,
  stripCorporateSuffix,
} from "./match"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}
let passed = 0

// ① normalizeKey
assert(normalizeKey("２６Ａ－ＴＥ０１") === "26ATE01", `①-1 全角 → ${normalizeKey("２６Ａ－ＴＥ０１")}`)
assert(normalizeKey(" ps27ss-ts-01 ") === "PS27SSTS01", `①-2 小文字・空白・ハイフン → ${normalizeKey(" ps27ss-ts-01 ")}`)
assert(normalizeKey("   ") === null && normalizeKey("") === null && normalizeKey(null) === null, "①-3 空白だけ・空・null は null")
assert(normalizeKey("IP_JQ.S−002") === "IPJQS002", "①-4 _ . − も取り除く")
passed++

// ② splitTargetTokens
assert(JSON.stringify(splitTargetTokens("26A-PT05(25SY-50)")) === JSON.stringify(["26A-PT05(25SY-50)", "26A-PT05", "25SY-50"]), `②-1 ${JSON.stringify(splitTargetTokens("26A-PT05(25SY-50)"))}`)
assert(JSON.stringify(splitTargetTokens("IP-JQ-S-002/003")) === JSON.stringify(["IP-JQ-S-002/003", "IP-JQ-S-002", "003"]), `②-2 ${JSON.stringify(splitTargetTokens("IP-JQ-S-002/003"))}`)
assert(JSON.stringify(splitTargetTokens("T.T MENS 27AW")) === JSON.stringify(["T.T MENS 27AW", "T.T", "MENS", "27AW"]), "②-3 空白でも分ける")
assert(splitTargetTokens("").length === 0 && splitTargetTokens(null).length === 0, "②-4 空は []")
passed++

// ③ 当て方
const index = buildProductIndex([
  { productId: "p-shirt", productCode: "ETB-27SS-U-TP-001", clientProductCode: "EB27-SH01", patternNumber: "ETB-27SS-U-TP-001" },
  { productId: "p-pants", productCode: "ETB-27SS-U-BT-001", clientProductCode: "EB27-PT01", patternNumber: "16sy-082" },
  { productId: "p-pants2", productCode: "ETB-27SS-U-BT-002", clientProductCode: null, patternNumber: "16sy-082" },
  { productId: "p-x", productCode: "AAA-1", clientProductCode: "ETB-27SS-U-TP-001", patternNumber: null },
])
const noRules = new Map<string, string>()
{
  // 先方品番が社内品番より先: 「ETB-27SS-U-TP-001」は p-x の先方品番にも p-shirt の社内品番にも当たる → 先方品番の p-x
  const r = matchProduct("ETB-27SS-U-TP-001", { index, rules: noRules, hasCostCategory: false })
  assert(r.status === "MATCHED" && r.matchedBy === "CLIENT_PRODUCT_CODE" && r.productId === "p-x", `③-1 先方品番が先: ${JSON.stringify(r)}`)
  const r2 = matchProduct("eb27-pt01", { index, rules: noRules, hasCostCategory: false })
  assert(r2.status === "MATCHED" && r2.productId === "p-pants", "③-2 大小・ハイフンを無視して先方品番に当たる")
  const r3 = matchProduct("16SY-082", { index, rules: noRules, hasCostCategory: false })
  assert(r3.status === "UNMATCHED" && r3.candidates.length === 2 && r3.candidates.includes("p-pants") && r3.candidates.includes("p-pants2"), `③-3 パターンナンバーで2品番 → UNMATCHED＋候補2: ${JSON.stringify(r3)}`)
  const rules = new Map([["16SY082", "p-pants2"]])
  const r4 = matchProduct("16SY-082", { index, rules, hasCostCategory: false })
  assert(r4.status === "RULE_PENDING" && r4.matchedBy === "RULE" && r4.productId === "p-pants2", "③-4 覚えた対応が完全一致より先で RULE_PENDING")
  const r5 = matchProduct("DHL 国際便", { index, rules: noRules, hasCostCategory: true })
  assert(r5.status === "NO_PRODUCT" && r5.productId === null, "③-5 費目ありで当たらない → NO_PRODUCT")
  const r6 = matchProduct("T.T MENS 27AW", { index, rules: noRules, hasCostCategory: false })
  assert(r6.status === "UNMATCHED" && r6.candidates.length === 0, "③-6 ブランド名だけ → UNMATCHED")
  const r7 = matchProduct("26A-PT05(EB27-SH01)", { index, rules: noRules, hasCostCategory: false })
  assert(r7.status === "MATCHED" && r7.productId === "p-shirt", "③-7 括弧の中の断片でも当たる")
  const r8 = matchProduct("", { index, rules: noRules, hasCostCategory: false })
  assert(r8.status === "UNMATCHED", "③-8 空は UNMATCHED")
  passed++
}

// ④ 相手先
{
  const entries = [
    { type: "SUPPLIER" as const, id: "s-taki", code: "SUP-010", name: "株式会社滝善" },
    { type: "FACTORY" as const, id: "f-fukura", code: "FAC-003", name: "ふくら縫製" },
    { type: "CONTRACTOR" as const, id: "c-1", code: "CON-001", name: "滝善" },
  ]
  const rules = new Map<string, { type: "SUPPLIER" | "FACTORY" | "CONTRACTOR"; id: string }>()
  assert(stripCorporateSuffix("㈱滝善") === "滝善" && stripCorporateSuffix("株式会社滝善") === "滝善" && stripCorporateSuffix("ふくら縫製（有）") === "ふくら縫製", "④-1 法人の種類を除く")
  assert(counterpartKey("SUP-010", "何か") === "SUP010" && counterpartKey("", "㈱滝善") === "滝善", "④-2 キーはコード優先")
  const r1 = matchCounterpart("sup-010", "㈱滝善", { entries, rules })
  assert(r1.status === "MATCHED" && r1.matchedBy === "CODE" && r1.id === "s-taki", "④-3 コードの一致")
  const r2 = matchCounterpart("", "㈱滝善", { entries, rules })
  assert(r2.status === "UNMATCHED" && r2.candidates.length === 2, `④-4 社名「滝善」は仕入先と外注先の2つに当たる → 候補2: ${JSON.stringify(r2)}`)
  const r3 = matchCounterpart("", "ふくら縫製", { entries, rules })
  assert(r3.status === "MATCHED" && r3.matchedBy === "NAME" && r3.type === "FACTORY" && r3.id === "f-fukura", "④-5 社名の一致（工場）")
  const r4 = matchCounterpart("", "テラウチ", { entries, rules })
  assert(r4.status === "UNMATCHED" && r4.type === "OTHER" && r4.id === null, "④-6 当たらなければ OTHER")
  rules.set("テラウチ", { type: "SUPPLIER", id: "s-tera" })
  const r5 = matchCounterpart("", "テラウチ", { entries, rules })
  assert(r5.status === "RULE_PENDING" && r5.id === "s-tera", "④-7 覚えた対応は要確認")
  passed++
}

console.log(`match.test.ts: ${passed} groups passed`)
