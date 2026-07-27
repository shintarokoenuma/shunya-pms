import { z } from "zod"

/**
 * (B) 量産発注生成パイプラインの入力バリデータ。
 *
 * - peId: 種にする量産見積。
 * - skuQuantities: SKU 別の入力数量（既定=Sku.productionQuantity・整数・0 可）。
 *   Σ入力数量 ≠ PE.estimateQuantity は業務上正常（§4）なのでここではブロックしない。
 * - targets: 生成対象行（PE Item）ごとの相手先。MATERIAL→supplier、LABOR→factory/contractor。
 *   相手先未指定行が残る間は画面側で生成ボタンを無効化する（§2）。
 */
export const genSkuQuantitySchema = z.object({
  skuId: z.string().min(1),
  quantity: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : Number(v)))
    .refine((v) => Number.isInteger(v) && v >= 0, "数量は0以上の整数で入力してください"),
})

export const genTargetSchema = z.object({
  peItemId: z.string().min(1),
  targetType: z.enum(["supplier", "factory", "contractor"]),
  targetId: z.string().min(1, "相手先を指定してください"),
})

export const generateProductionOrdersInputSchema = z.object({
  peId: z.string().min(1, "量産見積が指定されていません"),
  skuQuantities: z.array(genSkuQuantitySchema),
  targets: z.array(genTargetSchema),
})

export type GenSkuQuantityInput = z.input<typeof genSkuQuantitySchema>
export type GenTargetInput = z.input<typeof genTargetSchema>
export type GenerateProductionOrdersInput = z.input<
  typeof generateProductionOrdersInputSchema
>
