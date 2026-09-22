/**
 * B-054 PR-4a/4b 縫製仕様書 PDF の純関数部の検証（テストランナー非依存）。
 * vitest/jest が無いため assert（throw）で書く。手動実行:
 *   npx tsx src/lib/pdf/sewing-spec-format.test.ts
 *
 * 対象: parseSewingSpecPages（クエリの解釈・画像の上限・重複）・kindLabel（区分の札）・quantityMode（数量の出し方）
 */

import { parseSewingSpecPages, kindLabel, quantityMode } from "./sewing-spec-format"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

let passed = 0

// ① parseSewingSpecPages 正常系（sewing）
;(() => {
  const r = parseSewingSpecPages(new URLSearchParams("page=sewing:wo-1"))
  assert(r.ok, "①-1 sewing:wo-1 は ok")
  if (r.ok) {
    assert(r.pages.length === 1, "①-1 1件")
    assert(r.pages[0].kind === "sewing", "①-1 kind")
    assert(r.pages[0].woId === "wo-1", "①-1 woId")
    assert(r.pages[0].sortOrders === null, "①-1 sortOrders 省略は null")
  }

  const r2 = parseSewingSpecPages(new URLSearchParams("page=sewing:wo-1:2"))
  assert(r2.ok && r2.pages[0].sortOrders?.length === 1 && r2.pages[0].sortOrders[0] === 2, "①-2 sortOrder 1つ")

  const r3 = parseSewingSpecPages(new URLSearchParams("page=sewing:wo-1:0,3,-1"))
  assert(
    r3.ok && JSON.stringify(r3.pages[0].sortOrders) === "[0,3,-1]",
    "①-3 sortOrder 複数（0 と負数も整数として受ける・sewing は上限なし＝4a のまま）",
  )

  const r4 = parseSewingSpecPages(new URLSearchParams("page=sewing:wo-1&page=sewing:wo-2:1"))
  assert(r4.ok && r4.pages.length === 2 && r4.pages[1].woId === "wo-2", "①-4 出現順に2件")
  passed++
})()

// ② parseSewingSpecPages 異常系（形式）
;(() => {
  const cases: [string, string][] = [
    ["", "page 無し"],
    ["page=", "kind 無し"],
    ["page=sewing", "woId 無し（区切り無し）"],
    ["page=sewing:", "woId 空"],
    ["page=sewing:wo-1:", "sortOrder 空"],
    ["page=sewing:wo-1:a", "sortOrder が整数でない"],
    ["page=sewing:wo-1:1.5", "sortOrder が小数"],
    ["page=sewing:wo-1:1,,2", "sortOrder の空要素"],
    ["page=sewing:wo-1:1:2", "区切りが多い"],
    ["page=unknown:wo-1", "kind が不正"],
    ["page=sewing:wo-1:1,1", "sortOrder の重複"],
    ["page=sewing:wo-1:0,2,0", "sortOrder の重複（離れた位置）"],
  ]
  for (const [q, label] of cases) {
    const r = parseSewingSpecPages(new URLSearchParams(q))
    assert(!r.ok && r.code === "invalid", `②「${label}」は invalid（q=${q}）`)
  }
  const many = Array.from({ length: 11 }, (_, i) => `page=sewing:wo-${i}`).join("&")
  const r = parseSewingSpecPages(new URLSearchParams(many))
  assert(!r.ok && r.code === "invalid", "② 11件は invalid")
  const ten = Array.from({ length: 10 }, (_, i) => `page=sewing:wo-${i}`).join("&")
  assert(parseSewingSpecPages(new URLSearchParams(ten)).ok, "② 10件は ok")
  passed++
})()

// ③ measure / process（4b）: 正常系・画像の上限・重複
;(() => {
  const m1 = parseSewingSpecPages(new URLSearchParams("page=measure:wo-1"))
  assert(m1.ok && m1.pages[0].kind === "measure" && m1.pages[0].sortOrders === null, "③ measure 省略は ok（最小の1枚）")
  const m2 = parseSewingSpecPages(new URLSearchParams("page=measure:wo-1:3,4"))
  assert(m2.ok && JSON.stringify(m2.pages[0].sortOrders) === "[3,4]", "③ measure 2つは ok（絵型・サイズ表）")
  const m3 = parseSewingSpecPages(new URLSearchParams("page=measure:wo-1:3,4,5"))
  assert(!m3.ok && m3.code === "invalid", "③ measure 3つは invalid（上限2）")
  const m4 = parseSewingSpecPages(new URLSearchParams("page=measure:wo-1:3,3"))
  assert(!m4.ok && m4.code === "invalid", "③ measure 重複は invalid")

  const p1 = parseSewingSpecPages(new URLSearchParams("page=process:wo-2"))
  assert(p1.ok && p1.pages[0].kind === "process" && p1.pages[0].sortOrders === null, "③ process 省略は ok")
  const p4 = parseSewingSpecPages(new URLSearchParams("page=process:wo-2:0,1,2,3"))
  assert(p4.ok && p4.pages[0].sortOrders?.length === 4, "③ process 4つは ok")
  const p5 = parseSewingSpecPages(new URLSearchParams("page=process:wo-2:0,1,2,3,4"))
  assert(!p5.ok && p5.code === "invalid", "③ process 5つは invalid（上限4）")
  const p6 = parseSewingSpecPages(new URLSearchParams("page=process:wo-2:1,2,1"))
  assert(!p6.ok && p6.code === "invalid", "③ process 重複は invalid")

  // 3種の混在（出現順）
  const mix = parseSewingSpecPages(
    new URLSearchParams("page=sewing:wo-1&page=measure:wo-1:2,5&page=process:wo-3:0,1"),
  )
  assert(mix.ok && mix.pages.map((p) => p.kind).join(",") === "sewing,measure,process", "③ 3種の混在は出現順")
  passed++
})()

// ④ kindLabel
;(() => {
  assert(kindLabel("PRODUCTION", null) === "量産", "④ PRODUCTION")
  assert(kindLabel("PRODUCTION", "1st") === "量産", "④ PRODUCTION は round を無視")
  assert(kindLabel("SAMPLE", "2nd") === "サンプル 2nd", "④ SAMPLE 2nd はそのまま")
  assert(kindLabel("SAMPLE", null) === "サンプル", "④ SAMPLE null")
  assert(kindLabel("SAMPLE", "") === "サンプル", "④ SAMPLE 空文字")
  assert(kindLabel("SAMPLE", "  ") === "サンプル", "④ SAMPLE 空白のみ")
  assert(kindLabel("ADDITIONAL", null) === "量産（追加）", "④ ADDITIONAL")
  assert(kindLabel("REWORK", null) === "量産（やり直し）", "④ REWORK")
  assert(kindLabel("PATTERN", null) === null, "④ PATTERN は null")
  assert(kindLabel("GRADING", null) === null, "④ GRADING は null")
  assert(kindLabel("", null) === null, "④ 空は null")
  passed++
})()

// ⑤ quantityMode
;(() => {
  assert(quantityMode("PRODUCTION") === "sku-matrix", "⑤ PRODUCTION")
  for (const c of ["SAMPLE", "ADDITIONAL", "REWORK", "PATTERN", "GRADING", ""]) {
    assert(quantityMode(c) === "wo-total-only", `⑤ ${c || "(空)"} は wo-total-only`)
  }
  passed++
})()

console.log(`sewing-spec-format.test: ${passed} groups passed`)
