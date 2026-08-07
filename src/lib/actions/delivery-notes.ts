"use server"

import { revalidatePath } from "next/cache"
import { Prisma, DeliveryNoteStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { COMPANY_PROFILE } from "@/lib/constants/company-profile"
import {
  deliveryNoteInputSchema,
  deliveryNoteListParamsSchema,
  DELIVERY_NOTE_STATUS_UI_VALUES,
  type DeliveryNoteListParams,
  type DeliveryNoteInput,
} from "@/lib/validators/delivery-note"

/**
 * B-108: サンプル納品書 Server Actions（PO/WO の作法を写経）。
 * 仕様: docs/specs/b-108-sample-delivery-note-spec-confirmation-v1_0-2026-08-05.md
 * - 採番 DLV-{年}-{4桁}（保存時確定・P2002 リトライ）。★findFirst を deletedAt で絞らない（§7）。
 * - 物理削除は作らない。deletedAt 論理削除のみ・DRAFT 以外は不可（§9）。
 * - 宛先はマスターから解決して shipTo* に値コピー（§4-3・発行後にマスターを直しても不変）。
 * - DeliveryNote.productId は入れない（明細側 productId で引く・§3-1）。
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
// 選択肢（新規フォーム用・companyId スコープ）
// =============================================================================
export type ClientOption = { id: string; clientCode: string; companyName: string }
export type BuyerOption = { id: string; buyerCode: string; buyerName: string; clientId: string | null }
export type DestinationOption = {
  id: string
  destinationCode: string
  destinationName: string
  buyerId: string
}
export type DeliveryProductOption = {
  id: string
  productCode: string
  productName: string
  clientProductCode: string | null
}

export async function listActiveClientsForDeliverySelect(): Promise<ClientOption[]> {
  const sess = await requireSession()
  if (!sess.ok) return []
  return prisma.client.findMany({
    where: { companyId: sess.companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, clientCode: true, companyName: true },
    orderBy: [{ clientCode: "asc" }],
  })
}

export async function listActiveBuyersForDeliverySelect(): Promise<BuyerOption[]> {
  const sess = await requireSession()
  if (!sess.ok) return []
  return prisma.buyer.findMany({
    where: { companyId: sess.companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, buyerCode: true, buyerName: true, clientId: true },
    orderBy: [{ buyerCode: "asc" }],
  })
}

export async function listActiveDestinationsForDeliverySelect(): Promise<
  DestinationOption[]
> {
  const sess = await requireSession()
  if (!sess.ok) return []
  return prisma.deliveryDestination.findMany({
    where: { companyId: sess.companyId, deletedAt: null, status: "ACTIVE" },
    select: {
      id: true,
      destinationCode: true,
      destinationName: true,
      buyerId: true,
    },
    orderBy: [{ destinationCode: "asc" }],
  })
}

export async function listActiveProductsForDeliverySelect(): Promise<
  DeliveryProductOption[]
> {
  const sess = await requireSession()
  if (!sess.ok) return []
  return prisma.product.findMany({
    where: { companyId: sess.companyId, deletedAt: null },
    select: {
      id: true,
      productCode: true,
      productName: true,
      clientProductCode: true,
    },
    orderBy: [{ productCode: "asc" }],
  })
}

// =============================================================================
// 採番（DLV-{年}-{4桁}）— ★findFirst を deletedAt で絞らない（§7・番号再利用防止）
// =============================================================================
type DeliveryNumberFinder = {
  findFirst: (args: {
    where: { companyId: string; deliveryNumber: { startsWith: string } }
    orderBy: { deliveryNumber: "desc" }
    select: { deliveryNumber: true }
  }) => Promise<{ deliveryNumber: string } | null>
}

function deliveryNumberPrefix(year: number): string {
  return `DLV-${year}-`
}

async function computeNextDeliveryNumber(
  finder: DeliveryNumberFinder,
  companyId: string,
  prefix: string,
): Promise<string> {
  // ★deletedAt で絞らない：論理削除レコードも最大値判定に含める（番号の再利用を防ぐ・§9）。
  const last = await finder.findFirst({
    where: { companyId, deliveryNumber: { startsWith: prefix } },
    orderBy: { deliveryNumber: "desc" },
    select: { deliveryNumber: true },
  })
  let nextNum = 1
  if (last) {
    const match = last.deliveryNumber.match(/-(\d+)$/)
    if (match) nextNum = parseInt(match[1], 10) + 1
  }
  return `${prefix}${String(nextNum).padStart(4, "0")}`
}

/** UI プレビュー専用：当年の次の DLV 番号（保存時に再計算・確定）。 */
export async function generateNextDeliveryNumberPreview(): Promise<
  ActionResult<{ preview: string }>
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const preview = await computeNextDeliveryNumber(
      prisma.deliveryNote,
      sess.companyId,
      deliveryNumberPrefix(new Date().getFullYear()),
    )
    return { ok: true, data: { preview } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "採番プレビューに失敗しました",
    }
  }
}

