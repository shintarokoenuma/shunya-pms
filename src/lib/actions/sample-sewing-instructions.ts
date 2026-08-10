"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  sewingInstructionInputSchema,
  parseSewingInstruction,
} from "@/lib/validators/sewing-instruction"

/**
 * B-130 PR-B2: ラウンド単位の縫製指示 Server Actions（案A）。
 * sewing-instructions.ts（Product 版）を写経し、対象を SampleProduction に置き換えたもの。
 * - updateSampleSewingInstructions … ラウンドの縫製指示を Json 全体置換（部分更新しない）。
 * - loadSewingInstructionsFromProduct … 空のラウンドに品番カルテの現在値を読み込む（論点3-B）。
 * - applySewingInstructionsToProduct … 確定サンプルの内容を品番カルテへ反映する（論点2-C）。
 * validator / 型は Product 版と共用（新規作成しない）。
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

/** 3-1: ラウンドの縫製指示を更新（Json 全体置換・専用 AuditLog）。 */
export async function updateSampleSewingInstructions(
  sampleProductionId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const sp = await prisma.sampleProduction.findFirst({
      where: { id: sampleProductionId, companyId: sess.companyId, deletedAt: null },
      select: { id: true, productId: true, sewingInstructions: true },
    })
    if (!sp) return { ok: false, error: "サンプル製作セットが見つかりません" }

    const parsed = sewingInstructionInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }

    const before = parseSewingInstruction(sp.sewingInstructions)
    const after = parsed.data

    await prisma.sampleProduction.update({
      where: { id: sampleProductionId },
      data: { sewingInstructions: after },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "SampleProduction",
        entityId: sampleProductionId,
        beforeData: before,
        afterData: after,
      },
    })

    revalidatePath(`/samples/${sampleProductionId}`)
    revalidatePath("/samples")
    return { ok: true, data: undefined }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "縫製指示の更新に失敗しました",
    }
  }
}

/** 3-2: 空のラウンドに品番カルテの縫製指示を読み込む（論点3-B・誤上書き防止）。 */
export async function loadSewingInstructionsFromProduct(
  sampleProductionId: string,
): Promise<ActionResult> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const sp = await prisma.sampleProduction.findFirst({
      where: { id: sampleProductionId, companyId: sess.companyId, deletedAt: null },
      select: { id: true, productId: true, sewingInstructions: true },
    })
    if (!sp) return { ok: false, error: "サンプル製作セットが見つかりません" }

    // 既に入力済みのラウンドは上書きしない（誤操作防止）。
    if (sp.sewingInstructions !== null) {
      return {
        ok: false,
        error: "既に縫製指示が入力されています。上書きする場合は編集してください",
      }
    }

    const product = await prisma.product.findFirst({
      where: { id: sp.productId, companyId: sess.companyId, deletedAt: null },
      select: { id: true, sewingInstructions: true },
    })
    if (!product || product.sewingInstructions === null) {
      return { ok: false, error: "品番カルテに縫製指示が登録されていません" }
    }

    const after = parseSewingInstruction(product.sewingInstructions)

    await prisma.sampleProduction.update({
      where: { id: sampleProductionId },
      data: { sewingInstructions: after },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "SampleProduction",
        entityId: sampleProductionId,
        beforeData: Prisma.DbNull, // 読み込み前は未入力（DB NULL）
        afterData: after,
      },
    })

    revalidatePath(`/samples/${sampleProductionId}`)
    revalidatePath("/samples")
    return { ok: true, data: undefined }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "品番カルテからの読み込みに失敗しました",
    }
  }
}

/** 3-3: 確定サンプルの縫製指示を品番カルテへ反映（論点2-C・書き戻し先は Product）。 */
export async function applySewingInstructionsToProduct(
  sampleProductionId: string,
): Promise<ActionResult> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const sp = await prisma.sampleProduction.findFirst({
      where: { id: sampleProductionId, companyId: sess.companyId, deletedAt: null },
      select: {
        id: true,
        productId: true,
        sewingInstructions: true,
        isProductionEstimateBase: true,
      },
    })
    if (!sp) return { ok: false, error: "サンプル製作セットが見つかりません" }

    if (!sp.isProductionEstimateBase) {
      return { ok: false, error: "確定サンプルのみ品番カルテへ反映できます" }
    }
    if (sp.sewingInstructions === null) {
      return { ok: false, error: "このラウンドに縫製指示が入力されていません" }
    }

    const product = await prisma.product.findFirst({
      where: { id: sp.productId, companyId: sess.companyId, deletedAt: null },
      select: { id: true, sewingInstructions: true },
    })
    if (!product) return { ok: false, error: "対象の品番カルテが見つかりません" }

    const before = parseSewingInstruction(product.sewingInstructions)
    const after = parseSewingInstruction(sp.sewingInstructions)

    await prisma.product.update({
      where: { id: sp.productId },
      data: { sewingInstructions: after },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Product", // ★書き戻し先は Product
        entityId: sp.productId,
        beforeData: before,
        afterData: after,
      },
    })

    revalidatePath(`/products/${sp.productId}`)
    revalidatePath(`/samples/${sampleProductionId}`)
    revalidatePath("/products")
    return { ok: true, data: undefined }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "品番カルテへの反映に失敗しました",
    }
  }
}
