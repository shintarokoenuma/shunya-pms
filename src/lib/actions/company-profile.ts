"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canManageCompanySettings } from "@/lib/types/ui-preferences"
import { isBankAccount } from "@/lib/company-issuer"
import {
  companyBankAccountSchema,
  companyProfileSchema,
  type CompanyBankAccountView,
  type CompanyProfileView,
} from "@/lib/validators/company-profile"

/**
 * B-205 PR-1（spec v1.0 D-2・D-3・D-11・D-24）: 設定ページ「自社情報」「振込先」の Server Actions。
 * company-settings.ts の骨格を写す（requireSession → 読み → 書き → AuditLog → revalidatePath）。
 * - 読みは誰でも（EXTERNAL は拒否）。更新は OWNER / ADMIN だけ（canManageCompanySettings）。画面だけで止めず action 側でも拒否する
 * - Company は companyId 列を持たない（自分のテナントの行を id で更新する）。TENANT_MODELS の対象外
 * - 帳票は getCompanyIssuer（src/lib/company-issuer.ts）で同じ行を読む。発行済みの請求書・納品書の写しは書き換えない
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

const EXTERNAL_DENIED = "外部ユーザーは設定を扱えません"
const MANAGER_DENIED = "自社情報を変更できるのは管理者（OWNER / ADMIN）だけです"

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

const PROFILE_SELECT = {
  id: true,
  companyName: true,
  legalEntity: true,
  postalCode: true,
  address: true,
  phone: true,
  fax: true,
  email: true,
  website: true,
  taxId: true,
  bankAccount: true,
} satisfies Prisma.CompanySelect

type ProfileRow = Prisma.CompanyGetPayload<{ select: typeof PROFILE_SELECT }>

function toView(row: ProfileRow): CompanyProfileView {
  const n = (v: string | null) => (v == null || v.trim() === "" ? null : v.trim())
  return {
    companyName: row.companyName,
    legalEntity: n(row.legalEntity),
    postalCode: n(row.postalCode),
    address: n(row.address),
    phone: n(row.phone),
    fax: n(row.fax),
    email: n(row.email),
    website: n(row.website),
    taxId: n(row.taxId),
  }
}

// =============================================================================
// 1. 読み（自社情報・振込先・変更できるか）
// =============================================================================
export async function getCompanyProfile(): Promise<
  ActionResult<{ profile: CompanyProfileView; bank: CompanyBankAccountView | null; canManage: boolean }>
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }

    const row = await prisma.company.findFirst({
      where: { id: sess.companyId, deletedAt: null },
      select: PROFILE_SELECT,
    })
    if (!row) return { ok: false, error: "会社の情報が見つかりません" }
    return {
      ok: true,
      data: {
        profile: toView(row),
        bank: isBankAccount(row.bankAccount) ? row.bankAccount : null,
        canManage: canManageCompanySettings(sess.role),
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "自社情報の取得に失敗しました" }
  }
}

// =============================================================================
// 2. 自社情報の更新（OWNER / ADMIN のみ・この欄だけ保存する）
// =============================================================================
export async function updateCompanyProfile(input: unknown): Promise<ActionResult<{ profile: CompanyProfileView }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }
    if (!canManageCompanySettings(sess.role)) return { ok: false, error: MANAGER_DENIED }

    const parsed = companyProfileSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const before = await prisma.company.findFirst({
      where: { id: sess.companyId, deletedAt: null },
      select: PROFILE_SELECT,
    })
    if (!before) return { ok: false, error: "会社の情報が見つかりません" }

    const after = await prisma.company.update({
      where: { id: sess.companyId },
      data: {
        companyName: data.companyName,
        legalEntity: data.legalEntity,
        postalCode: data.postalCode,
        address: data.address,
        phone: data.phone,
        fax: data.fax,
        email: data.email,
        website: data.website,
        taxId: data.taxId,
      },
      select: PROFILE_SELECT,
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Company",
        entityId: sess.companyId,
        beforeData: { action: "update_company_profile", ...toView(before) },
        afterData: { action: "update_company_profile", ...toView(after) },
        description: "自社情報を更新",
      },
    })

    revalidatePath("/settings", "layout")
    return { ok: true, data: { profile: toView(after) } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "自社情報の更新に失敗しました" }
  }
}

// =============================================================================
// 3. 振込先の更新（OWNER / ADMIN のみ・5 項目すべてか、すべて空か・P1-D2）
// =============================================================================
export async function updateCompanyBankAccount(
  input: unknown,
): Promise<ActionResult<{ bank: CompanyBankAccountView | null }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") return { ok: false, error: EXTERNAL_DENIED }
    if (!canManageCompanySettings(sess.role)) return { ok: false, error: MANAGER_DENIED }

    const parsed = companyBankAccountSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const bank = parsed.data

    const before = await prisma.company.findFirst({
      where: { id: sess.companyId, deletedAt: null },
      select: { id: true, bankAccount: true },
    })
    if (!before) return { ok: false, error: "会社の情報が見つかりません" }

    await prisma.company.update({
      where: { id: sess.companyId },
      data: { bankAccount: bank ?? Prisma.DbNull },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Company",
        entityId: sess.companyId,
        beforeData: {
          action: "update_company_bank_account",
          bank: isBankAccount(before.bankAccount) ? before.bankAccount : null,
        },
        afterData: { action: "update_company_bank_account", bank },
        description: "振込先を更新",
      },
    })

    revalidatePath("/settings", "layout")
    return { ok: true, data: { bank } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "振込先の更新に失敗しました" }
  }
}