// =============================================================================
// 宛先解決（§4-2 / §4-3・snapshot コピー）
// =============================================================================
type AddressParts = {
  postalCode?: string | null
  prefecture?: string | null
  city?: string | null
  address?: string | null
  addressLine2?: string | null
}

function composeAddress(p: AddressParts): string {
  const parts: string[] = []
  if (p.postalCode) parts.push(`〒${p.postalCode}`)
  const line = [p.prefecture, p.city, p.address, p.addressLine2]
    .filter((v): v is string => !!v && v.trim() !== "")
    .join(" ")
  if (line) parts.push(line)
  return parts.join(" ")
}

const SHIP_FROM_ADDRESS = `${COMPANY_PROFILE.postalCode} ${COMPANY_PROFILE.address}`

// =============================================================================
// 一覧（§9: 既定は deletedAt IS NULL・CANCELLED は残す）
// =============================================================================
export type DeliveryNoteListItem = {
  id: string
  deliveryNumber: string
  clientName: string | null
  status: DeliveryNoteStatus
  deliveryDate: Date
  totalQuantity: number
  createdAt: Date
}

export async function listDeliveryNotes(
  params: DeliveryNoteListParams = {} as DeliveryNoteListParams,
): Promise<
  ActionResult<{
    items: DeliveryNoteListItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const parsed = deliveryNoteListParamsSchema.parse(params)

    const skip = (parsed.page - 1) * parsed.pageSize
    const q = parsed.q.trim()

    const where: Prisma.DeliveryNoteWhereInput = {
      companyId: sess.companyId,
      deletedAt: null,
    }
    if (parsed.status) where.status = parsed.status
    if (parsed.clientId) where.clientId = parsed.clientId
    if (q.length > 0) {
      where.deliveryNumber = { contains: q, mode: "insensitive" }
    }

    const [rows, total] = await Promise.all([
      prisma.deliveryNote.findMany({
        where,
        select: {
          id: true,
          deliveryNumber: true,
          clientId: true,
          status: true,
          deliveryDate: true,
          totalQuantity: true,
          createdAt: true,
        },
        orderBy: [{ deliveryNumber: "desc" }],
        skip,
        take: parsed.pageSize,
      }),
      prisma.deliveryNote.count({ where }),
    ])

    const clientIds = [...new Set(rows.map((r) => r.clientId))]
    const clientMap = new Map<string, string>()
    if (clientIds.length > 0) {
      const clients = await prisma.client.findMany({
        where: { id: { in: clientIds }, companyId: sess.companyId },
        select: { id: true, companyName: true },
      })
      for (const c of clients) clientMap.set(c.id, c.companyName)
    }

    const items: DeliveryNoteListItem[] = rows.map((r) => ({
      id: r.id,
      deliveryNumber: r.deliveryNumber,
      clientName: clientMap.get(r.clientId) ?? null,
      status: r.status,
      deliveryDate: r.deliveryDate,
      totalQuantity: r.totalQuantity,
      createdAt: r.createdAt,
    }))

    return {
      ok: true,
      data: {
        items,
        total,
        page: parsed.page,
        pageSize: parsed.pageSize,
        totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "一覧取得に失敗しました",
    }
  }
}

