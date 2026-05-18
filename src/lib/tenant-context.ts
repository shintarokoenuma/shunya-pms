import { AsyncLocalStorage } from "node:async_hooks"
import type { TenantType, UserRole } from "@prisma/client"

export type TenantContext = {
  userId: string
  companyId: string
  tenantType: TenantType
  role: UserRole
  accessedTenantId?: string
  accessReason?: string
  customerConsent?: boolean
  ipAddress?: string
  userAgent?: string
}

// AsyncLocalStorage を globalThis に保持して、Turbopack のバンドル分離問題を回避
type GlobalWithTenantStore = typeof globalThis & {
  __shunyaTenantStorage?: AsyncLocalStorage<TenantContext>
  __shunyaBypassStorage?: AsyncLocalStorage<true>
}

const g = globalThis as GlobalWithTenantStore

const tenantStorage =
  g.__shunyaTenantStorage ??
  (g.__shunyaTenantStorage = new AsyncLocalStorage<TenantContext>())

const bypassStorage =
  g.__shunyaBypassStorage ??
  (g.__shunyaBypassStorage = new AsyncLocalStorage<true>())

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

export function getEffectiveCompanyId(): string {
  const ctx = requireTenantContext()
  return ctx.accessedTenantId ?? ctx.companyId
}

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

export function isBypassed(): boolean {
  return bypassStorage.getStore() === true
}

export function runWithoutTenantContext<T>(fn: () => Promise<T>): Promise<T> {
  return bypassStorage.run(true, fn)
}
