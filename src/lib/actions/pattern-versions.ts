"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import type { PatternVersionView } from "@/lib/types/pattern-version"
import {
  patternVersionInputSchema,
  type PatternVersionFormValues,
} from "@/lib/validators/pattern-version"

/**
 * B-054/B-146 PR-2: 型紙の記録（PatternVersion）Server Actions。
 * 仕様: claude/b-054-b-146-spec-confirmation-v1_0-2026-09-20.md §5-1（D-11 / D-12）
 * - 休眠していた pattern_versions（DDL は 2026-05-16 init で適用済み）を起こす。★schema 変更・migration なし。
 * - model-codes.ts の骨格を鏡写し（requireSession → 所有確認 → transaction → AuditLog → revalidatePath）。
 * - version / versionNumber は自動採番（同じ modelCodeId の最大 versionNumber + 1・`v${n}`）。
 *   @@unique([modelCodeId, version]) の衝突は最大3回リトライ（createModelCode の採番リトライに倣う）。
 *   update では version / versionNumber を変更しない（immutable）。
 * - 削除は deletedAt の論理削除。全クエリに companyId を含める。
 * - 型番（ModelCode）の所有確認: companyId 一致・deletedAt: null。
 * - ★SampleProduction / WO への紐付けは本 PR では扱わない（後続）。
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

const CREATE_MAX_RETRIES = 3

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

/** 型番の所有確認（companyId スコープ）。products.ts / model-codes.ts と同形。 */
async function loadModelCode(modelCodeId: string, companyId: string) {
  return prisma.modelCode.findFirst({
    where: { id: modelCodeId, companyId, deletedAt: null },
    select: { id: true },
  })
}

/** 外注パタンナー名の一括解決（work-orders.ts の fetchContractorSummaries と同形・N+1 にしない）。 */
async function fetchContractorNames(companyId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>()
  const rows = await prisma.contractor.findMany({
    where: { id: { in: ids }, companyId },
    select: { id: true, contractorName: true },
  })
  return new Map(rows.map((r) => [r.id, r.contractorName]))
}

function readSizes(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : []
}

// =============================================================================
// 1. 一覧（型番ごと・受領日の新しい順・null は最後）
// =============================================================================
export async function listPatternVersions(
  modelCodeId: string,
): Promise<ActionResult<PatternVersionView[]>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const mc = await loadModelCode(modelCodeId, sess.companyId)
    if (!mc) return { ok: false, error: "型番が見つかりません" }

    const rows = await prisma.patternVersion.findMany({
      where: { companyId: sess.companyId, modelCodeId, deletedAt: null },
      orderBy: [
        { receivedAt: { sort: "desc", nulls: "last" } },
        { versionNumber: "desc" },
      ],
      select: {
        id: true,
        modelCodeId: true,
        receivedAt: true,
        workType: true,
        hasGrading: true,
        gradingSizes: true,
        revisionNotes: true,
        driveFileUrl: true,
        contractorId: true,
        createdAt: true,
      },
    })
    const names = await fetchContractorNames(sess.companyId, [
      ...new Set(rows.map((r) => r.contractorId).filter((v): v is string => !!v)),
    ])
    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        modelCodeId: r.modelCodeId,
        receivedAt: r.receivedAt ? r.receivedAt.toISOString() : null,
        workType: r.workType,
        hasGrading: r.hasGrading,
        gradingSizes: readSizes(r.gradingSizes),
        revisionNotes: r.revisionNotes,
        driveFileUrl: r.driveFileUrl,
        contractorId: r.contractorId,
        contractorName: r.contractorId ? names.get(r.contractorId) ?? null : null,
        createdAt: r.createdAt.toISOString(),
      })),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "型紙の取得に失敗しました" }
  }
}