// =============================================================================
// 単票取得（companyId スコープ・明細込み）
// =============================================================================
export async function getDeliveryNote(id: string) {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const row = await prisma.deliveryNote.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      include: {
        items: { orderBy: { itemOrder: "asc" } },
      },
    })
    if (!row) return { ok: false as const, error: "納品書が見つかりません" }
    const client = await prisma.client.findFirst({
      where: { id: row.clientId, companyId: sess.companyId },
      select: { companyName: true },
    })
    return {
      ok: true as const,
      data: { ...row, clientName: client?.companyName ?? null },
    }
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "取得に失敗しました",
    }
  }
}

// =============================================================================
// create / update 共有の準備処理
// - clientId 実在・buyer/destination の companyId スコープ・明細 productId の自社検証
// - §4-2/§4-3: 送り先解決（destination → buyer → client.shipping* → client 基本・上書き優先）
// - §6: 金額計算（showAmounts のときのみ）と警告
// =============================================================================
async function prepareDeliveryNote(companyId: string, data: DeliveryNoteInput) {
  // クライアント（必須）を companyId スコープで解決。
  const client = await prisma.client.findFirst({
    where: { id: data.clientId, companyId, deletedAt: null },
    select: {
      id: true,
      postalCode: true,
      prefecture: true,
      city: true,
      address: true,
      addressLine2: true,
      phone: true,
      shippingPostalCode: true,
      shippingPrefecture: true,
      shippingCity: true,
      shippingAddress: true,
      shippingAddressLine2: true,
      primaryContactId: true,
    },
  })
  if (!client) {
    return { ok: false as const, error: "指定されたクライアントが見つかりません" }
  }

  // 任意の buyer / destination（companyId スコープ）。
  const buyer = data.buyerId
    ? await prisma.buyer.findFirst({
        where: { id: data.buyerId, companyId, deletedAt: null },
        select: {
          id: true,
          postalCode: true,
          prefecture: true,
          city: true,
          address: true,
          addressLine2: true,
          contactPerson: true,
          phone: true,
        },
      })
    : null
  if (data.buyerId && !buyer) {
    return { ok: false as const, error: "指定されたバイヤーが見つかりません" }
  }

  const destination = data.deliveryDestinationId
    ? await prisma.deliveryDestination.findFirst({
        where: {
          id: data.deliveryDestinationId,
          companyId,
          deletedAt: null,
        },
        select: {
          id: true,
          postalCode: true,
          prefecture: true,
          city: true,
          address: true,
          addressLine2: true,
          contactPerson: true,
          phone: true,
        },
      })
    : null
  if (data.deliveryDestinationId && !destination) {
    return { ok: false as const, error: "指定された納品先が見つかりません" }
  }

  // 明細の品番が自社のものか検証（productId は NOT NULL・§3-1）。
  const productIds = [...new Set(data.items.map((i) => i.productId))]
  const validProducts = await prisma.product.findMany({
    where: { id: { in: productIds }, companyId, deletedAt: null },
    select: { id: true },
  })
  const validProductIds = new Set(validProducts.map((p) => p.id))
  const invalid = data.items.find((i) => !validProductIds.has(i.productId))
  if (invalid) {
    return { ok: false as const, error: "明細に無効な品番が含まれています" }
  }

  // §4-2 / §4-3: 宛先を解決して値コピー。フォームで上書きがあればそれを優先。
  let resolvedAddress = ""
  let resolvedContact: string | null = null
  let resolvedPhone: string | null = null
  if (destination) {
    resolvedAddress = composeAddress(destination)
    resolvedContact = destination.contactPerson
    resolvedPhone = destination.phone
  }
  if (!resolvedAddress && buyer) {
    resolvedAddress = composeAddress(buyer)
    resolvedContact = resolvedContact ?? buyer.contactPerson
    resolvedPhone = resolvedPhone ?? buyer.phone
  }
  if (!resolvedAddress) {
    const shipping = composeAddress({
      postalCode: client.shippingPostalCode,
      prefecture: client.shippingPrefecture,
      city: client.shippingCity,
      address: client.shippingAddress,
      addressLine2: client.shippingAddressLine2,
    })
    resolvedAddress = shipping || composeAddress(client)
  }
  if (!resolvedContact) {
    const contact = client.primaryContactId
      ? await prisma.clientContact.findFirst({
          where: { id: client.primaryContactId, companyId },
          select: { displayName: true, lastName: true, firstName: true },
        })
      : await prisma.clientContact.findFirst({
          where: {
            clientId: client.id,
            companyId,
            isPrimary: true,
            deletedAt: null,
          },
          select: { displayName: true, lastName: true, firstName: true },
        })
    if (contact) {
      resolvedContact =
        contact.displayName ??
        ([contact.lastName, contact.firstName].filter(Boolean).join(" ") ||
          null)
    }
  }
  resolvedPhone = resolvedPhone ?? client.phone

  const shipToAddress = data.shipToAddress ?? resolvedAddress ?? ""
  const shipToContact = data.shipToContact ?? resolvedContact
  const shipToPhone = data.shipToPhone ?? resolvedPhone

  // §6: 金額。showAmounts のときのみ計算。単価未入力の行があれば警告（ブロックしない）。
  const warnings: string[] = []
  const itemRows = data.items.map((it, i) => {
    const subtotal =
      it.unitPrice != null ? Math.round(it.quantity * it.unitPrice) : null
    return {
      itemOrder: i,
      skuId: null,
      productId: it.productId,
      clientProductCode: it.clientProductCode,
      productName: it.productName,
      colorCode: it.colorCode,
      colorName: it.colorName,
      size: it.size,
      quantity: it.quantity,
      unit: it.unit || "枚",
      unitPrice:
        it.unitPrice != null ? new Prisma.Decimal(it.unitPrice) : null,
      subtotal: subtotal != null ? new Prisma.Decimal(subtotal) : null,
      currency: data.currency,
      notes: null,
    }
  })

  const totalQuantity = data.items.reduce((a, it) => a + it.quantity, 0)

  let subtotalAmount: Prisma.Decimal | null = null
  let taxAmount: Prisma.Decimal | null = null
  let totalAmount: Prisma.Decimal | null = null
  if (data.showAmounts) {
    if (data.items.some((it) => it.unitPrice == null)) {
      warnings.push("単価未入力の明細があります（金額表示ONのまま保存しました）")
    }
    const sub = data.items.reduce(
      (a, it) => a + (it.unitPrice != null ? it.quantity * it.unitPrice : 0),
      0,
    )
    const tax = Math.round((sub * data.taxRatePercent) / 100)
    subtotalAmount = new Prisma.Decimal(Math.round(sub))
    taxAmount = new Prisma.Decimal(tax)
    totalAmount = new Prisma.Decimal(Math.round(sub) + tax)
  }

  return {
    ok: true as const,
    prepared: {
      clientId: data.clientId,
      buyerId: data.buyerId,
      deliveryDestinationId: data.deliveryDestinationId,
      shipToAddress,
      shipToContact,
      shipToPhone,
      deliveryDate: new Date(data.deliveryDate),
      totalQuantity,
      showAmounts: data.showAmounts,
      subtotalAmount,
      taxAmount,
      totalAmount,
      currency: data.currency,
      internalNotes: data.internalNotes,
      clientNotes: data.clientNotes,
      itemRows,
      warnings,
    },
  }
}

