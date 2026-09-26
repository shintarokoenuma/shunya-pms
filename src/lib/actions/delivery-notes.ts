"use server"

import { revalidatePath } from "next/cache"
import { CounterpartType, Prisma, DeliveryLineKind, DeliveryNoteStatus, SalesOrderStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { COMPANY_PROFILE } from "@/lib/constants/company-profile"
import { checkPeriodLock } from "@/lib/period-close/lock"
import { toYmd } from "@/lib/calc/invoice-period"
import {
  deliveryNoteInputSchema,
  deliveryNoteListParamsSchema,
  depositRequestSchema,
  DELIVERY_NOTE_STATUS_UI_VALUES,
  DELIVERY_NOTE_DELIVERED_STATUSES,
  DEPOSIT_PAYMENT_TERM_TYPES,
  SO_ALLOCATABLE_STATUSES,
  type DeliveryNoteListParams,
  type DeliveryNoteInput,
} from "@/lib/validators/delivery-note"
import {
  depositLineName,
  depositSummaryFor,
  loadDepositSummaries,
  sumDeliveryQuantity,
  type DepositSummary,
} from "@/lib/billing/deposits"

/**
 * B-108: サンプル納品書 Server Actions（PO/WO の作法を写経）。
 * 仕様: docs/specs/b-108-sample-delivery-note-spec-confirmation-v1_0-2026-08-05.md
 * - 採番 DLV-{年}-{4桁}（保存時確定・P2002 リトライ）。★findFirst を deletedAt で絞らない（§7）。
 * - 物理削除は作らない。deletedAt 論理削除のみ・DRAFT 以外は不可（§9）。
 * - 宛先はマスターから解決して shipTo* に値コピー（§4-3・発行後にマスターを直しても不変）。
 * - DeliveryNote.productId は入れない（明細側 productId で引く・§3-1）。
 * - B-114 PR-1: 量産行（受注の SKU・skuId / soId / soItemId）をサーバで検証して保存し、
 *   納品完了（DELIVERED / RECEIVED）のとき SoItem / Sku の納品済み数を算出し直す（D-17）。
 *   ブリーフ: docs/specs/b-114-pr1-implementation-brief-2026-09-22.md §2-5 / §2-6
 * - B-109 PR-6（B-123・§3）: 締めた期間（CLIENT × deliveryDate）の作成・編集・状態の変更・削除は
 *   checkPeriodLock（src/lib/period-close/lock.ts）で止める。tx の中で書く action は同じ tx で判定する。
 */
/** B-109 PR-6（B-123）: 締めの判定に落ちたとき tx を中断するための例外（何も書かない・AuditLog も書かない） */
class PeriodLockedError extends Error {}

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
  /** B-109 PR-3（P3-D9）: 前受金の請求行を持つ納品書（前受金の伝票） */
  hasDeposit: boolean
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
          // B-109 PR-3（P3-D9）: 前受金の伝票かどうか（DEPOSIT 行が 1 つでもあれば）
          items: { where: { lineKind: DeliveryLineKind.DEPOSIT }, select: { id: true }, take: 1 },
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
      hasDeposit: r.items.length > 0,
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
    // B-114 §2-3 / §2-7: 量産行の受注番号と受注の単価（編集画面の差分表示・詳細のバッジ用）。
    const soIds = [...new Set(row.items.map((it) => it.soId).filter((v): v is string => !!v))]
    const soItemIds = [...new Set(row.items.map((it) => it.soItemId).filter((v): v is string => !!v))]
    const [sos, soItems] = await Promise.all([
      soIds.length
        ? prisma.salesOrder.findMany({
            where: { id: { in: soIds }, companyId: sess.companyId },
            select: { id: true, soNumber: true },
          })
        : Promise.resolve([]),
      soItemIds.length
        ? prisma.soItem.findMany({
            where: { id: { in: soItemIds }, so: { companyId: sess.companyId } },
            select: { id: true, unitPrice: true },
          })
        : Promise.resolve([]),
    ])
    const soNumberById: Record<string, string> = {}
    for (const so of sos) soNumberById[so.id] = so.soNumber
    const orderUnitPriceBySoItemId: Record<string, number | null> = {}
    for (const it of soItems) orderUnitPriceBySoItemId[it.id] = it.unitPrice != null ? it.unitPrice.toNumber() : null
    return {
      ok: true as const,
      data: { ...row, clientName: client?.companyName ?? null, soNumberById, orderUnitPriceBySoItemId },
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
async function prepareDeliveryNote(
  companyId: string,
  data: DeliveryNoteInput,
  opts: { excludeDeliveryNoteId?: string } = {},
) {
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

  // B-114 §2-5: 量産行（soItemId あり）をサーバで検証（UI 任せにしない）。
  //   受注: companyId 一致・deletedAt null・clientId が納品書の clientId と一致・status が引き当て対象
  //   SKU: SoItem.skuId === 行の skuId・Sku.productId === 行の productId・Sku.companyId 一致
  const massRows = data.items.filter((i) => !!i.soItemId)
  if (massRows.length > 0) {
    const soItemIds = [...new Set(massRows.map((i) => i.soItemId as string))]
    const soItems = await prisma.soItem.findMany({
      where: { id: { in: soItemIds } },
      select: {
        id: true,
        skuId: true,
        so: { select: { id: true, companyId: true, clientId: true, deletedAt: true, status: true } },
      },
    })
    const soItemById = new Map(soItems.map((x) => [x.id, x]))
    const skuIds = [...new Set(soItems.map((x) => x.skuId))]
    const skus = skuIds.length
      ? await prisma.sku.findMany({
          where: { id: { in: skuIds }, companyId, deletedAt: null },
          select: { id: true, productId: true },
        })
      : []
    const skuById = new Map(skus.map((x) => [x.id, x]))
    const MASS_ERROR = "受注の明細と一致しない行があります（品番・SKU・クライアントを確認してください）"
    for (const row of massRows) {
      const si = soItemById.get(row.soItemId as string)
      if (!si) return { ok: false as const, error: MASS_ERROR }
      const so = si.so
      if (
        so.companyId !== companyId ||
        so.deletedAt !== null ||
        so.clientId !== data.clientId ||
        !SO_ALLOCATABLE_STATUSES.includes(so.status) ||
        so.id !== row.soId ||
        si.skuId !== row.skuId
      ) {
        return { ok: false as const, error: MASS_ERROR }
      }
      const sku = skuById.get(si.skuId)
      if (!sku || sku.productId !== row.productId) {
        return { ok: false as const, error: MASS_ERROR }
      }
    }
  }

  // B-109 PR-3（P3-D2〜D4）: 前受金の行（DEPOSIT / DEPOSIT_APPLIED）をサーバで検証。
  //   受注: companyId 一致・deletedAt null・clientId が納品書の clientId と一致・取消でない
  //   充当額の合計は、その受注の未充当額（自分の納品書の行を除いて集計）を超えない
  const depositRows = data.items.filter((i) => !!i.lineKind)
  if (depositRows.length > 0) {
    const depSoIds = [...new Set(depositRows.map((i) => i.soId as string))]
    const sos = await prisma.salesOrder.findMany({
      where: { id: { in: depSoIds }, companyId, deletedAt: null },
      select: { id: true, clientId: true, status: true },
    })
    const soById = new Map(sos.map((x) => [x.id, x]))
    for (const soId of depSoIds) {
      const so = soById.get(soId)
      if (!so || so.clientId !== data.clientId || so.status === SalesOrderStatus.CANCELLED) {
        return { ok: false as const, error: "前受金の行の受注が見つからないか、このクライアントの受注ではありません" }
      }
    }
    const summaries = await loadDepositSummaries(companyId, depSoIds, {
      excludeDeliveryNoteId: opts.excludeDeliveryNoteId,
    })
    for (const soId of depSoIds) {
      const applying = depositRows
        .filter((i) => i.soId === soId && i.lineKind === DeliveryLineKind.DEPOSIT_APPLIED)
        .reduce((a, i) => a + (i.unitPrice ?? 0), 0)
      const remaining = depositSummaryFor(summaries, soId).remaining
      if (applying > remaining) {
        return {
          ok: false as const,
          error: `前受金の充当額（¥${applying.toLocaleString("ja-JP")}）が未充当の前受金（¥${remaining.toLocaleString("ja-JP")}）を超えています`,
        }
      }
    }
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
      // B-114 §2-5: 量産行は受注の SKU を持つ（skuId: null 固定をやめる）。他の行は null のまま。
      skuId: it.skuId ?? null,
      soId: it.soId ?? null,
      soItemId: it.soItemId ?? null,
      // B-109 PR-3（P3-D1）: 前受金の行の印（通常の行は null）。update の deleteMany→createMany でも保たれる（P3-D10）。
      lineKind: it.lineKind ?? null,
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
      // B-108 PR2 §C-3: 引き当て元を透過（加工・補完しない。手入力行は null）。
      // create/update とも p.itemRows を { ...r } で展開するため、ここに含めれば
      // deleteMany→createMany の round-trip で引き当て元が保持される。
      sourceSampleProductionId: it.sourceSampleProductionId,
      sourceWoItemId: it.sourceWoItemId,
      sourceWorkOrderId: it.sourceWorkOrderId,
      sourcePoItemId: it.sourcePoItemId,
      sourcePurchaseOrderId: it.sourcePurchaseOrderId,
    }
  })

  // B-109 PR-3: 前受金・充当の行は枚数ではないので数量合計から除く（billing/deposits の 1 か所）
  const totalQuantity = sumDeliveryQuantity(data.items)

  // B-114 §2-5: ヘッダの受注紐付け。量産行があれば primarySoId＝最初の soId、relatedSoIds＝重複なし配列。無ければ両方 null。
  // B-109 PR-3（P3-D2・D3）: 前受金の行の soId も紐付けに含める（前受金の伝票は受注に紐づく）。
  const relatedSoIds = [
    ...new Set([...massRows, ...depositRows].map((i) => i.soId as string)),
  ]
  const primarySoId = relatedSoIds[0] ?? null

  // B-224（D-40・D-45）: 納品書は小計（税抜）まで。消費税と税込合計は計算も保存もしない。
  // 税を語るのは合計請求書だけ（請求書1枚につき税率ごとに1回・D-22）。
  // ★taxAmount / totalAmount は null を明示して渡す（update で旧値が残らないように）。既存行の値は消さない（D-46）。
  let subtotalAmount: Prisma.Decimal | null = null
  const taxAmount: Prisma.Decimal | null = null
  const totalAmount: Prisma.Decimal | null = null
  if (data.showAmounts) {
    if (data.items.some((it) => it.unitPrice == null)) {
      warnings.push("単価未入力の明細があります（金額表示ONのまま保存しました）")
    }
    const sub = data.items.reduce(
      (a, it) => a + (it.unitPrice != null ? it.quantity * it.unitPrice : 0),
      0,
    )
    subtotalAmount = new Prisma.Decimal(Math.round(sub))
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
      primarySoId,
      relatedSoIds,
      itemRows,
      warnings,
    },
  }
}

