"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * B-095: グローバル検索（1窓統合・カテゴリ別）。
 *
 * - companyId スコープ・deletedAt null・各カテゴリ上限 5 件・Promise.all 並列。
 * - ILIKE 部分一致（contains + insensitive）。
 * - 伝票番号プレフィックス（PO-/WO-/PE-/RE-/SP-）検出時は該当カテゴリを結果先頭に。
 * - 2 文字未満は空を返す（1 文字入力で全件走査を避ける）。
 */

const LIMIT = 5

export type GlobalSearchCategory =
  | "product"
  | "estimate"
  | "order"
  | "sample"
  | "master"

export type GlobalSearchItem = {
  category: GlobalSearchCategory
  id: string
  title: string
  subtitle: string
  url: string
}

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const })

/** 番号プレフィックスから優先カテゴリを検出（大文字小文字無視）。 */
function detectPriority(upper: string): GlobalSearchCategory | null {
  if (upper.startsWith("PO-") || upper.startsWith("WO-")) return "order"
  if (upper.startsWith("PE-") || upper.startsWith("RE-")) return "estimate"
  if (upper.startsWith("SP-")) return "sample"
  return null
}

export async function globalSearch(query: string): Promise<GlobalSearchItem[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const session = await auth()
  if (!session?.user) return []
  const companyId = session.user.companyId
  const c = contains(q)
  const upper = q.toUpperCase()

  // 発注の「相手先名」検索用: マスターを名称/コードで引いて id 集合を得る。
  const [supMatches, facMatches, conMatches] = await Promise.all([
    prisma.supplier.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ companyName: c }, { supplierCode: c }],
      },
      select: { id: true, companyName: true },
      take: 20,
    }),
    prisma.factory.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ factoryName: c }, { factoryCode: c }],
      },
      select: { id: true, factoryName: true },
      take: 20,
    }),
    prisma.contractor.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ contractorName: c }, { contractorCode: c }],
      },
      select: { id: true, contractorName: true },
      take: 20,
    }),
  ])
  const supIds = supMatches.map((s) => s.id)
  const facIds = facMatches.map((f) => f.id)
  const conIds = conMatches.map((c2) => c2.id)

  const [
    products,
    roughs,
    pes,
    pos,
    wos,
    samples,
    brands,
    clients,
    materials,
  ] = await Promise.all([
    // ①品番
    prisma.product.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          { productCode: c },
          { productName: c },
          { clientProductCode: c },
          { productNameEn: c },
        ],
      },
      select: { id: true, productCode: true, productName: true, clientProductCode: true },
      take: LIMIT,
    }),
    // ②見積（概算 RoughEstimate）
    prisma.roughEstimate.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ estimateNumber: c }, { title: c }],
      },
      select: { id: true, estimateNumber: true, title: true, productId: true },
      take: LIMIT,
      orderBy: { estimateNumber: "desc" },
    }),
    // ②見積（量産 ProductionEstimate）
    prisma.productionEstimate.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ estimateNumber: c }, { title: c }],
      },
      select: { id: true, estimateNumber: true, title: true },
      take: LIMIT,
      orderBy: { estimateNumber: "desc" },
    }),
    // ③発注（PO・番号/タイトル/相手先名）
    prisma.purchaseOrder.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          { poNumber: c },
          { title: c },
          ...(supIds.length ? [{ supplierId: { in: supIds } }] : []),
        ],
      },
      select: { id: true, poNumber: true, title: true, supplierId: true },
      take: LIMIT,
      orderBy: { poNumber: "desc" },
    }),
    // ③発注（WO・番号/タイトル/相手先名）
    prisma.workOrder.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          { woNumber: c },
          { title: c },
          ...(facIds.length ? [{ factoryId: { in: facIds } }] : []),
          ...(conIds.length ? [{ contractorId: { in: conIds } }] : []),
        ],
      },
      select: {
        id: true,
        woNumber: true,
        title: true,
        factoryId: true,
        contractorId: true,
      },
      take: LIMIT,
      orderBy: { woNumber: "desc" },
    }),
    // ④サンプル
    prisma.sampleProduction.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ sampleNumber: c }, { title: c }],
      },
      select: { id: true, sampleNumber: true, title: true },
      take: LIMIT,
      orderBy: { sampleNumber: "desc" },
    }),
    // ⑤マスター（Brand）
    prisma.brand.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ brandName: c }, { brandCode: c }],
      },
      select: { id: true, brandName: true, brandCode: true },
      take: LIMIT,
    }),
    // ⑤マスター（Client）
    prisma.client.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ companyName: c }, { clientCode: c }],
      },
      select: { id: true, companyName: true, clientCode: true },
      take: LIMIT,
    }),
    // ⑤マスター（Material）
    prisma.material.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ materialName: c }, { materialCode: c }],
      },
      select: { id: true, materialName: true, materialCode: true },
      take: LIMIT,
    }),
  ])

  const supName = new Map(supMatches.map((s) => [s.id, s.companyName]))
  const facName = new Map(facMatches.map((f) => [f.id, f.factoryName]))
  const conName = new Map(conMatches.map((c2) => [c2.id, c2.contractorName]))
  // PO/WO 表示用に、相手先名を未取得（title/番号一致のみでヒットした行）の分も解決する。
  const missingSup = [
    ...new Set(pos.map((p) => p.supplierId).filter((id) => !supName.has(id))),
  ]
  const missingFac = [
    ...new Set(
      wos.map((w) => w.factoryId).filter((id): id is string => !!id && !facName.has(id)),
    ),
  ]
  const missingCon = [
    ...new Set(
      wos.map((w) => w.contractorId).filter((id): id is string => !!id && !conName.has(id)),
    ),
  ]
  const [supExtra, facExtra, conExtra] = await Promise.all([
    missingSup.length
      ? prisma.supplier.findMany({ where: { id: { in: missingSup } }, select: { id: true, companyName: true } })
      : Promise.resolve([]),
    missingFac.length
      ? prisma.factory.findMany({ where: { id: { in: missingFac } }, select: { id: true, factoryName: true } })
      : Promise.resolve([]),
    missingCon.length
      ? prisma.contractor.findMany({ where: { id: { in: missingCon } }, select: { id: true, contractorName: true } })
      : Promise.resolve([]),
  ])
  for (const s of supExtra) supName.set(s.id, s.companyName)
  for (const f of facExtra) facName.set(f.id, f.factoryName)
  for (const c2 of conExtra) conName.set(c2.id, c2.contractorName)

  // カテゴリ別に DTO 化。
  const byCategory: Record<GlobalSearchCategory, GlobalSearchItem[]> = {
    product: products.map((p) => ({
      category: "product" as const,
      id: p.id,
      title: p.productName,
      subtitle: [p.productCode, p.clientProductCode].filter(Boolean).join(" / "),
      url: `/products/${p.id}`,
    })),
    estimate: [
      ...roughs.map((r) => ({
        category: "estimate" as const,
        id: r.id,
        title: r.estimateNumber,
        subtitle: ["概算見積", r.title].filter(Boolean).join("・"),
        url: `/products/${r.productId}`,
      })),
      ...pes.map((p) => ({
        category: "estimate" as const,
        id: p.id,
        title: p.estimateNumber,
        subtitle: ["量産見積", p.title].filter(Boolean).join("・"),
        url: `/production-estimates/${p.id}`,
      })),
    ].slice(0, LIMIT),
    order: [
      ...pos.map((p) => ({
        category: "order" as const,
        id: p.id,
        title: p.poNumber,
        subtitle: ["発注PO", supName.get(p.supplierId), p.title].filter(Boolean).join("・"),
        url: `/purchase-orders/${p.id}`,
      })),
      ...wos.map((w) => ({
        category: "order" as const,
        id: w.id,
        title: w.woNumber,
        subtitle: [
          "作業WO",
          w.factoryId ? facName.get(w.factoryId) : w.contractorId ? conName.get(w.contractorId) : null,
          w.title,
        ]
          .filter(Boolean)
          .join("・"),
        url: `/work-orders/${w.id}`,
      })),
    ].slice(0, LIMIT),
    sample: samples.map((s) => ({
      category: "sample" as const,
      id: s.id,
      title: s.sampleNumber,
      subtitle: ["サンプル", s.title].filter(Boolean).join("・"),
      url: `/samples/${s.id}`,
    })),
    master: [
      ...brands.map((b) => ({
        category: "master" as const,
        id: b.id,
        title: b.brandName,
        subtitle: `ブランド・${b.brandCode}`,
        url: `/brands/${b.id}`,
      })),
      ...clients.map((cl) => ({
        category: "master" as const,
        id: cl.id,
        title: cl.companyName,
        subtitle: `取引先・${cl.clientCode}`,
        url: `/clients/${cl.id}`,
      })),
      ...materials.map((m) => ({
        category: "master" as const,
        id: m.id,
        title: m.materialName,
        subtitle: `資材・${m.materialCode}`,
        url: `/materials/${m.id}`,
      })),
    ].slice(0, LIMIT),
  }

  // 表示順（既定）。プレフィックス検出時は該当カテゴリを先頭へ。
  const order: GlobalSearchCategory[] = [
    "product",
    "estimate",
    "order",
    "sample",
    "master",
  ]
  const priority = detectPriority(upper)
  const ordered = priority
    ? [priority, ...order.filter((cat) => cat !== priority)]
    : order

  return ordered.flatMap((cat) => byCategory[cat])
}
