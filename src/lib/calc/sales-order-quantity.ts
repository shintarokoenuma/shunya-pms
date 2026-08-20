/**
 * B-168 D-6: 量産数量（productionQuantity）の算出（純TS・中立モジュール）。
 *
 * - "use client"/"use server" を付けない純関数。@prisma/client 非依存
 *   （material-requirement.ts と同方針。client / server 双方から共用する）。
 * - 量産数量 = 受注数 ＋ 歩留まり。歩留まりは率(%)または加算枚数(+N)で指定する。
 * - 仕様: docs/specs/b-168-production-quantity-spec-confirmation-v0_1-2026-08-19.md（D-6）
 *   ／ docs/specs/b-148-pr2a-implementation-brief-2026-08-19.md（§5）
 *
 * ★ロス率（BomItem.lossRate）とは別レイヤー。ここは「枚数」を増やす歩留まりのみを扱い、
 *   用尺のロス率には一切触れない（二重計上ではない・B-168 §2-4）。
 */

/** 歩留まりの指定方式。Prisma enum YieldMode と値互換の中立型（prisma 非依存）。 */
export type YieldModeInput = "RATE" | "QUANTITY"

/**
 * 量産数量を求める。
 * - RATE: ceil(orderedQuantity × (1 + yieldRate/100))。端数は SKU 単位で切り上げる（D-6）。
 * - QUANTITY: orderedQuantity + yieldQuantity。
 * - yieldRate / yieldQuantity が null のときは、その項を 0 として扱う（＝ orderedQuantity）。
 * - orderedQuantity が 0 以下・非有限のときは常に 0。
 * - 戻り値は必ず 0 以上の整数。
 */
export function computeProductionQuantity(
  orderedQuantity: number,
  mode: YieldModeInput,
  yieldRate: number | null,
  yieldQuantity: number | null,
): number {
  const ordered = Math.trunc(orderedQuantity)
  if (!Number.isFinite(ordered) || ordered <= 0) return 0

  if (mode === "QUANTITY") {
    const add = yieldQuantity ?? 0
    return Math.max(0, ordered + Math.trunc(add))
  }

  // RATE
  const rate = yieldRate ?? 0
  return Math.max(0, Math.ceil(ordered * (1 + rate / 100)))
}
