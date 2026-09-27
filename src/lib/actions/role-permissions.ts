"use server"

import { revalidatePath } from "next/cache"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { COMPANY_SETTING_REQUIRED_JSON_DEFAULTS } from "@/lib/company-setting-defaults"
import { canManageCompany } from "@/lib/permissions"
import { readRolePermissions, type RolePermissions } from "@/lib/settings-visibility"
import { updateRolePermissionsSchema } from "@/lib/validators/role-permissions"

/**
 * B-205 PR-2（D-13・D-16・D-20・P2-D7・P2-D9）: 「役割と権限」の Server Actions。
 * - 読みは誰でも（EXTERNAL は拒否）。書きは OWNER / ADMIN だけ（canManageCompany・画面だけで止めず action 側でも拒否）
 * - 保存先は CompanySetting.securitySettings.rolePermissions。★securitySettings の他のキーは残したまま書き戻す
 * - 行が無ければ upsert の create 側を COMPANY_SETTING_REQUIRED_JSON_DEFAULTS（{}）で埋める（B-202 PR-4 と同じ）
 * ★CompanySetting は TENANT_MODELS に無い。companyId で絞る
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

const EXTERNAL_DENIED = "外部ユーザーは設定を扱えません"
const MANAGER_DENIED = "役割と権限を変更できるのはオーナーと管理者だけです"

async function requireSession() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, error: "認証されていません" }
  }
  return {
    ok: true as const,
    companyId: session.user.companyId,
    userId: session.user.id,
    role: session.user.role as string,
  }
}

function asObject(raw: unknown): Record<string, unknown> {
  return raw !== null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
}

export async function getRolePermissionsView(): Promise<ActionResult<{ perms: RolePermissions; canManage: boolean }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }
    const row = await prisma.companySetting.findUnique({
      where: { companyId: sess.companyId },
      select: { securitySettings: true },
    })
    return {
      ok: true,
      data: { perms: readRolePermissions(row?.securitySettings ?? null), canManage: canManageCompany(sess.role) },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "役割と権限の取得に失敗しました" }
  }
}

export async function updateRolePermissions(input: unknown): Promise<ActionResult<{ perms: RolePermissions }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }
    if (!canManageCompany(sess.role)) return { ok: false, error: MANAGER_DENIED }

    const parsed = updateRolePermissionsSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const next: RolePermissions = { settings: parsed.data.settings }

    // 最新を読み直し、securitySettings の他のキーと rolePermissions の他の名前空間を残したまま settings だけ差し替える
    const row = await prisma.companySetting.findUnique({
      where: { companyId: sess.companyId },
      select: { id: true, securitySettings: true },
    })
    const current = asObject(row?.securitySettings)
    const before = readRolePermissions(current)
    const currentRp = asObject(current.rolePermissions)
    const merged = {
      ...current,
      rolePermissions: { ...currentRp, settings: next.settings },
    } as Prisma.InputJsonValue

    await prisma.companySetting.upsert({
      where: { companyId: sess.companyId },
      create: {
        companyId: sess.companyId,
        ...COMPANY_SETTING_REQUIRED_JSON_DEFAULTS,
        securitySettings: merged,
      },
      update: { securitySettings: merged },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: row ? "UPDATE" : "CREATE",
        entityType: "CompanySetting",
        entityId: row?.id ?? sess.companyId,
        beforeData: { action: "update_role_permissions", rolePermissions: before },
        afterData: { action: "update_role_permissions", rolePermissions: next },
        description: "役割と権限を更新",
      },
    })

    revalidatePath("/settings", "layout")
    return { ok: true, data: { perms: next } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "役割と権限の更新に失敗しました" }
  }
}