// =============================================================================
// B-114 PR-1 §2-6（D-17）: 納品済み数の算出し直し
// - 各 soItemId: 納品書明細の数量合計（納品書 companyId・deletedAt null・DELIVERED / RECEIVED）
//   → SoItem.deliveredQuantity、remainingQuantity = max(ordered − delivered, 0)
// - 各 skuId: 同じ条件で数量合計 → Sku.deliveredQuantity
// - 加減算ではなく毎回算出し直す（戻した・取消した時も同じ関数で正しくなる）
// =============================================================================
/** 拡張クライアント（src/lib/prisma.ts）の $transaction が渡す tx の型。Prisma.TransactionClient とは合わない */
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function recomputeDeliveredQuantities(
  tx: TxClient,
  companyId: string,
  target: { soItemIds: string[]; skuIds: string[] },
): Promise<void> {
  const dnWhere = {
    companyId,
    deletedAt: null,
    status: { in: DELIVERY_NOTE_DELIVERED_STATUSES },
  }
  for (const soItemId of [...new Set(target.soItemIds)]) {
    const agg = await tx.deliveryNoteItem.aggregate({
      _sum: { quantity: true },
      where: { soItemId, deliveryNote: dnWhere },
    })
    const delivered = agg._sum.quantity ?? 0
    const si = await tx.soItem.findFirst({
      where: { id: soItemId, so: { companyId } },
      select: { id: true, orderedQuantity: true },
    })
    if (!si) continue
    await tx.soItem.update({
      where: { id: si.id },
      data: {
        deliveredQuantity: delivered,
        remainingQuantity: Math.max(si.orderedQuantity - delivered, 0),
      },
    })
  }
  for (const skuId of [...new Set(target.skuIds)]) {
    const agg = await tx.deliveryNoteItem.aggregate({
      _sum: { quantity: true },
      where: { skuId, deliveryNote: dnWhere },
    })
    const sku = await tx.sku.findFirst({ where: { id: skuId, companyId }, select: { id: true } })
    if (!sku) continue
    await tx.sku.update({
      where: { id: sku.id },
      data: { deliveredQuantity: agg._sum.quantity ?? 0 },
    })
  }
}

