"use server"

import { revalidatePath } from "next/cache"
import { Prisma, type SampleRevision } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  createSampleRevisionSchema,
  updateSampleRevisionSchema,
} from "@/lib/validators/sample-revision"

/**
 * B-130 PR-C1: サンプル修正記録（SampleRevision）Server Actions。
 *
 * ★テナント境界の注意（recon 確定事項）:
 * SampleRevision は companyId 列を持たず TENANT_MODELS にも含まれないため、
 * `@/lib/prisma` の tenant 拡張による companyId / deletedAt 自動フィルタは一切掛からない。
 * よって全 action で必ず親 SampleProduction を companyId スコープで取得し所有確認する。
 * `prisma.sampleRevision.*` の where に companyId は書かない（列が存在しない）。
 *
 * - 論理削除の仕組みが無いため削除機能は実装しない（本 PR のスコープ外）。
 * - photoUrls / attachments / details / revisionWoId は本 PR では書き込まない（列は温存）。
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
    tenantType: session.user.tenantType,
  }
}

// =============================================================================
// 1. 一覧（そのラウンドの修正記録・revisionOrder 昇順）
// =============================================================================
export type SampleRevisionItem = SampleRevision

export async function listSampleRevisions(
  sampleProductionId: string,
): Promise<ActionResult<{ items: SampleRevisionItem[] }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    // 親を companyId スコープで取得して所有確認（SampleRevision は companyId を持たない）。
    const parent = await prisma.sampleProduction.findFirst({
      where: { id: sampleProductionId, companyId: sess.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!parent) {
      return { ok: false, error: "サンプル製作セットが見つかりません" }
    }

    const items = await prisma.sampleRevision.findMany({
      where: { sampleProductionId },
      orderBy: { revisionOrder: "asc" },
    })
    return { ok: true, data: { items } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "修正記録の取得に失敗しました",
    }
  }
}

// =============================================================================
// 2. 追加（revisionOrder は親 SP 内の連番。tx で囲まない＝重複は許容）
// =============================================================================
export async function createSampleRevision(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = createSampleRevisionSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const parent = await prisma.sampleProduction.findFirst({
      where: {
        id: data.sampleProductionId,
        companyId: sess.companyId,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (!parent) {
      return { ok: false, error: "サンプル製作セットが見つかりません" }
    }

    // 連番採番（unique 制約なし・同時追加の重複は許容と決定済み）。
    const last = await prisma.sampleRevision.findFirst({
      where: { sampleProductionId: data.sampleProductionId },
      orderBy: { revisionOrder: "desc" },
      select: { revisionOrder: true },
    })
    const revisionOrder = (last?.revisionOrder ?? 0) + 1

    const created = await prisma.sampleRevision.create({
      data: {
        sampleProductionId: data.sampleProductionId,
        revisionOrder,
        revisionType: data.revisionType,
        requestedBy: data.requestedBy,
        requestedByUserId: sess.userId,
        description: data.description,
        status: "PENDING",
      },
      select: { id: true },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "CREATE",
        entityType: "SampleRevision",
        entityId: created.id,
        beforeData: Prisma.DbNull,
        afterData: {
          sampleProductionId: data.sampleProductionId,
          revisionOrder,
          revisionType: data.revisionType,
          requestedBy: data.requestedBy,
          description: data.description,
          status: "PENDING",
        },
      },
    })

    revalidatePath(`/samples/${data.sampleProductionId}`)
    revalidatePath("/samples")
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "修正記録の追加に失敗しました",
    }
  }
}

// =============================================================================
// 3. 編集（種別 / 依頼元 / 内容 / 状態。状態遷移で completedAt を制御）
// =============================================================================
export async function updateSampleRevision(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = updateSampleRevisionSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    // 対象 revision を取得（companyId は持たないので親経由で所有確認する）。
    const existing = await prisma.sampleRevision.findFirst({
      where: { id: data.id },
      select: {
        id: true,
        sampleProductionId: true,
        revisionType: true,
        requestedBy: true,
        description: true,
        status: true,
      },
    })
    if (!existing) {
      return { ok: false, error: "修正記録が見つかりません" }
    }

    // ★id 直指定での他テナント更新を防ぐため、必ず親の所有確認を行う。
    const parent = await prisma.sampleProduction.findFirst({
      where: {
        id: existing.sampleProductionId,
        companyId: sess.companyId,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (!parent) {
      return { ok: false, error: "サンプル製作セットが見つかりません" }
    }

    // status 遷移に伴う completed 情報の副作用（変化なしなら触らない）。
    const completionPatch =
      existing.status === data.status
        ? {}
        : data.status === "COMPLETED"
          ? { completedAt: new Date(), completedByUserId: sess.userId }
          : { completedAt: null, completedByUserId: null }

    await prisma.sampleRevision.update({
      where: { id: data.id },
      data: {
        revisionType: data.revisionType,
        requestedBy: data.requestedBy,
        description: data.description,
        status: data.status,
        ...completionPatch,
      },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "SampleRevision",
        entityId: data.id,
        beforeData: {
          revisionType: existing.revisionType,
          requestedBy: existing.requestedBy,
          description: existing.description,
          status: existing.status,
        },
        afterData: {
          revisionType: data.revisionType,
          requestedBy: data.requestedBy,
          description: data.description,
          status: data.status,
        },
      },
    })

    revalidatePath(`/samples/${existing.sampleProductionId}`)
    revalidatePath("/samples")
    return { ok: true, data: { id: data.id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "修正記録の更新に失敗しました",
    }
  }
}
