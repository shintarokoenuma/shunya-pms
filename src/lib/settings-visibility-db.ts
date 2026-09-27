import { prisma } from "@/lib/prisma"
import { readRolePermissions, type RolePermissions } from "@/lib/settings-visibility"

/**
 * B-205 PR-2（D-20）: 役割と権限を CompanySetting から読む（server 専用・prisma 依存）。
 * 純関数は settings-visibility.ts。行が無い・未設定なら空（＝全員「見る」・D-16）。
 * ★CompanySetting は TENANT_MODELS に無い。companyId で絞る（@unique）
 */
export async function getRolePermissions(companyId: string): Promise<RolePermissions> {
  const row = await prisma.companySetting.findUnique({
    where: { companyId },
    select: { securitySettings: true },
  })
  return readRolePermissions(row?.securitySettings ?? null)
}
