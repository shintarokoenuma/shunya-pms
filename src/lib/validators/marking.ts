import { z } from "zod"

/**
 * QE-0c: MarkingRecord（着用尺の根拠台帳）バリデータ。
 * 仕様: docs/specs/qe-0-quotation-foundation-spec-confirmation-v1_0-2026-06-12.md §3 パターンB（A案簡素化）
 * - 着用尺(usagePerUnit, m)>0 と 生地幅(fabricWidth, cm)>0 が必須。
 * - 着用尺はマーキング図等から読み取った値を直接入力（アプリは計算しない）。
 *   total_units/total_length からの換算は撤去（CAD 連携用にカラムだけ温存・UI 非対象）。
 * - source は MARKING_SHEET 固定（action 側）。
 */

const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

const optionalRelationId = z
  .string()
  .nullable()
  .default(null)
  .transform((v) => (v === "" ? null : v))

/** 必須・> 0 の Decimal。 */
const requiredPositive = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : Number(v)))
    .refine((v) => Number.isFinite(v) && v > 0, `${label}は0より大きい値で入力してください`)

/** 任意・範囲チェック付き（空/null → null）。 */
const optionalRanged = (label: string, min: number, max: number, intOnly = false) =>
  z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => {
      if (v === "" || v === null || v === undefined) return null
      const n = typeof v === "number" ? v : Number(v)
      return Number.isFinite(n) ? n : null
    })
    .refine(
      (v) =>
        v === null ||
        (v >= min && v <= max && (!intOnly || Number.isInteger(v))),
      `${label}が不正です`,
    )
    .nullable()
    .default(null)

export const markingRecordInputSchema = z.object({
  markerName: optionalString(255),
  materialId: optionalRelationId,
  usagePerUnit: requiredPositive("着用尺"),
  fabricWidth: requiredPositive("生地幅"),
  rollLength: optionalRanged("巻きメーター数", 0.000001, 100000), // 任意・> 0
  yieldRate: optionalRanged("収率", 0, 100),
  partsCount: optionalRanged("パーツ数", 1, 100000, true),
  patternPitch: optionalRanged("柄ピッチ", 0, 100000),
  notes: optionalString(10000),
})

export type MarkingRecordFormValues = z.input<typeof markingRecordInputSchema>
export type MarkingRecordInput = z.infer<typeof markingRecordInputSchema>