// =============================================================================
// 新規（採番 + DeliveryNote + DeliveryNoteItem 群を同一 tx・P2002 リトライ）
// =============================================================================
const CREATE_MAX_RETRIES = 3

type Prepared = Extract<Awaited<ReturnType<typeof prepareDeliveryNote>>, { ok: true }>["prepared"]

/**
 * 採番＋ヘッダ＋明細の作成（同一 tx・P2002 リトライ）。createDeliveryNote と、
 * B-109 PR-3 の前受金の伝票（createDepositRequest・DELIVERED で作る）で共用する。
 * ★ヘッダの列の埋め方はここ 1 か所（新しい作り方を作らない・P3-D6）。
 */
async function insertDeliveryNote(
  companyId: string,
  userId: string,
  p: Prepared,
  status: DeliveryNoteStatus,
): Promise<
  | { ok: true; created: { id: string; deliveryNumber: string } }
  | { ok: false; error: string }
> {
  const prefix = deliveryNumberPrefix(new Date().getFullYear())
  const deliveryYmd = toYmd(p.deliveryDate)
  let created: { id: string; deliveryNumber: string } | null = null
  let lastError: unknown = null

  for (let attempt = 0; attempt < CREATE_MAX_RETRIES; attempt++) {
    try {
      created = await prisma.$transaction(
        async (tx) => {
          // B-109 PR-6（§3）: 締めた期間の日付の納品書は作らない（同じ tx で判定）
          const lock = await checkPeriodLock(tx, companyId, CounterpartType.CLIENT, p.clientId, deliveryYmd)
          if (lock.locked) throw new PeriodLockedError(lock.error)
          const deliveryNumber = await computeNextDeliveryNumber(tx.deliveryNote, companyId, prefix)
          const dn = await tx.deliveryNote.create({
            data: {
              companyId,
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
              status,
              createdByUserId: userId,
              internalNotes: p.internalNotes,
              clientNotes: p.clientNotes,
              // B-114 §2-5: 受注の紐付け（量産行が無ければ null）
              primarySoId: p.primarySoId,
              relatedSoIds: p.relatedSoIds.length > 0 ? p.relatedSoIds : Prisma.DbNull,
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
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        continue // deliveryNumber unique 衝突：再試行
      }
      if (e instanceof PeriodLockedError) return { ok: false, error: e.message }
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
  return { ok: true, created }
}

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

    const inserted = await insertDeliveryNote(sess.companyId, sess.userId, p, DeliveryNoteStatus.DRAFT)
    if (!inserted.ok) return inserted
    const created = inserted.created

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
      select: { id: true, status: true, deliveryNumber: true, clientId: true, deliveryDate: true },
    })
    if (!existing) return { ok: false, error: "納品書が見つかりません" }
    // DRAFT のみ編集可（§9 の削除・§4-3「発行後は不変」と同じ線）。
    if (existing.status !== DeliveryNoteStatus.DRAFT) {
      return { ok: false, error: "ドラフト以外の納品書は編集できません" }
    }
    // B-109 PR-3（P3-D10）: 前受金の伝票（DEPOSIT 行を持つ）はフォームで編集させない（取消して作り直す）。
    const depositLine = await prisma.deliveryNoteItem.findFirst({
      where: { deliveryNoteId: id, lineKind: DeliveryLineKind.DEPOSIT },
      select: { id: true },
    })
    if (depositLine) {
      return { ok: false, error: "前受金の伝票は編集できません（取消して作り直してください）" }
    }

    // 充当額の上限は、この納品書の行を除いて集計する（P3-D4）
    const prep = await prepareDeliveryNote(sess.companyId, data, { excludeDeliveryNoteId: id })
    if (!prep.ok) return prep
    const p = prep.prepared

    await prisma.$transaction(
      async (tx) => {
        // B-109 PR-6（§3）: 変更前と変更後の両方を判定（締めた月へ移すのも、締めた月から出すのも止める）
        const before = await checkPeriodLock(
          tx, sess.companyId, CounterpartType.CLIENT, existing.clientId, toYmd(existing.deliveryDate),
        )
        if (before.locked) throw new PeriodLockedError(before.error)
        const after = await checkPeriodLock(tx, sess.companyId, CounterpartType.CLIENT, p.clientId, toYmd(p.deliveryDate))
        if (after.locked) throw new PeriodLockedError(after.error)
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
            // B-114 §2-5: 受注の紐付け（量産行が無ければ null）
            primarySoId: p.primarySoId,
            relatedSoIds: p.relatedSoIds.length > 0 ? p.relatedSoIds : Prisma.DbNull,
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
      select: {
        id: true,
        status: true,
        clientId: true,
        deliveryDate: true,
        items: { select: { soItemId: true, skuId: true } },
      },
    })
    if (!existing) return { ok: false, error: "納品書が見つかりません" }
    if (existing.status === status) return { ok: true, data: { id } }

    // B-114 §2-6: 状態更新・AuditLog・納品済み数の算出し直しを1つのトランザクションで行う。
    const soItemIds = existing.items.map((it) => it.soItemId).filter((v): v is string => !!v)
    const skuIds = existing.items.map((it) => it.skuId).filter((v): v is string => !!v)
    await prisma.$transaction(
      async (tx) => {
        // B-109 PR-6（§3）: 締めた期間の納品書は状態を変えない（すべての変更・同じ tx で判定）
        const lock = await checkPeriodLock(
          tx, sess.companyId, CounterpartType.CLIENT, existing.clientId, toYmd(existing.deliveryDate),
        )
        if (lock.locked) throw new PeriodLockedError(lock.error)
        await tx.deliveryNote.update({ where: { id }, data: { status } })
        await tx.auditLog.create({
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
        if (soItemIds.length > 0 || skuIds.length > 0) {
          await recomputeDeliveredQuantities(tx, sess.companyId, { soItemIds, skuIds })
        }
      },
      { timeout: 15000 },
    )

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
      select: { id: true, status: true, clientId: true, deliveryDate: true },
    })
    if (!existing) return { ok: false, error: "納品書が見つかりません" }
    // §9: DRAFT 以外の論理削除は不可（発行後は CANCELLED で一覧に残す）。
    if (existing.status !== DeliveryNoteStatus.DRAFT) {
      return {
        ok: false,
        error: "ドラフト以外は削除できません（発行後はキャンセルで残します）",
      }
    }
    // B-109 PR-6（§3）: 締めた期間の納品書は削除しない
    const lock = await checkPeriodLock(
      prisma, sess.companyId, CounterpartType.CLIENT, existing.clientId, toYmd(existing.deliveryDate),
    )
    if (lock.locked) return { ok: false, error: lock.error }

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

// =============================================================================
// B-109 PR-3: 前受金（受注から請求・納品書での充当の提案・受注画面の節）
// =============================================================================

/** 受注の最初の明細の品番（前受金の行は productId が必須のため・P3-D2）。 */
async function firstProductOfSalesOrder(
  companyId: string,
  soId: string,
): Promise<{ id: string; productName: string } | null> {
  const item = await prisma.soItem.findFirst({
    where: { soId, so: { companyId } },
    orderBy: { createdAt: "asc" },
    select: { skuId: true },
  })
  if (!item) return null
  const sku = await prisma.sku.findFirst({
    where: { id: item.skuId, companyId },
    select: { productId: true },
  })
  if (!sku) return null
  return prisma.product.findFirst({
    where: { id: sku.productId, companyId, deletedAt: null },
    select: { id: true, productName: true },
  })
}

/**
 * P3-D6: 受注から「前受金を請求」。P3-D2 の行 1 つを持つ納品書を DELIVERED で 1 枚作る。
 * ヘッダの埋め方は既存の作成処理（prepareDeliveryNote → insertDeliveryNote）と同じ。
 */
export async function createDepositRequest(
  input: unknown,
): Promise<ActionResult<{ id: string; deliveryNumber: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = depositRequestSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const so = await prisma.salesOrder.findFirst({
      where: { id: data.soId, companyId: sess.companyId, deletedAt: null },
      select: { id: true, soNumber: true, clientId: true, status: true },
    })
    if (!so) return { ok: false, error: "受注が見つかりません" }
    if (so.status === SalesOrderStatus.CANCELLED) {
      return { ok: false, error: "取消した受注には前受金を請求できません" }
    }
    const client = await prisma.client.findFirst({
      where: { id: so.clientId, companyId: sess.companyId, deletedAt: null },
      select: { id: true, paymentTermType: true },
    })
    if (!client) return { ok: false, error: "クライアントが見つかりません" }
    if (!(DEPOSIT_PAYMENT_TERM_TYPES as readonly string[]).includes(client.paymentTermType)) {
      return { ok: false, error: "このクライアントの取引条件では前受金を請求できません（デポジット＋COD か 前払い のときだけ）" }
    }
    const product = await firstProductOfSalesOrder(sess.companyId, so.id)
    if (!product) return { ok: false, error: "受注に明細が無いため前受金の行を作れません" }

    // P3-D2: 前受金の行 1 つ（soItemId / skuId は null・数量 1・単位「式」）
    const noteInput: DeliveryNoteInput = deliveryNoteInputSchema.parse({
      clientId: so.clientId,
      buyerId: null,
      deliveryDestinationId: null,
      deliveryDate: data.deliveryDate,
      currency: "JPY",
      showAmounts: true,
      shipToAddress: null,
      shipToContact: null,
      shipToPhone: null,
      internalNotes: null,
      clientNotes: null,
      items: [
        {
          productId: product.id,
          productName: depositLineName(DeliveryLineKind.DEPOSIT, so.soNumber),
          clientProductCode: null,
          colorCode: null,
          colorName: null,
          size: null,
          quantity: 1,
          unit: "式",
          unitPrice: data.amount,
          sourceSampleProductionId: null,
          sourceWoItemId: null,
          sourceWorkOrderId: null,
          sourcePoItemId: null,
          sourcePurchaseOrderId: null,
          skuId: null,
          soId: so.id,
          soItemId: null,
          lineKind: DeliveryLineKind.DEPOSIT,
        },
      ],
    })
    const prep = await prepareDeliveryNote(sess.companyId, noteInput)
    if (!prep.ok) return prep
    const inserted = await insertDeliveryNote(sess.companyId, sess.userId, prep.prepared, DeliveryNoteStatus.DELIVERED)
    if (!inserted.ok) return inserted
    const created = inserted.created

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "CREATE",
        entityType: "DeliveryNote",
        entityId: created.id,
        afterData: {
          deliveryNumber: created.deliveryNumber,
          kind: "DEPOSIT",
          soId: so.id,
          soNumber: so.soNumber,
          amount: data.amount,
          deliveryDate: data.deliveryDate,
        },
        description: `前受金の請求: ${so.soNumber} ¥${data.amount.toLocaleString("ja-JP")}（${created.deliveryNumber}）`,
      },
    })

    revalidatePath("/deliveries")
    revalidatePath(`/sales-orders/${so.id}`)
    revalidatePath("/invoices")
    return { ok: true, data: created }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "前受金の請求に失敗しました" }
  }
}

