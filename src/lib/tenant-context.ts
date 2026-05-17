import { AsyncLocalStorage } from "node:async_hooks"
import type { TenantType, UserRole } from "@prisma/client"

/**
 * リクエスト単位で持ち回るテナントコンテキスト。
 *
 * - 通常テナントのユーザー：companyId = 自テナントID、accessedTenantId は未指定
 * - shunya（MASTER_ADMIN）のユーザー：
 *     - 自テナントを操作中：accessedTenantId は未指定
 *     - 顧客テナントを覗き見中：accessedTenantId に対象顧客テナントID、accessReason は記録必須
 */
export type TenantContext = {
  userId: string
  companyId: string
  tenantType: TenantType
  role: UserRole
  /** 特権アクセス中の閲覧対象テナントID */
  accessedTenantId?: string
  /** 特権アクセスの理由（AuditLog に記録） */
  accessReason?: string
  /** 特権アクセスの顧客同意フラグ */
  customerConsent?: boolean
  /** リクエストメタ（AuditLog 用） */
  ipAddress?: string
  userAgent?: string
}

const tenantStorage = new AsyncLocalStorage<TenantContext>()
const bypassStorage = new AsyncLocalStorage<true>()

export function getTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore()
}

export function requireTenantContext(): TenantContext {
  const ctx = tenantStorage.getStore()
  if (!ctx) {
    throw new Error(
      "TenantContext is not set. Wrap your handler with withTenantContext()."
    )
  }
  return ctx
}

/**
 * クエリ対象として使う実効テナントID。
 * 特権アクセス中なら accessedTenantId、それ以外は自テナントの companyId。
 */
export function getEffectiveCompanyId(): string {
  const ctx = requireTenantContext()
  return ctx.accessedTenantId ?? ctx.companyId
}

/**
 * 現在のリクエストが MASTER_ADMIN の特権アクセス中か。
 * AuditLog.isPrivilegedAccess に直結。
 */
export function isPrivilegedAccess(): boolean {
  const ctx = tenantStorage.getStore()
  if (!ctx) return false
  return (
    ctx.tenantType === "MASTER_ADMIN" &&
    !!ctx.accessedTenantId &&
    ctx.accessedTenantId !== ctx.companyId
  )
}

export function runWithTenantContext<T>(
  context: TenantContext,
  fn: () => Promise<T>
): Promise<T> {
  return tenantStorage.run(context, fn)
}

/**
 * テナント分離をバイパスして実行（シード・マイグレーション・cron 専用）。
 * Server Action / API Route からは決して呼ばないこと。
 */
export function isBypassed(): boolean {
  return bypassStorage.getStore() === true
}

export function runWithoutTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return bypassStorage.run(true, fn)
}
