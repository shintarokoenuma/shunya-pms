"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { checkArea } from "@/lib/area-access"
import { getSignedReadUrl, uploadMaterialEvidenceFile } from "@/lib/gcs"
import {
  normalizeReferenceUrls,
  parseReferenceUrls,
  referenceUrlsSchema,
  type ReferenceUrls,
  type ReferenceUrlsInput,
} from "@/lib/hs/export-spec"

/**
 * B-211 PR-1（P1-D6）: 材料の「根拠」— 根拠ファイル（SharedFile）と参考 URL（Material.referenceUrls）
 * 仕様: docs/specs/b-211-pr1-implementation-brief-2026-10-10.md §3 P1-D6
 *
 * - ファイルの器は休眠していた SharedFile（attachedToType = "Material"・attachedToId = material.id）。schema は変えない
 * - GCS のパスは product-sketches / 受注原本と同じ流儀（gs://… を fileUrl に保持・表示時に署名 URL）
 * - 取り消しは論理削除（deletedAt）＋ AuditLog。GCS 実体は消さない（既存系と同じ作法）
 * - 権限は材料の編集と同じ（requireSession → checkArea("masterTerms")）
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

const ATTACHED_TO_TYPE = "Material"
const EVIDENCE_MAX_BYTES = 20 * 1024 * 1024 // 20MB
const EVIDENCE_MAX_COUNT = 50

/** 拡張子 → 保存する MIME。ブラウザは .eml / .msg の MIME を空や octet-stream で送ることがあるので拡張子で判定する */
const ALLOWED_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  eml: "message/rfc822",
  msg: "application/vnd.ms-outlook",
}
export type MaterialEvidenceFile = {
  id: string
  fileName: string
  fileType: string | null
  /** BigInt を文字列で（Client Component に渡すため） */
  fileSize: string | null
  mimeType: string | null
  createdAt: string
  uploadedBy: string | null
}

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

/** 材料の所有確認（companyId スコープ） */
async function loadMaterial(materialId: string, companyId: string) {
  return prisma.material.findFirst({
    where: { id: materialId, companyId, deletedAt: null },
    select: { id: true, referenceUrls: true },
  })
}

function extOf(fileName: string): string {
  const m = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ""
}

// =============================================================================
// 1. 一覧（詳細ページ用）
// =============================================================================
export async function listMaterialEvidenceFiles(
  materialId: string,
): Promise<ActionResult<MaterialEvidenceFile[]>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const material = await loadMaterial(materialId, sess.companyId)
    if (!material) return { ok: false, error: "素材が見つかりません" }

    const rows = await prisma.sharedFile.findMany({
      where: {
        companyId: sess.companyId,
        deletedAt: null,
        attachedToType: ATTACHED_TO_TYPE,
        attachedToId: materialId,
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        mimeType: true,
        createdAt: true,
        uploadedByUserId: true,
      },
    })
    const userIds = Array.from(new Set(rows.map((r) => r.uploadedByUserId).filter((v): v is string => !!v)))
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds }, companyId: sess.companyId },
          select: { id: true, firstName: true, lastName: true, displayName: true },
        })
      : []
    const nameById = new Map(users.map((u) => [u.id, u.displayName ?? `${u.lastName} ${u.firstName}`.trim()]))

    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        fileName: r.fileName,
        fileType: r.fileType,
        fileSize: r.fileSize === null ? null : r.fileSize.toString(),
        mimeType: r.mimeType,
        createdAt: r.createdAt.toISOString(),
        uploadedBy: r.uploadedByUserId ? (nameById.get(r.uploadedByUserId) ?? null) : null,
      })),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "根拠ファイルの取得に失敗しました" }
  }
}

