"use server"

import { revalidatePath } from "next/cache"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { COMPANY_SETTING_REQUIRED_JSON_DEFAULTS } from "@/lib/company-setting-defaults"
import {
  MEMO_UI_PREFERENCES_DEFAULT,
  canManageCompanySettings,
  type MemoUiPreferences,
} from "@/lib/types/ui-preferences"
import {
  readMemoUiPreferences,
  updateMemoUiPreferencesSchema,
  type UpdateMemoUiPreferencesInput,
} from "@/lib/validators/company-setting"

/**
 * B-202 PR-4: 品番カルテ メモ欄の表示スイッチ（会社の既定）Server Actions。
 * 仕様: v1.0 D-8（段階1・保存先 CompanySetting.uiPreferences）/ addendum v0.1 Q4 / v0.2 D-11
 * - product-sketches.ts / comments.ts の骨格を鏡写し（requireSession → 読み → 書き → AuditLog → revalidate）。
 * - ★schema 変更なし・migration なし。CompanySetting は休眠テーブル（0行）で必須 Json 7本に @default が無いため、
 *   upsert の create 側だけ company-setting-defaults.ts の {} で埋める（v0.2 D-11）。
 * - 読み（get）は行が無くても作らない。書き（update）は uiPreferences のみを書き、他の列には触らない。
 * - ★uiPreferences の他の名前空間（productKarte 以外・memo 以外）は読み出して残したまま書き戻す（丸ごと置換しない）。
 * - ★更新は管理者相当（OWNER / ADMIN）のみ。EXTERNAL は読み書きとも拒否（読みは既定を返す）。
 * - 会社の既定は全品番カルテに効くため revalidatePath("/products", "layout")。
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
    role: session.user.role as string,
  }
}

type UiPreferencesJson = Record<string, unknown> & {
  productKarte?: Record<string, unknown> & { memo?: unknown }
}

function asObject(raw: unknown): Record<string, unknown> {
  return raw !== null && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {}
}

// =============================================================================
// 1. 読み（行が無ければ既定・作らない）
// =============================================================================
export async function getMemoUiPreferences(): Promise<
  ActionResult<{ prefs: MemoUiPreferences; canManage: boolean }>
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL") {
      return { ok: true, data: { prefs: { ...MEMO_UI_PREFERENCES_DEFAULT }, canManage: false } }
    }
    const row = await prisma.companySetting.findUnique({
      where: { companyId: sess.companyId },
      select: { uiPreferences: true },
    })
    return {
      ok: true,
      data: {
        prefs: readMemoUiPreferences(row?.uiPreferences ?? null),
        canManage: canManageCompanySettings(sess.role),
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "表示設定の取得に失敗しました" }
  }
}

// =============================================================================
// 2. 更新（管理者相当のみ・upsert・uiPreferences の他の名前空間は保持）
// =============================================================================
export async function updateMemoUiPreferences(
  input: UpdateMemoUiPreferencesInput,
): Promise<ActionResult<{ prefs: MemoUiPreferences }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    if (sess.role === "EXTERNAL" || !canManageCompanySettings(sess.role)) {
      return { ok: false, error: "表示設定を変更できるのは管理者（OWNER / ADMIN）だけです" }
    }

    const parsed = updateMemoUiPreferencesSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") }
    }
    const next: MemoUiPreferences = parsed.data

    // 最新を読み直し、他の名前空間を保持したまま productKarte.memo だけ差し替える
    const row = await prisma.companySetting.findUnique({
      where: { companyId: sess.companyId },
      select: { id: true, uiPreferences: true },
    })
    const current = asObject(row?.uiPreferences) as UiPreferencesJson
    const before = readMemoUiPreferences(current)
    const productKarte = asObject(current.productKarte)
    const merged = {
      ...current,
      productKarte: { ...productKarte, memo: next },
    } as Prisma.InputJsonValue

    await prisma.companySetting.upsert({
      where: { companyId: sess.companyId },
      // create: 必須 Json 7本は {} ＝未設定（v0.2 D-11）。他の列は schema の @default
      create: {
        companyId: sess.companyId,
        ...COMPANY_SETTING_REQUIRED_JSON_DEFAULTS,
        uiPreferences: merged,
      },
      // update: uiPreferences のみ（他の列に触らない）
      update: { uiPreferences: merged },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: row ? "UPDATE" : "CREATE",
        entityType: "CompanySetting",
        entityId: row?.id ?? sess.companyId,
        beforeData: { action: "update_memo_ui_preferences", memo: before },
        afterData: { action: "update_memo_ui_preferences", memo: next },
      },
    })

    revalidatePath("/products", "layout")
    return { ok: true, data: { prefs: next } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "表示設定の更新に失敗しました" }
  }
}
