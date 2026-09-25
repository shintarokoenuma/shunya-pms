import { DeliveryLineKind, DeliveryNoteStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * B-109 PR-3（P3-D5）: 受注ごとの前受金の集計。★ここ 1 か所に置き、受注画面・納品書・請求書の 3 か所から使う。
 * - 請求済み＝DEPOSIT 行（数量 1）の金額の合計
 * - 充当済み＝DEPOSIT_APPLIED 行（数量 −1）の金額の絶対値の合計
 * - 残り＝請求済み − 充当済み
 * 対象は 論理削除されていない・取消（CANCELLED）でない 納品書の行。状態は問わない（下書きの充当行も充当済みに数える。
 * 二重に充当させないため）。編集中の納品書は excludeDeliveryNoteId で自分の行を除く（P3-D4）。
 * ★DeliveryNoteItem は companyId を持たない子テーブル。親（DeliveryNote）の companyId で必ず絞る。
 */
export type DepositLineInput = {
  soId: string
  lineKind: DeliveryLineKind
  quantity: number
  /** 単価（null は 0 として扱う） */
  unitPrice: number | null
}

export type DepositSummary = {
  soId: string
  /** 請求済み（DEPOSIT 行の合計） */
  invoiced: number
  /** 充当済み（DEPOSIT_APPLIED 行の絶対値の合計） */
  applied: number
  /** 残り＝請求済み − 充当済み（マイナスにはならない） */
  remaining: number
}

/** 行の金額（数量 × 単価・円未満は切り捨て）。DEPOSIT_APPLIED は数量が −1 なので絶対値を取る。 */
function lineAmount(line: DepositLineInput): number {
  const unit = line.unitPrice ?? 0
  return Math.abs(Math.floor(line.quantity * unit))
}

/** 純関数: 行の一覧から受注ごとの集計を作る。 */
export function summarizeDeposits(lines: DepositLineInput[]): Map<string, DepositSummary> {
  const out = new Map<string, DepositSummary>()
  for (const l of lines) {
    const s = out.get(l.soId) ?? { soId: l.soId, invoiced: 0, applied: 0, remaining: 0 }
    if (l.lineKind === DeliveryLineKind.DEPOSIT) s.invoiced += lineAmount(l)
    else if (l.lineKind === DeliveryLineKind.DEPOSIT_APPLIED) s.applied += lineAmount(l)
    s.remaining = Math.max(s.invoiced - s.applied, 0)
    out.set(l.soId, s)
  }
  return out
}

/** 1 受注分（無ければゼロ）。 */
export function depositSummaryFor(map: Map<string, DepositSummary>, soId: string): DepositSummary {
  return map.get(soId) ?? { soId, invoiced: 0, applied: 0, remaining: 0 }
}

/**
 * 読み取り: 受注 id 群の前受金の集計を DB から作る。
 * excludeDeliveryNoteId を渡すと、その納品書の行を除く（編集中の自分の行を二重に数えないため）。
 */
export async function loadDepositSummaries(
  companyId: string,
  soIds: string[],
  opts: { excludeDeliveryNoteId?: string } = {},
): Promise<Map<string, DepositSummary>> {
  const ids = [...new Set(soIds.filter((v): v is string => !!v))]
  if (ids.length === 0) return new Map()
  const rows = await prisma.deliveryNoteItem.findMany({
    where: {
      soId: { in: ids },
      lineKind: { not: null },
      ...(opts.excludeDeliveryNoteId ? { deliveryNoteId: { not: opts.excludeDeliveryNoteId } } : {}),
      deliveryNote: {
        companyId,
        deletedAt: null,
        status: { not: DeliveryNoteStatus.CANCELLED },
      },
    },
    select: { soId: true, lineKind: true, quantity: true, unitPrice: true },
  })
  return summarizeDeposits(
    rows.map((r) => ({
      soId: r.soId as string,
      lineKind: r.lineKind as DeliveryLineKind,
      quantity: r.quantity,
      unitPrice: r.unitPrice != null ? r.unitPrice.toNumber() : null,
    })),
  )
}

/** 表示用の品名（P3-D2 / P3-D3）。 */
export function depositLineName(kind: DeliveryLineKind, soNumber: string): string {
  return kind === DeliveryLineKind.DEPOSIT ? `前受金（${soNumber}）` : `前受金充当（${soNumber}）`
}
