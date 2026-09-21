/**
 * B-054 PR-4a 縫製仕様書 PDF の純関数部の検証（テストランナー非依存）。
 * vitest/jest が無いため assert（throw）で書く。手動実行:
 *   npx tsx src/lib/pdf/sewing-spec-format.test.ts
 *
 * 対象: parseSewingSpecPages（クエリの解釈）・kindLabel（区分の札）・quantityMode（数量の出し方）
 */

import { parseSewingSpecPages, kindLabel, quantityMode } from "./sewing-spec-format"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

let passed = 0

// ① parseSewingSpecPages 正常系
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
    "①-3 sortOrder 複数（0 と負数も整数として受ける）",
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

// ③ parseSewingSpecPages 未実装の種別（measure / process は 4b）
;(() => {
  for (const k of ["measure", "process"]) {
    const r = parseSewingSpecPages(new URLSearchParams(`page=${k}:wo-1`))
    assert(!r.ok && r.code === "unsupported", `③ ${k} は unsupported`)
  }
  // sewing が先にあっても、後ろに measure があれば全体が unsupported
  const r = parseSewingSpecPages(new URLSearchParams("page=sewing:wo-1&page=measure:wo-1"))
  assert(!r.ok && r.code === "unsupported", "③ 混在も unsupported")
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
