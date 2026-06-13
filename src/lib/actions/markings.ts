"use server"

import { revalidatePath } from "next/cache"
import { Prisma, type MarkingRecord } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { uploadMarkingPdf, getSignedReadUrl } from "@/lib/gcs"
import {
  markingRecordInputSchema,
  type MarkingRecordInput,
} from "@/lib/validators/marking"

/**
 * QE-0c: MarkingRecord（着用尺の根拠台帳）Server Actions。
 * 仕様: docs/specs/qe-0-quotation-foundation-spec-confirmation-v1_0-2026-06-12.md §3/§4（A案簡素化）
 * - usagePerUnit（着用尺 m）は入力値をそのまま保存（換算しない）。total_units/total_length は扱わない（CAD 用に温存）。
 * - source は MARKING_SHEET 固定（UI 非表示）。soft-delete（deletedAt）。
 * - 削除ガード: markingRecordId で参照中の BomItem があれば拒否。
 * - 原本PDF（originalFileGcsPath）の更新は gcs/添付 action 側（本ファイルは閲覧URL生成を提供）。
 * - house style: companyId スコープ・AuditLog・revalidatePath。
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

export type MarkingRecordRow = MarkingRecord & {
  material: { id: string; materialCode: string; materialName: string } | null
}

export async function getMarkingRecordsByProductId(
  productId: string,
): Promise<ActionResult<MarkingRecordRow[]>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const rows = await prisma.markingRecord.findMany({
      where: { companyId: sess.companyId, productId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    })
    const materialIds = [
      ...new Set(rows.map((r) => r.materialId).filter((v): v is string => !!v)),
    ]
    const mats = materialIds.length
      ? await prisma.material.findMany({
          where: { id: { in: materialIds }, companyId: sess.companyId },
          select: { id: true, materialCode: true, materialName: true },
        })
      : []
    const matMap = new Map(mats.map((m) => [m.id, m]))
    return {
      ok: true,
      data: rows.map((r) => ({
        ...r,
        material: r.materialId ? matMap.get(r.materialId) ?? null : null,
      })),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "取得に失敗しました" }
  }
}

export async function createMarkingRecord(
  productId: string,
  input: MarkingRecordInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = markingRecordInputSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const d = parsed.data

    const product = await prisma.product.findFirst({
      where: { id: productId, companyId: sess.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!product) return { ok: false, error: "品番が見つかりません" }

    const created = await prisma.markingRecord.create({
      data: {
        companyId: sess.companyId,
        productId,
        materialId: d.materialId,
        markerName: d.markerName || null,
        usagePerUnit: new Prisma.Decimal(d.usagePerUnit),
        fabricWidth: new Prisma.Decimal(d.fabricWidth),
        rollLength: d.rollLength !== null ? new Prisma.Decimal(d.rollLength) : null,
        yieldRate: d.yieldRate !== null ? new Prisma.Decimal(d.yieldRate) : null,
        partsCount: d.partsCount,
        patternPitch: d.patternPitch !== null ? new Prisma.Decimal(d.patternPitch) : null,
        // source は @default(MARKING_SHEET)。sizeCombination/total_units/total_length は UI 撤去・温存（未設定）
        notes: d.notes || null,
      },
      select: { id: true, usagePerUnit: true },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "CREATE",
        entityType: "MarkingRecord",
        entityId: created.id,
        afterData: {
          productId,
          markerName: d.markerName || null,
          usagePerUnit: created.usagePerUnit.toString(),
          fabricWidth: d.fabricWidth,
        },
      },
    })

    revalidatePath(`/products/${productId}`)
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "作成に失敗しました" }
  }
}

export async function updateMarkingRecord(
  id: string,
  input: MarkingRecordInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = markingRecordInputSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const d = parsed.data

    const existing = await prisma.markingRecord.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) return { ok: false, error: "マーキング実測が見つかりません" }

    const updated = await prisma.markingRecord.update({
      where: { id },
      data: {
        materialId: d.materialId,
        markerName: d.markerName || null,
        usagePerUnit: new Prisma.Decimal(d.usagePerUnit),
        fabricWidth: new Prisma.Decimal(d.fabricWidth),
        rollLength: d.rollLength !== null ? new Prisma.Decimal(d.rollLength) : null,
        yieldRate: d.yieldRate !== null ? new Prisma.Decimal(d.yieldRate) : null,
        partsCount: d.partsCount,
        patternPitch: d.patternPitch !== null ? new Prisma.Decimal(d.patternPitch) : null,
        notes: d.notes || null,
      },
      select: { id: true, productId: true, usagePerUnit: true },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "MarkingRecord",
        entityId: id,
        beforeData: {
          usagePerUnit: existing.usagePerUnit.toString(),
          fabricWidth: existing.fabricWidth.toString(),
        },
        afterData: {
          usagePerUnit: updated.usagePerUnit.toString(),
          fabricWidth: d.fabricWidth,
        },
      },
    })

    revalidatePath(`/products/${updated.productId}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "更新に失敗しました" }
  }
}

export async function deleteMarkingRecord(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.markingRecord.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, productId: true, markerName: true },
    })
    if (!existing) return { ok: false, error: "マーキング実測が見つかりません" }

    // 削除ガード: markingRecordId で参照中の BomItem
    const refCount = await prisma.bomItem.count({ where: { markingRecordId: id } })
    if (refCount > 0) {
      return {
        ok: false,
        error: `${refCount}件の資材明細から参照されています。先に明細側の参照を外してください。`,
      }
    }

    await prisma.markingRecord.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "MarkingRecord",
        entityId: id,
        beforeData: { markerName: existing.markerName, softDelete: true },
      },
    })

    revalidatePath(`/products/${existing.productId}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "削除に失敗しました" }
  }
}

// =============================================================================
// 原本PDF の GCS 添付（B-053 基盤流用）
// =============================================================================
const PDF_MAX_BYTES = 10 * 1024 * 1024 // 10MB

/** FormData(file) を受けて GCS へアップロードし originalFileGcsPath を更新。
 *  添付は保存自体が目的のため、GCS 失敗時はレコードを変更せずエラーを返す（graceful degradation しない）。 */
