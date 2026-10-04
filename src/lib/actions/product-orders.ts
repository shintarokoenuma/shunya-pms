"use server"

import {
  PurchaseOrderStatus,
  WorkOrderStatus,
  WorkOrderCategory,
  WorkOrderType,
  Currency,
  Prisma,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { checkArea } from "@/lib/area-access"

/**
 * 品番カルテ「発注（PO/WO）」セクション用の read アクション（B / Part 6）。
 * 品番直結（PurchaseOrder.primaryProductId / WorkOrder.productId）の発注を新しい順で返す。
 * B-243 PR-1（§2-5・C-D6）:
 * - getProductOrders は発注が見えない役割には []（金額を含む）
 * - getProductWoSummaries は発注の判定をしない。WO の行だけ・金額（subtotalJpy・currency）を含まない読み取りで、
 *   品番・分類の「工場」と縫製仕様書の宛先候補に使う（縫製仕様書は今まで通り出す・10:04）
 */

async function requireSession() {
  const session = await auth()
  if (!session?.user) return { ok: false as const, error: "認証されていません" }
  return { ok: true as const, companyId: session.user.companyId }
}

function dnum(v: Prisma.Decimal | null): number | null {
  return v != null ? Number(v) : null
}

export type ProductOrderRow = {
  kind: "PO" | "WO"
  id: string
  number: string
  status: PurchaseOrderStatus | WorkOrderStatus
  title: string | null
  counterpartyName: string
  subtotalJpy: number | null
  currency: Currency
  workCategory: WorkOrderCategory | null
  /** B-054 PR-4c: 縫製仕様書の宛先の絞り込みに使う（PO の行は null） */
  workType: WorkOrderType | null
  /** B-054 PR-4c: 区分の札「サンプル 2nd」用（PO の行は null） */
  sampleRound: string | null
  createdAt: string
}

/** B-243 PR-1: 金額を含まない WO の要約（工場の導出・縫製仕様書の宛先候補用） */
export type ProductWoSummary = {
  id: string
  number: string
  status: WorkOrderStatus
  counterpartyName: string
  workCategory: WorkOrderCategory
  workType: WorkOrderType | null
  sampleRound: string | null
  createdAt: string
}

async function resolveWoCounterpartyNames(
  wos: { factoryId: string | null; contractorId: string | null }[],
): Promise<{ factoryName: Map<string, string>; contractorName: Map<string, string> }> {
  const factoryIds = [...new Set(wos.map((w) => w.factoryId).filter((v): v is string => !!v))]
  const contractorIds = [...new Set(wos.map((w) => w.contractorId).filter((v): v is string => !!v))]
  const [factories, contractors] = await Promise.all([
    factoryIds.length
      ? prisma.factory.findMany({ where: { id: { in: factoryIds } }, select: { id: true, factoryName: true } })
      : Promise.resolve([]),
    contractorIds.length
      ? prisma.contractor.findMany({ where: { id: { in: contractorIds } }, select: { id: true, contractorName: true } })
      : Promise.resolve([]),
  ])
  return {
    factoryName: new Map(factories.map((f) => [f.id, f.factoryName])),
    contractorName: new Map(contractors.map((c) => [c.id, c.contractorName])),
  }
}

function woCounterpartyName(
  w: { factoryId: string | null; contractorId: string | null },
  names: { factoryName: Map<string, string>; contractorName: Map<string, string> },
): string {
  return w.factoryId
    ? names.factoryName.get(w.factoryId) ?? "—"
    : w.contractorId
      ? names.contractorName.get(w.contractorId) ?? "—"
      : "—"
}

/** 本体（export しない）。金額を含む PO / WO の行を新しい順で返す */
async function loadProductOrderRows(companyId: string, productId: string): Promise<ProductOrderRow[]> {
  const [pos, wos] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: {
        companyId,
        primaryProductId: productId,
        deletedAt: null,
      },
      select: {
        id: true,
        poNumber: true,
        status: true,
        title: true,
        supplierId: true,
        subtotal: true,
        currency: true,
        createdAt: true,
      },
    }),
    prisma.workOrder.findMany({
      where: {
        companyId,
        productId,
        deletedAt: null,
      },
      select: {
        id: true,
        woNumber: true,
        status: true,
        title: true,
        factoryId: true,
        contractorId: true,
        workCategory: true,
        workType: true,
        sampleRound: true,
        subtotal: true,
        currency: true,
        createdAt: true,
      },
    }),
  ])

  // 相手先名の一括解決。
  const supplierIds = [...new Set(pos.map((p) => p.supplierId))]
  const [suppliers, names] = await Promise.all([
    supplierIds.length
      ? prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, companyName: true } })
      : Promise.resolve([]),
    resolveWoCounterpartyNames(wos),
  ])
  const supplierName = new Map(suppliers.map((s) => [s.id, s.companyName]))

  const rows: ProductOrderRow[] = [
    ...pos.map((p) => ({
      kind: "PO" as const,
      id: p.id,
      number: p.poNumber,
      status: p.status,
      title: p.title,
      counterpartyName: supplierName.get(p.supplierId) ?? "—",
      subtotalJpy: dnum(p.subtotal),
      currency: p.currency,
      workCategory: null,
      workType: null,
      sampleRound: null,
      createdAt: p.createdAt.toISOString(),
    })),
    ...wos.map((w) => ({
      kind: "WO" as const,
      id: w.id,
      number: w.woNumber,
      status: w.status,
      title: w.title,
      counterpartyName: woCounterpartyName(w, names),
      subtotalJpy: dnum(w.subtotal),
      currency: w.currency,
      workCategory: w.workCategory,
      workType: w.workType,
      sampleRound: w.sampleRound,
      createdAt: w.createdAt.toISOString(),
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) // 新しい順

  return rows
}

export async function getProductOrders(productId: string): Promise<ProductOrderRow[]> {
  const sess = await requireSession()
  if (!sess.ok) return []
  // B-243 PR-1: 発注が見えない役割には金額を含む行を返さない
  const area = await checkArea("orders")
  if (!area.ok) return []
  return loadProductOrderRows(sess.companyId, productId)
}

export async function getProductWoSummaries(productId: string): Promise<ProductWoSummary[]> {
  const sess = await requireSession()
  if (!sess.ok) return []
  // 発注の判定はしない（C-D6）。金額の列は select しない
  const wos = await prisma.workOrder.findMany({
    where: {
      companyId: sess.companyId,
      productId,
      deletedAt: null,
    },
    select: {
      id: true,
      woNumber: true,
      status: true,
      factoryId: true,
      contractorId: true,
      workCategory: true,
      workType: true,
      sampleRound: true,
      createdAt: true,
    },
  })
  const names = await resolveWoCounterpartyNames(wos)
  return wos
    .map((w) => ({
      id: w.id,
      number: w.woNumber,
      status: w.status,
      counterpartyName: woCounterpartyName(w, names),
      workCategory: w.workCategory,
      workType: w.workType,
      sampleRound: w.sampleRound,
      createdAt: w.createdAt.toISOString(),
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}
