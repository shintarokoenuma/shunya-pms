import { z } from "zod"
import {
  BomItemCategory,
  FabricProcurementMode,
  UsageSource,
} from "@prisma/client"

/**
 * QE-0b/0c: BOM（資材表）バリデータ。
 * 仕様: docs/specs/qe-0-quotation-foundation-spec-confirmation-v1_0-2026-06-12.md（Q1〜Q3 + v1.1）
 * - 品目は materialId か customMaterialName のどちらか一方必須。
 * - 数値: usagePerUnit >= 0（任意）/ lossRate 0〜100 / unitPrice >= 0（任意）/ sizeValue >= 0（任意）。
 * - unit は DB 必須（NOT NULL）のため必須。
 * - QE-0c: 実務4カラム（supplierItemCode/designCode/sizeValue/sizeUnit）追加。
 * - usageSource は MANUAL / MARKING_SHEET（CAD は B-047 予約・UI 非対象）。
 *   MARKING_SHEET なら markingRecordId 必須・MANUAL なら markingRecordId は null に正規化。
 */

const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

const optionalRelationId = z
  .string()
  .nullable()
  .default(null)
  .transform((v) => (v === "" ? null : v))

/** 任意・>= 0 の Decimal 入力（空/null → null）。 */
const optionalNonNegative = (label: string) =>
  z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => {
      if (v === "" || v === null || v === undefined) return null
      const n = typeof v === "number" ? v : Number(v)
      return Number.isFinite(n) ? n : null
    })
    .refine((v) => v === null || v >= 0, `${label}は0以上で入力してください`)
    .nullable()
    .default(null)

/** ロス率 0〜100（空 → 0）。 */
const lossRateField = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return 0
    const n = typeof v === "number" ? v : Number(v)
    return Number.isFinite(n) ? n : 0
  })
  .refine((v) => v >= 0 && v <= 100, "ロス率は0〜100で入力してください")
  .default(0)

export const bomItemInputSchema = z
  .object({
    itemCategory: z.nativeEnum(BomItemCategory, {
      message: "区分は必須です",
    }),
    materialId: optionalRelationId,
    customMaterialName: optionalString(255),
    supplierId: optionalRelationId,
    usagePerUnit: optionalNonNegative("用尺"),
    unit: z.string().trim().min(1, "単位は必須です").max(20, "20文字以内"),
    lossRate: lossRateField,
    procurementMode: z
      .nativeEnum(FabricProcurementMode)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    unitPrice: optionalNonNegative("単価"),
    // QE-0c 実務4カラム
    supplierItemCode: optionalString(100),
    designCode: optionalString(100),
    sizeValue: optionalNonNegative("サイズ"),
    sizeUnit: z
      .enum(["cm", "mm", "m", "inch"])
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    // 用尺の出所・マーキング転記
    usageSource: z.nativeEnum(UsageSource).default(UsageSource.MANUAL),
    markingRecordId: optionalRelationId,
    // QE-0d: コストの出所・PO 引き当て（手入力フォームは基本 MANUAL。PURCHASE_ORDER は
    //   importPoItemsToBom 専用 action でのみ立てる。buildItemData は本2項目に触れず、
    //   手入力での更新時も既存値を保持する＝引き当て済み行を MANUAL に戻さない）
    costSource: z.enum(["MANUAL", "PURCHASE_ORDER"]).default("MANUAL"),
    purchaseOrderId: z.string().nullish(),
    colorCode: optionalString(50),
    colorName: optionalString(100),
    notes: optionalString(10000),
  })
  .refine(
    (d) => !!d.materialId || (d.customMaterialName?.trim().length ?? 0) > 0,
    {
      message: "品目は素材選択 または 品目名 のどちらかが必須です",
      path: ["customMaterialName"],
    },
  )
  // CAD は UI 非対象（B-047 予約）
  .refine((d) => d.usageSource !== UsageSource.CAD, {
    message: "用尺の出所が不正です",
    path: ["usageSource"],
  })
  // MARKING_SHEET なら markingRecordId 必須
  .refine(
    (d) => d.usageSource !== UsageSource.MARKING_SHEET || !!d.markingRecordId,
    {
      message: "マーキング転記の場合はマーキング実測の選択が必須です",
      path: ["markingRecordId"],
    },
  )
  // MANUAL なら markingRecordId を null に正規化
  .transform((d) => ({
    ...d,
    markingRecordId:
      d.usageSource === UsageSource.MARKING_SHEET ? d.markingRecordId : null,
  }))

export type BomItemFormValues = z.input<typeof bomItemInputSchema>
export type BomItemInput = z.infer<typeof bomItemInputSchema>
