import { auth } from "@/lib/auth"
import {
  runWithTenantContext,
  runWithoutTenantContext,
  type TenantContext,
} from "@/lib/tenant-context"

/**
 * Server Action / API Route の処理を、認証済みユーザーのテナントコンテキストで包む。
 *
 * @example
 *   "use server"
 *   import { withTenantContext } from "@/lib/with-tenant"
 *   import { prisma } from "@/lib/prisma"
 *
 *   export async function listClients() {
 *     return withTenantContext(async () => {
 *       return prisma.client.findMany() // companyId 自動付与・論理削除済みは除外
 *     })
 *   }
 *
 * MASTER_ADMIN が顧客テナントを閲覧する場合：
 *   withTenantContext(fn, {
 *     accessedTenantId: targetTenantId,
 *     accessReason: "顧客サポート対応 #12345",
 *     customerConsent: true,
 *   })
 */
export async function withTenantContext<T>(
  fn: () => Promise<T>,
  options?: {
    accessedTenantId?: string
    accessReason?: string
    customerConsent?: boolean
  }
): Promise<T> {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized: no active session")
  }

  const ctx: TenantContext = {
    userId: session.user.id,
    companyId: session.user.companyId,
    tenantType: session.user.tenantType,
    role: session.user.role,
    accessedTenantId: options?.accessedTenantId,
    accessReason: options?.accessReason,
    customerConsent: options?.customerConsent,
  }

  // MASTER_ADMIN 以外が他テナント閲覧を試みた場合は拒否
  if (
    ctx.accessedTenantId &&
    ctx.accessedTenantId !== ctx.companyId &&
    ctx.tenantType !== "MASTER_ADMIN"
  ) {
    throw new Error(
      "Forbidden: only MASTER_ADMIN can access another tenant's data"
    )
  }

  // MASTER_ADMIN の特権アクセスは accessReason 必須
  if (
    ctx.accessedTenantId &&
    ctx.accessedTenantId !== ctx.companyId &&
    !ctx.accessReason
  ) {
    throw new Error(
      "accessReason is required when MASTER_ADMIN accesses another tenant"
    )
  }

  return runWithTenantContext(ctx, fn)
}

/**
 * テナント分離をバイパスして実行（シード・スクリプト・cron 専用）。
 * Server Action / API Route からは絶対に呼ばないこと。
 */
export function withoutTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return runWithoutTenantContext(fn)
}
