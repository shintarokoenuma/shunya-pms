import { prisma } from "@/lib/prisma"

/**
 * B-136: 見積明細の「由来の相手先」解決。
 *
 * 確定サンプル/過去実績から単価をコピーした明細（source*ItemId を持つ行）について、
 * その実績がどの相手先のものかを一括解決する。工賃（WoItem→WorkOrder）と
 * 材料（PoItem→PurchaseOrder）の2経路を、行配列をまとめて受け取り N+1 なしで解く。
 *
 * ★テナント境界: PurchaseOrder / WorkOrder は companyId 列を持つ（非 TENANT_MODEL）ため
 *   明示的に companyId でスコープする。Factory / Contractor / Supplier は TENANT_MODELS の
 *   ため prisma 拡張が companyId / deletedAt を自動付与する（tenant-models.ts）。
 *
 * ★best-effort: source*ItemId は scalar FK（@relation なし）で親編集により dead 参照が
 *   実在しうる（schema コメント参照）。辿れない場合は例外を投げず null を返す。
 *   ＝MANUAL 行 / dead 参照 / 相手先未設定 / マスター消滅 はすべて null。
 */

export type SourceCounterpartyKind = "FACTORY" | "CONTRACTOR" | "SUPPLIER"
export type SourceCounterparty = { name: string; kind: SourceCounterpartyKind }

export type SourceRef = {
  id: string
  sourcePoItemId: string | null
  sourceWoItemId: string | null
}

const uniq = (xs: Array<string | null>): string[] =>
  Array.from(new Set(xs.filter((x): x is string => x !== null && x !== "")))

/**
 * 明細行の配列を受け取り、`行 id → 相手先 | null` の Map を返す。
 * WoItem 経路（工賃）を優先し、無ければ PoItem 経路（材料）で解決する。
 */
export async function resolveSourceCounterparties(
  companyId: string,
  items: SourceRef[],
): Promise<Map<string, SourceCounterparty | null>> {
  const result = new Map<string, SourceCounterparty | null>()
  for (const it of items) result.set(it.id, null)

  const poItemIds = uniq(items.map((i) => i.sourcePoItemId))
  const woItemIds = uniq(items.map((i) => i.sourceWoItemId))

  // --- 材料経路: PoItem → PurchaseOrder.supplierId → Supplier.companyName ---
  const poItemToName = new Map<string, string>()
  if (poItemIds.length > 0) {
    const poItems = await prisma.poItem.findMany({
      where: { id: { in: poItemIds } },
      select: { id: true, poId: true },
    })
    const pos = await prisma.purchaseOrder.findMany({
      where: { id: { in: uniq(poItems.map((p) => p.poId)) }, companyId },
      select: { id: true, supplierId: true },
    })
    const poIdToSupplierId = new Map(pos.map((p) => [p.id, p.supplierId]))
    const suppliers = pos.length
      ? await prisma.supplier.findMany({
          where: { id: { in: uniq(pos.map((p) => p.supplierId)) } },
          select: { id: true, companyName: true },
        })
      : []
    const supplierIdToName = new Map(suppliers.map((s) => [s.id, s.companyName]))
    for (const pi of poItems) {
      const supplierId = poIdToSupplierId.get(pi.poId)
      const name = supplierId ? supplierIdToName.get(supplierId) : undefined
      if (name) poItemToName.set(pi.id, name)
    }
  }

  // --- 工賃経路: WoItem → WorkOrder.factoryId/contractorId → Factory/Contractor ---
  const woItemToCp = new Map<string, SourceCounterparty>()
  if (woItemIds.length > 0) {
    const woItems = await prisma.woItem.findMany({
      where: { id: { in: woItemIds } },
      select: { id: true, woId: true },
    })
    const wos = await prisma.workOrder.findMany({
      where: { id: { in: uniq(woItems.map((w) => w.woId)) }, companyId },
      select: { id: true, factoryId: true, contractorId: true },
    })
    const factories = await prisma.factory.findMany({
      where: { id: { in: uniq(wos.map((w) => w.factoryId)) } },
      select: { id: true, factoryName: true },
    })
    const contractors = await prisma.contractor.findMany({
      where: { id: { in: uniq(wos.map((w) => w.contractorId)) } },
      select: { id: true, contractorName: true },
    })
    const factoryName = new Map(factories.map((f) => [f.id, f.factoryName]))
    const contractorName = new Map(contractors.map((c) => [c.id, c.contractorName]))
    const woIdToCp = new Map<string, SourceCounterparty>()
    for (const w of wos) {
      // 工場を優先し、無ければ外注先（両 null なら辿れない）。
      if (w.factoryId && factoryName.has(w.factoryId)) {
        woIdToCp.set(w.id, { name: factoryName.get(w.factoryId)!, kind: "FACTORY" })
      } else if (w.contractorId && contractorName.has(w.contractorId)) {
        woIdToCp.set(w.id, {
          name: contractorName.get(w.contractorId)!,
          kind: "CONTRACTOR",
        })
      }
    }
    for (const wi of woItems) {
      const cp = woIdToCp.get(wi.woId)
      if (cp) woItemToCp.set(wi.id, cp)
    }
  }

  for (const it of items) {
    if (it.sourceWoItemId && woItemToCp.has(it.sourceWoItemId)) {
      result.set(it.id, woItemToCp.get(it.sourceWoItemId)!)
    } else if (it.sourcePoItemId && poItemToName.has(it.sourcePoItemId)) {
      result.set(it.id, {
        name: poItemToName.get(it.sourcePoItemId)!,
        kind: "SUPPLIER",
      })
    }
  }

  return result
}