// =============================================================================
// 新規（採番 + DeliveryNote + DeliveryNoteItem 群を同一 tx・P2002 リトライ）
// =============================================================================
const CREATE_MAX_RETRIES = 3

export async function createDeliveryNote(
  input: unknown,
): Promise<ActionResult<{ id: string; deliveryNumber: string; warnings: string[] }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = deliveryNoteInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const prep = await prepareDeliveryNote(sess.companyId, data)
    if (!prep.ok) return prep
    const p = prep.prepared

    const prefix = deliveryNumberPrefix(new Date().getFullYear())
    let created: { id: string; deliveryNumber: string } | null = null
    let lastError: unknown = null

    for (let attempt = 0; attempt < CREATE_MAX_RETRIES; attempt++) {
      try {
        created = await prisma.$transaction(
          async (tx) => {
            const deliveryNumber = await computeNextDeliveryNumber(
              tx.deliveryNote,
              sess.companyId,
              prefix,
            )
            const dn = await tx.deliveryNote.create({
              data: {
                companyId: sess.companyId,
                deliveryNumber,
                // §3-1: 代表 productId は入れない（明細側 productId で引く）。
                clientId: p.clientId,
                buyerId: p.buyerId,
                deliveryDestinationId: p.deliveryDestinationId,
                shipFromAddress: SHIP_FROM_ADDRESS,
                shipFromContact: COMPANY_PROFILE.name,
                shipToAddress: p.shipToAddress,
                shipToContact: p.shipToContact,
                shipToPhone: p.shipToPhone,
                deliveryDate: p.deliveryDate,
                totalQuantity: p.totalQuantity,
                showAmounts: p.showAmounts,
                subtotalAmount: p.subtotalAmount,
                taxAmount: p.taxAmount,
                totalAmount: p.totalAmount,
                currency: p.currency,
                status: DeliveryNoteStatus.DRAFT,
                createdByUserId: sess.userId,
                internalNotes: p.internalNotes,
                clientNotes: p.clientNotes,
              },
              select: { id: true, deliveryNumber: true },
            })
            await tx.deliveryNoteItem.createMany({
              data: p.itemRows.map((r) => ({ ...r, deliveryNoteId: dn.id })),
            })
            return dn
          },
          { timeout: 15000 },
        )
        break
      } catch (e) {
        lastError = e
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          continue // deliveryNumber unique 衝突：再試行
        }
        throw e
      }
    }

    if (!created) {
      return {
        ok: false,
        error:
          lastError instanceof Error
            ? `採番衝突が解消されませんでした：${lastError.message}`
            : "採番衝突が解消されませんでした",
      }
    }

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "CREATE",
        entityType: "DeliveryNote",
        entityId: created.id,
        afterData: {
          deliveryNumber: created.deliveryNumber,
          itemCount: p.itemRows.length,
        },
      },
    })

    revalidatePath("/deliveries")
    return {
      ok: true,
      data: {
        id: created.id,
        deliveryNumber: created.deliveryNumber,
        warnings: p.warnings,
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "納品書の作成に失敗しました",
    }
  }
}