export async function attachMarkingPdf(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.markingRecord.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, productId: true },
    })
    if (!existing) return { ok: false, error: "マーキング実測が見つかりません" }

    const file = formData.get("file")
    if (!(file instanceof File)) return { ok: false, error: "ファイルがありません" }
    if (file.type !== "application/pdf") {
      return { ok: false, error: "PDF ファイルのみ添付できます" }
    }
    if (file.size > PDF_MAX_BYTES) {
      return { ok: false, error: "ファイルサイズは 10MB 以下にしてください" }
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const uploaded = await uploadMarkingPdf(existing.productId, buffer)
    if (!uploaded) {
      return {
        ok: false,
        error:
          "GCS へのアップロードに失敗しました（環境変数 or 権限を確認してください）。レコードは変更していません。",
      }
    }

    await prisma.markingRecord.update({
      where: { id },
      data: { originalFileGcsPath: uploaded.gcsPath },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "MarkingRecord",
        entityId: id,
        afterData: { originalFileGcsPath: uploaded.gcsPath, action: "attach_pdf" },
      },
    })

    revalidatePath(`/products/${existing.productId}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "添付に失敗しました" }
  }
}

/** 原本PDF の署名付き閲覧URL（15分）を返す。UI は新規タブで開く。 */
export async function getMarkingPdfUrl(
  id: string,
): Promise<ActionResult<{ url: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const rec = await prisma.markingRecord.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { originalFileGcsPath: true },
    })
    if (!rec) return { ok: false, error: "マーキング実測が見つかりません" }
    if (!rec.originalFileGcsPath) return { ok: false, error: "原本PDFが未添付です" }

    const url = await getSignedReadUrl(rec.originalFileGcsPath)
    if (!url) return { ok: false, error: "閲覧URLの生成に失敗しました" }
    return { ok: true, data: { url } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "URL生成に失敗しました" }
  }
}
