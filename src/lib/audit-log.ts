import { prisma } from "@/lib/prisma"
import {
  getTenantContext,
  isPrivilegedAccess,
} from "@/lib/tenant-context"
import { withoutTenantContext } from "@/lib/with-tenant"
import type { AuditAction } from "@prisma/client"

export type AuditLogInput = {
  action: AuditAction
  entityType: string  // 例: "Client", "Quotation"
  entityId?: string
  beforeData?: Record<string, unknown> | null
  afterData?: Record<string, unknown> | null
  description?: string
}

/**
 * 監査ログを記録する。
 *
 * - 現在の TenantContext から userId / companyId / 特権アクセス情報を自動取得
 * - AuditLog 自体は TENANT_MODELS に含まれないため `withoutTenantContext` で
 *   Extension 経由の自動付与をスキップし、明示的に値を書く
 * - コンテキスト外で呼ばれた場合は何もしない（シード等は AuditLog を作らない）
 *
 * @example
 *   await writeAuditLog({
 *     action: "CREATE",
 *     entityType: "Client",
 *     entityId: newClient.id,
 *     afterData: { clientCode: newClient.clientCode },
 *     description: "クライアント新規作成",
 *   })
 */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  const ctx = getTenantContext()
  if (!ctx) return

  await withoutTenantContext(() =>
    prisma.auditLog.create({
      data: {
        companyId: ctx.companyId, // 操作者の所属テナント（実体）
        userId: ctx.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeData: input.beforeData ?? undefined,
        afterData: input.afterData ?? undefined,
        description: input.description,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        isPrivilegedAccess: isPrivilegedAccess(),
        accessedTenantId: ctx.accessedTenantId,
        accessReason: ctx.accessReason,
        customerConsent: ctx.customerConsent ?? false,
      },
    })
  )
}
