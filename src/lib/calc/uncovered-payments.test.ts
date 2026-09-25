/**
 * B-225（D-3）: findInvoicesCoveringPayment の検証（テストランナー非依存）。
 *
 * このリポジトリには vitest/jest が無いため、外部フレームワークを import せず
 * 純粋な assert（throw）で書く。手動実行: `npx tsx src/lib/calc/uncovered-payments.test.ts`
 * 窓の作り方は findUncoveredPayments（B-223）と同じ部品（buildInvoiceWindows）を使う。
 */

import { findInvoicesCoveringPayment, findUncoveredPayments } from "./uncovered-payments"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

// 請求書: INV-1（8/1〜8/31・8/31 作成）、INV-2（9/1〜9/30・9/30 作成）
const invoices = [
  {
    id: "inv1",
    invoiceNumber: "INV-2026-0001",
    periodStartDate: new Date("2026-08-01T00:00:00Z"),
    periodEndDate: new Date("2026-08-31T00:00:00Z"),
    createdAt: new Date("2026-08-31T10:00:00Z"),
  },
  {
    id: "inv2",
    invoiceNumber: "INV-2026-0002",
    periodStartDate: new Date("2026-09-01T00:00:00Z"),
    periodEndDate: new Date("2026-09-30T00:00:00Z"),
    createdAt: new Date("2026-09-30T10:00:00Z"),
  },
]

// ① 窓の中（9/15 の入金・請求書より先に記録）→ INV-2 に含まれている
{
  const r = findInvoicesCoveringPayment(
    { paymentDate: "2026-09-15", createdAt: "2026-09-15T09:00:00Z" },
    invoices,
  )
  assert(r.length === 1 && r[0].invoiceNumber === "INV-2026-0002", "① 窓の中 → INV-2")
}

// ② 窓の外（7/20 の入金）→ どの請求書にも含まれていない
{
  const r = findInvoicesCoveringPayment(
    { paymentDate: "2026-07-20", createdAt: "2026-07-20T09:00:00Z" },
    invoices,
  )
  assert(r.length === 0, "② 窓の外 → 0 件")
}

// ③ 請求書より後に作った入金（9/15 の日付だが 10/1 に記録）→ INV-2 には含まれていない（B-223 の未計上側）
{
  const r = findInvoicesCoveringPayment(
    { paymentDate: "2026-09-15", createdAt: "2026-10-01T09:00:00Z" },
    invoices,
  )
  assert(r.length === 0, "③ 請求書より後に記録 → 0 件")
  // 同じ入金は B-223 側では「未計上」として拾われる（裏返しの関係）
  const u = findUncoveredPayments(
    [{ id: "p", paymentNumber: "PAY-2026-0009", paymentDate: "2026-09-15", amount: 1, createdAt: "2026-10-01T09:00:00Z" }],
    invoices,
    "2026-10-01",
  )
  assert(u.length === 1 && u[0].invoiceNumber === "INV-2026-0002", "③' B-223 側では未計上 → INV-2")
}

// ④ 2 枚目の窓は「前の請求書の periodEndDate + 1 日」から。8/31 の入金は INV-1（窓 8/1〜8/31）
{
  const r = findInvoicesCoveringPayment(
    { paymentDate: "2026-08-31", createdAt: "2026-08-31T09:00:00Z" },
    invoices,
  )
  assert(r.length === 1 && r[0].invoiceNumber === "INV-2026-0001", "④ 窓の境界（末日）→ INV-1")
}

console.log("uncovered-payments.test.ts: all assertions passed")
