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

/**
 * 品番カルテ「発注（PO/WO）」セクション用の read アクション（B / Part 6）。
 * 品番直結（PurchaseOrder.primaryProductId / WorkOrder.productId）の発注を新しい順で返す。
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

export async function getProductOrders(
  productId: string,
): Promise<ProductOrderRow[]> {
  const sess = await requireSession()
  if (!sess.ok) return []

  const [pos, wos] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: {
        companyId: sess.companyId,
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
        companyId: sess.companyId,
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
  const factoryIds = [
    ...new Set(wos.map((w) => w.factoryId).filter((v): v is string => !!v)),
  ]
  const contractorIds = [
    ...new Set(wos.map((w) => w.contractorId).filter((v): v is string => !!v)),
  ]
  const [suppliers, factories, contractors] = await Promise.all([
    supplierIds.length
      ? prisma.supplier.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true, companyName: true },
        })
      : Promise.resolve([]),
    factoryIds.length
      ? prisma.factory.findMany({
          where: { id: { in: factoryIds } },
          select: { id: true, factoryName: true },
        })
      : Promise.resolve([]),
    contractorIds.length
      ? prisma.contractor.findMany({
          where: { id: { in: contractorIds } },
          select: { id: true, contractorName: true },
        })
      : Promise.resolve([]),
  ])
  const supplierName = new Map(suppliers.map((s) => [s.id, s.companyName]))
  const factoryName = new Map(factories.map((f) => [f.id, f.factoryName]))
  const contractorName = new Map(
    contractors.map((c) => [c.id, c.contractorName]),
  )

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
      counterpartyName: w.factoryId
        ? factoryName.get(w.factoryId) ?? "—"
        : w.contractorId
          ? contractorName.get(w.contractorId) ?? "—"
          : "—",
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