// =============================================================================
// 2. 登録（version 自動採番・衝突は最大3回リトライ）
// =============================================================================
export async function createPatternVersion(
  input: PatternVersionFormValues, // zod の input 型（default 付き）。action 内で safeParse して output に揃える
  productId: string,
): Promise<ActionResult<{ id: string; version: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = patternVersionInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    if (data.contractorId) {
      const c = await prisma.contractor.findFirst({
        where: { id: data.contractorId, companyId: sess.companyId, deletedAt: null },
        select: { id: true },
      })
      if (!c) return { ok: false, error: "指定された外注先が見つかりません" }
    }

    let created: { id: string; version: string } | null = null
    let lastError: unknown = null
    for (let attempt = 0; attempt < CREATE_MAX_RETRIES; attempt++) {
      try {
        created = await prisma.$transaction(async (tx) => {
          // (a) 型番が自社のものか
          const mc = await tx.modelCode.findFirst({
            where: { id: data.modelCodeId, companyId: sess.companyId, deletedAt: null },
            select: { id: true },
          })
          if (!mc) throw new Error("型番が見つかりません")
          // (b) 同じ型番の最大 versionNumber + 1（論理削除済みも含めて数える＝@@unique は deletedAt を見ないため）
          const last = await tx.patternVersion.findFirst({
            where: { modelCodeId: data.modelCodeId },
            orderBy: { versionNumber: "desc" },
            select: { versionNumber: true },
          })
          const versionNumber = (last?.versionNumber ?? 0) + 1
          const version = `v${versionNumber}`
          // (c) create
          return tx.patternVersion.create({
            data: {
              companyId: sess.companyId,
              modelCodeId: data.modelCodeId,
              version,
              versionNumber,
              receivedAt: new Date(data.receivedAt),
              workType: data.workType,
              hasGrading: data.hasGrading,
              gradingSizes: data.gradingSizes,
              revisionNotes: data.revisionNotes || null,
              driveFileUrl: data.driveFileUrl || null,
              contractorId: data.contractorId,
              createdByUserId: sess.userId,
            },
            select: { id: true, version: true },
          })
        })
        break
      } catch (e) {
        lastError = e
        const isUnique =
          e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
        if (!isUnique) throw e
      }
    }
    if (!created) {
      return {
        ok: false,
        error:
          lastError instanceof Error
            ? `採番衝突が解消されませんでした：${lastError.message}`
            : "採番衝突が解消されませんでした",
      }
    }

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "CREATE",
        entityType: "PatternVersion",
        entityId: created.id,
        afterData: {
          modelCodeId: data.modelCodeId,
          version: created.version,
          receivedAt: data.receivedAt,
          workType: data.workType,
          hasGrading: data.hasGrading,
        },
      },
    })

    revalidatePath(`/products/${productId}`)
    revalidatePath("/model-codes")
    return { ok: true, data: created }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "型紙の登録に失敗しました" }
  }
}

// =============================================================================
// 3. 更新（version / versionNumber は immutable）
// =============================================================================
export async function updatePatternVersion(
  id: string,
  input: PatternVersionFormValues, // zod の input 型（default 付き）。action 内で safeParse して output に揃える
  productId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = patternVersionInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.patternVersion.findFirst({
      where: { id, companyId: sess.companyId, modelCodeId: data.modelCodeId, deletedAt: null },
    })
    if (!existing) return { ok: false, error: "型紙の記録が見つかりません" }

    if (data.contractorId) {
      const c = await prisma.contractor.findFirst({
        where: { id: data.contractorId, companyId: sess.companyId, deletedAt: null },
        select: { id: true },
      })
      if (!c) return { ok: false, error: "指定された外注先が見つかりません" }
    }

    const updated = await prisma.patternVersion.update({
      where: { id },
      data: {
        // version / versionNumber は変更しない
        receivedAt: new Date(data.receivedAt),
        workType: data.workType,
        hasGrading: data.hasGrading,
        gradingSizes: data.gradingSizes,
        revisionNotes: data.revisionNotes || null,
        driveFileUrl: data.driveFileUrl || null,
        contractorId: data.contractorId,
      },
      select: { id: true, receivedAt: true, workType: true, hasGrading: true, contractorId: true },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "PatternVersion",
        entityId: id,
        beforeData: {
          receivedAt: existing.receivedAt,
          workType: existing.workType,
          hasGrading: existing.hasGrading,
          contractorId: existing.contractorId,
        },
        afterData: {
          receivedAt: updated.receivedAt,
          workType: updated.workType,
          hasGrading: updated.hasGrading,
          contractorId: updated.contractorId,
        },
      },
    })

    revalidatePath(`/products/${productId}`)
    revalidatePath("/model-codes")
    return { ok: true, data: { id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "型紙の更新に失敗しました" }
  }
}

// =============================================================================
// 4. 削除（論理削除）
// =============================================================================
export async function deletePatternVersion(
  id: string,
  productId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.patternVersion.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, version: true, modelCodeId: true },
    })
    if (!existing) return { ok: false, error: "型紙の記録が見つかりません" }

    await prisma.patternVersion.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "PatternVersion",
        entityId: id,
        beforeData: { modelCodeId: existing.modelCodeId, version: existing.version },
      },
    })

    revalidatePath(`/products/${productId}`)
    revalidatePath("/model-codes")
    return { ok: true, data: { id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "型紙の削除に失敗しました" }
  }
}