// =============================================================================
// 編集（B-108 PR1b 追補: DRAFT のみ・deliveryNumber は再採番しない）
// =============================================================================
export async function updateDeliveryNote(
  id: string,
  input: unknown,
): Promise<
  ActionResult<{ id: string; deliveryNumber: string; warnings: string[] }>
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = deliveryNoteInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.deliveryNote.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, status: true, deliveryNumber: true },
    })
    if (!existing) return { ok: false, error: "納品書が見つかりません" }
    // DRAFT のみ編集可（§9 の削除・§4-3「発行後は不変」と同じ線）。
    if (existing.status !== DeliveryNoteStatus.DRAFT) {
      return { ok: false, error: "ドラフト以外の納品書は編集できません" }
    }

    const prep = await prepareDeliveryNote(sess.companyId, data)
    if (!prep.ok) return prep
    const p = prep.prepared

    await prisma.$transaction(
      async (tx) => {
        await tx.deliveryNote.update({
          where: { id },
          // deliveryNumber / status は更新しない（保存済み番号を保持・DRAFT のまま）。
          data: {
            clientId: p.clientId,
            buyerId: p.buyerId,
            deliveryDestinationId: p.deliveryDestinationId,
            shipFromAddress: SHIP_FROM_ADDRESS,
            shipFromContact: COMPANY_PROFILE.name,
            shipToAddress: p.shipToAddress,
            shipToContact: p.shipToContact,
            shipToPhone: p.shipToPhone,
            deliveryDate: p.deliveryDate,
            totalQuantity: p.totalQuantity,
            showAmounts: p.showAmounts,
            subtotalAmount: p.subtotalAmount,
            taxAmount: p.taxAmount,
            totalAmount: p.totalAmount,
            currency: p.currency,
            internalNotes: p.internalNotes,
            clientNotes: p.clientNotes,
          },
        })
        // 明細は全削除→再作成（DeliveryNoteItem は deletedAt を持たず DeliveryNote 従属）。
        await tx.deliveryNoteItem.deleteMany({ where: { deliveryNoteId: id } })
        await tx.deliveryNoteItem.createMany({
          data: p.itemRows.map((r) => ({ ...r, deliveryNoteId: id })),
        })
      },
      { timeout: 15000 },
    )

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "DeliveryNote",
        entityId: id,
        afterData: {
          deliveryNumber: existing.deliveryNumber,
          itemCount: p.itemRows.length,
        },
      },
    })

    revalidatePath("/deliveries")
    revalidatePath(`/deliveries/${id}`)
    return {
      ok: true,
      data: {
        id,
        deliveryNumber: existing.deliveryNumber,
        warnings: p.warnings,
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "納品書の更新に失敗しました",
    }
  }
}