// =============================================================================
// 2. 追加（FormData の file → GCS → SharedFile → AuditLog）
// =============================================================================
export async function addMaterialEvidenceFile(
  materialId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    // 権限は材料の編集と同じ（B-243 PR-4 D4-5）
    const area = await checkArea("masterTerms")
    if (!area.ok) return area

    const material = await loadMaterial(materialId, sess.companyId)
    if (!material) return { ok: false, error: "素材が見つかりません" }

    const file = formData.get("file")
    if (!(file instanceof File)) return { ok: false, error: "ファイルがありません" }
    const ext = extOf(file.name)
    const contentType = ALLOWED_EXT[ext]
    if (!contentType) {
      return { ok: false, error: "PDF / PNG / JPG / EML / MSG のファイルのみ添付できます" }
    }
    if (file.size > EVIDENCE_MAX_BYTES) {
      return { ok: false, error: "ファイルサイズは 20MB 以下にしてください" }
    }
    if (file.size === 0) return { ok: false, error: "空のファイルは添付できません" }

    const count = await prisma.sharedFile.count({
      where: {
        companyId: sess.companyId,
        deletedAt: null,
        attachedToType: ATTACHED_TO_TYPE,
        attachedToId: materialId,
      },
    })
    if (count >= EVIDENCE_MAX_COUNT) {
      return { ok: false, error: `根拠ファイルは1材料あたり ${EVIDENCE_MAX_COUNT} 件までです` }
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const uploaded = await uploadMaterialEvidenceFile({
      companyId: sess.companyId,
      materialId,
      fileName: file.name,
      contentType,
      buffer,
    })
    if (!uploaded) {
      return {
        ok: false,
        error:
          "GCS へのアップロードに失敗しました（環境変数 or 権限を確認してください）。レコードは変更していません。",
      }
    }

    const created = await prisma.sharedFile.create({
      data: {
        companyId: sess.companyId,
        fileName: file.name.slice(0, 255),
        fileType: ext,
        fileSize: BigInt(file.size),
        mimeType: contentType,
        // storageLocation は enum に GCS が無いので既定（SYSTEM_R2 = システムのバケット）のまま。実体は fileUrl の gs:// で分かる
        fileUrl: uploaded.gcsPath,
        attachedToType: ATTACHED_TO_TYPE,
        attachedToId: materialId,
        uploadedByUserId: sess.userId,
        tags: ["hs-evidence"],
      },
      select: { id: true },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Material",
        entityId: materialId,
        afterData: { action: "add_evidence_file", sharedFileId: created.id, fileName: file.name, size: file.size },
      },
    })

    revalidatePath(`/materials/${materialId}`)
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "根拠ファイルの追加に失敗しました" }
  }
}

// =============================================================================
// 3. 取り消し（論理削除・AuditLog。GCS 実体は消さない）
// =============================================================================
export async function removeMaterialEvidenceFile(
  materialId: string,
  fileId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const area = await checkArea("masterTerms")
    if (!area.ok) return area

    const material = await loadMaterial(materialId, sess.companyId)
    if (!material) return { ok: false, error: "素材が見つかりません" }

    const row = await prisma.sharedFile.findFirst({
      where: {
        id: fileId,
        companyId: sess.companyId,
        deletedAt: null,
        attachedToType: ATTACHED_TO_TYPE,
        attachedToId: materialId,
      },
      select: { id: true, fileName: true, fileUrl: true },
    })
    if (!row) return { ok: false, error: "対象の根拠ファイルが見つかりません" }

    await prisma.sharedFile.update({
      where: { id: row.id },
      data: { deletedAt: new Date() },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Material",
        entityId: materialId,
        beforeData: { action: "remove_evidence_file", sharedFileId: row.id, fileName: row.fileName },
      },
    })

    revalidatePath(`/materials/${materialId}`)
    return { ok: true, data: { id: row.id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "根拠ファイルの取り消しに失敗しました" }
  }
}

// =============================================================================
// 4. 開く（署名 URL・15 分）
// =============================================================================
export async function getMaterialEvidenceFileUrl(
  materialId: string,
  fileId: string,
): Promise<ActionResult<{ url: string; fileName: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const material = await loadMaterial(materialId, sess.companyId)
    if (!material) return { ok: false, error: "素材が見つかりません" }

    const row = await prisma.sharedFile.findFirst({
      where: {
        id: fileId,
        companyId: sess.companyId,
        deletedAt: null,
        attachedToType: ATTACHED_TO_TYPE,
        attachedToId: materialId,
      },
      select: { fileName: true, fileUrl: true },
    })
    if (!row) return { ok: false, error: "対象の根拠ファイルが見つかりません" }
    const url = await getSignedReadUrl(row.fileUrl)
    if (!url) return { ok: false, error: "ファイルの URL を作れませんでした（GCS の設定を確認してください）" }
    return { ok: true, data: { url, fileName: row.fileName } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "根拠ファイルの URL 取得に失敗しました" }
  }
}

// =============================================================================
// 5. 参考 URL の更新（詳細ページから追加・削除。編集フォームでも直せる）
// =============================================================================
export async function updateMaterialReferenceUrls(
  materialId: string,
  input: ReferenceUrlsInput,
): Promise<ActionResult<{ referenceUrls: ReferenceUrls }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const area = await checkArea("masterTerms")
    if (!area.ok) return area

    const parsed = referenceUrlsSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "URL の入力内容に誤りがあります" }
    }
    const material = await loadMaterial(materialId, sess.companyId)
    if (!material) return { ok: false, error: "素材が見つかりません" }

    const before = parseReferenceUrls(material.referenceUrls)
    const next = normalizeReferenceUrls(parsed.data)
    await prisma.material.update({
      where: { id: materialId },
      data: { referenceUrls: next ?? Prisma.DbNull },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Material",
        entityId: materialId,
        beforeData: { referenceUrls: before },
        afterData: { referenceUrls: next },
      },
    })

    revalidatePath(`/materials/${materialId}`)
    return { ok: true, data: { referenceUrls: next ?? [] } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "参考 URL の更新に失敗しました" }
  }
}