export type DepositSuggestion = {
  soId: string
  soNumber: string
  /** 未充当の前受金（この納品書の行を除いて集計） */
  remaining: number
  /** 充当行に入れる品番（受注の最初の明細の品番） */
  productId: string
  productName: string
}

/**
 * P3-D7: 納品書の作成・編集で、明細にある受注に未充当の前受金が残っていれば提案に使う。
 * excludeDeliveryNoteId は編集中の納品書（自分の行を集計から除く）。
 */
export async function getDepositSuggestions(
  soIds: string[],
  excludeDeliveryNoteId?: string,
): Promise<ActionResult<DepositSuggestion[]>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const ids = [...new Set(soIds.filter((v): v is string => !!v))]
    if (ids.length === 0) return { ok: true, data: [] }
    const sos = await prisma.salesOrder.findMany({
      where: { id: { in: ids }, companyId: sess.companyId, deletedAt: null },
      select: { id: true, soNumber: true },
    })
    const summaries = await loadDepositSummaries(sess.companyId, ids, { excludeDeliveryNoteId })
    const out: DepositSuggestion[] = []
    for (const so of sos) {
      const sum = depositSummaryFor(summaries, so.id)
      if (sum.remaining <= 0) continue
      const product = await firstProductOfSalesOrder(sess.companyId, so.id)
      if (!product) continue
      out.push({
        soId: so.id,
        soNumber: so.soNumber,
        remaining: sum.remaining,
        productId: product.id,
        productName: depositLineName(DeliveryLineKind.DEPOSIT_APPLIED, so.soNumber),
      })
    }
    return { ok: true, data: out }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "前受金の取得に失敗しました" }
  }
}