// =============================================================================
// ステータス更新（§8: v1 は DRAFT/SHIPPED/DELIVERED/CANCELLED の4値のみ）
// =============================================================================
export async function updateDeliveryNoteStatus(
  id: string,
  status: DeliveryNoteStatus,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    if (!DELIVERY_NOTE_STATUS_UI_VALUES.includes(status)) {
      return { ok: false, error: "このステータスは選択できません" }
    }

    const existing = await prisma.deliveryNote.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, status: true },
    })
    if (!existing) return { ok: false, error: "納品書が見つかりません" }
    if (existing.status === status) return { ok: true, data: { id } }

    await prisma.deliveryNote.update({ where: { id }, data: { status } })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "STATUS_CHANGE",
        entityType: "DeliveryNote",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status },
      },
    })

    revalidatePath("/deliveries")
    revalidatePath(`/deliveries/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "ステータス更新に失敗しました",
    }
  }
}

// =============================================================================
// 論理削除（§9: 物理削除は作らない・DRAFT 以外は不可）
// =============================================================================
export async function softDeleteDeliveryNote(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.deliveryNote.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, status: true },
    })
    if (!existing) return { ok: false, error: "納品書が見つかりません" }
    // §9: DRAFT 以外の論理削除は不可（発行後は CANCELLED で一覧に残す）。
    if (existing.status !== DeliveryNoteStatus.DRAFT) {
      return {
        ok: false,
        error: "ドラフト以外は削除できません（発行後はキャンセルで残します）",
      }
    }

    await prisma.deliveryNote.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "DeliveryNote",
        entityId: id,
        afterData: { deletedAt: new Date().toISOString(), reason: "softDelete" },
      },
    })

    revalidatePath("/deliveries")
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "削除に失敗しました",
    }
  }
}
