"use server"

import { revalidatePath } from "next/cache"
import { Prisma, type MaterialType } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { checkArea } from "@/lib/area-access"
import { isValidCountry } from "@/lib/constants/countries"
import {
  compositionDataSchema,
  exportSpecSchema,
  normalizeCompositionData,
  normalizeExportSpec,
  parseCompositionData,
  parseExportSpec,
  type CompositionData,
  type ExportSpec,
} from "@/lib/hs/export-spec"

/**
 * B-211 PR-2（P2-D3）: 発注の明細から、その場で材料の HS を決める
 * 仕様: docs/specs/b-211-pr2-implementation-brief-2026-10-10.md §3 P2-D3
 *
 * - getMaterialHsContext: ダイアログの初期値（材料の混率・規格・目付・幅・HS）と「材料を編集できるか」
 * - decideMaterialHs: 答えと確定した HS を材料マスターに保存（D-17）。材料を編集できない役割なら保存せず
 *   savedToMaterial=false を返し、発注の行にだけ入れる（ダイアログがその旨を出す）
 * - 権限の判定は材料の編集と同じ（checkArea("masterTerms")）
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

async function requireSession() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, error: "認証されていません" }
  }
  return {
    ok: true as const,
    companyId: session.user.companyId,
    userId: session.user.id,
  }
}

export type MaterialHsContext = {
  id: string
  materialCode: string
  materialName: string
  materialType: MaterialType
  compositionData: CompositionData
  exportSpec: ExportSpec | null
  fabricWeight: number | null
  fabricWidth: number | null
  hsCode: string | null
  originCountry: string | null
  /** 材料マスターを編集できる役割か（false なら答えは発注の行にだけ入る） */
  canEditMaterial: boolean
}

// =============================================================================
// 1. ダイアログの初期値
// =============================================================================
export async function getMaterialHsContext(materialId: string): Promise<ActionResult<MaterialHsContext>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const m = await prisma.material.findFirst({
      where: { id: materialId, companyId: sess.companyId, deletedAt: null },
      select: {
        id: true,
        materialCode: true,
        materialName: true,
        materialType: true,
        compositionData: true,
        exportSpec: true,
        fabricWeight: true,
        fabricWidth: true,
        hsCode: true,
        originCountry: true,
      },
    })
    if (!m) return { ok: false, error: "素材が見つかりません" }
    const canEditMaterial = (await checkArea("masterTerms")).ok
    return {
      ok: true,
      data: {
        id: m.id,
        materialCode: m.materialCode,
        materialName: m.materialName,
        materialType: m.materialType,
        compositionData: parseCompositionData(m.compositionData),
        exportSpec: parseExportSpec(m.exportSpec),
        fabricWeight: m.fabricWeight === null ? null : Number(m.fabricWeight),
        fabricWidth: m.fabricWidth === null ? null : Number(m.fabricWidth),
        hsCode: m.hsCode,
        originCountry: m.originCountry,
        canEditMaterial,
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "素材の取得に失敗しました" }
  }
}

// =============================================================================
// 2. 確定（材料に保存）
// =============================================================================
const decideInputSchema = z.object({
  materialId: z.string().min(1),
  compositionData: compositionDataSchema,
  exportSpec: exportSpecSchema,
  hsCode: z.string().trim().min(1, "HS コードが空です").max(20, "HS コードは 20 文字以内です"),
  /** 質問で入れたときだけ渡す（undefined = 材料の値を変えない） */
  fabricWeight: z.number().positive().optional(),
  fabricWidth: z.number().positive().optional(),
  /** 発注の行の原産国。材料の原産国が空のときだけ入れる */
  originCountry: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v && v.length === 2 && isValidCountry(v) ? v : null)),
})
export type DecideMaterialHsInput = z.input<typeof decideInputSchema>

export type DecideMaterialHsResult = {
  hsCode: string
  originCountry: string | null
  /** false = 材料を編集できない役割だったので材料には保存していない（行にだけ入れる） */
  savedToMaterial: boolean
}

export async function decideMaterialHs(input: DecideMaterialHsInput): Promise<ActionResult<DecideMaterialHsResult>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const parsed = decideInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.material.findFirst({
      where: { id: data.materialId, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) return { ok: false, error: "素材が見つかりません" }

    // ★材料を編集できない役割: 材料には保存せず、行にだけ入れる
    const area = await checkArea("masterTerms")
    if (!area.ok) {
      return {
        ok: true,
        data: { hsCode: data.hsCode, originCountry: existing.originCountry ?? data.originCountry, savedToMaterial: false },
      }
    }

    const spec: ExportSpec = { ...(normalizeExportSpec(data.exportSpec) ?? { version: 1 }) }
    if (!spec.hsSource) spec.hsSource = "MANUAL"
    if (spec.hsSource !== "COPIED") delete spec.copiedFromMaterialId
    if (existing.hsCode !== data.hsCode) {
      spec.decidedAt = new Date().toISOString()
      spec.decidedByUserId = sess.userId
    }
    const nextSpec = normalizeExportSpec(spec)
    const nextComposition = normalizeCompositionData(data.compositionData)
    const nextOrigin = existing.originCountry ?? data.originCountry

    const updateData: Prisma.MaterialUpdateInput = {
      hsCode: data.hsCode,
      compositionData: nextComposition ?? Prisma.DbNull,
      exportSpec: nextSpec ?? Prisma.DbNull,
      originCountry: nextOrigin,
    }
    if (data.fabricWeight !== undefined) updateData.fabricWeight = data.fabricWeight
    if (data.fabricWidth !== undefined) updateData.fabricWidth = data.fabricWidth

    const updated = await prisma.material.update({ where: { id: existing.id }, data: updateData })

    // 変えた列だけ before / after に載せる
    const beforeData: Record<string, unknown> = {
      hsCode: existing.hsCode,
      compositionData: existing.compositionData,
      exportSpec: existing.exportSpec,
      originCountry: existing.originCountry,
    }
    const afterData: Record<string, unknown> = {
      hsCode: updated.hsCode,
      compositionData: updated.compositionData,
      exportSpec: updated.exportSpec,
      originCountry: updated.originCountry,
    }
    if (data.fabricWeight !== undefined) {
      beforeData.fabricWeight = existing.fabricWeight
      afterData.fabricWeight = updated.fabricWeight
    }
    if (data.fabricWidth !== undefined) {
      beforeData.fabricWidth = existing.fabricWidth
      afterData.fabricWidth = updated.fabricWidth
    }
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Material",
        entityId: existing.id,
        beforeData,
        afterData,
        description: "B-211 PR-2: 発注の明細から HS を決めた",
      },
    })

    revalidatePath("/materials")
    revalidatePath(`/materials/${existing.id}`)
    return { ok: true, data: { hsCode: data.hsCode, originCountry: nextOrigin, savedToMaterial: true } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "HS の保存に失敗しました" }
  }
}