export type SalesOrderDepositSection = {
  summary: DepositSummary
  /** 前受金の伝票（DEPOSIT 行を持つ納品書）と充当の行を持つ納品書 */
  notes: {
    id: string
    deliveryNumber: string
    status: DeliveryNoteStatus
    /** yyyy-MM-dd */
    deliveryDate: string
    kind: "DEPOSIT" | "DEPOSIT_APPLIED"
    amount: number
  }[]
}

/** P3-D6: 受注の画面の「前受金」の節（請求済み／充当済み／残り と伝票へのリンク）。 */
export async function getSalesOrderDepositSection(
  soId: string,
): Promise<ActionResult<SalesOrderDepositSection>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const summaries = await loadDepositSummaries(sess.companyId, [soId])
    const rows = await prisma.deliveryNoteItem.findMany({
      where: {
        soId,
        lineKind: { not: null },
        deliveryNote: { companyId: sess.companyId, deletedAt: null, status: { not: DeliveryNoteStatus.CANCELLED } },
      },
      select: {
        lineKind: true,
        quantity: true,
        unitPrice: true,
        deliveryNote: { select: { id: true, deliveryNumber: true, status: true, deliveryDate: true } },
      },
      orderBy: [{ deliveryNote: { deliveryDate: "asc" } }, { itemOrder: "asc" }],
    })
    return {
      ok: true,
      data: {
        summary: depositSummaryFor(summaries, soId),
        notes: rows.map((r) => ({
          id: r.deliveryNote.id,
          deliveryNumber: r.deliveryNote.deliveryNumber,
          status: r.deliveryNote.status,
          deliveryDate: r.deliveryNote.deliveryDate.toISOString().slice(0, 10),
          kind: r.lineKind as "DEPOSIT" | "DEPOSIT_APPLIED",
          amount: Math.abs(Math.floor(r.quantity * (r.unitPrice != null ? r.unitPrice.toNumber() : 0))),
        })),
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "前受金の取得に失敗しました" }
  }
}
