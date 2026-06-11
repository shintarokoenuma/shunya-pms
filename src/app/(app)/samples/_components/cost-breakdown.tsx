import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import type {
  CostBreakdownSection,
  CostBreakdownExcludeReason,
} from "@/lib/actions/sample-production-costs"

const EXCLUDE_LABEL: Record<CostBreakdownExcludeReason, string> = {
  AMOUNT_UNDECIDED: "金額未定",
  NON_JPY: "非JPY",
  CATEGORY: "集計対象外",
}

function yen(n: number | null, currency: string): string {
  if (n === null) return "未定"
  if (currency !== "JPY") return `${n.toLocaleString("ja-JP")} ${currency}`
  return `¥${n.toLocaleString("ja-JP")}`
}

/** S-4c-1.5: コスト集計カードの明細内訳（伝票→品目→数量×単価=小計）。表示のみ。 */
export function CostBreakdown({
  sections,
}: {
  sections: CostBreakdownSection[]
}) {
  if (sections.length === 0) return null

  return (
    <div className="mt-4 space-y-4 border-t pt-4">
      {sections.map((sec) => (
        <div key={sec.key}>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm font-medium">{sec.label}</span>
            {sec.key !== "other" && (
              <span className="text-sm tabular-nums">
                小計 ¥{sec.subtotal.toLocaleString("ja-JP")}
              </span>
            )}
          </div>
          <ul className="space-y-1">
            {sec.rows.map((r, i) => {
              const href =
                r.docType === "PO"
                  ? `/purchase-orders/${r.docId}`
                  : `/work-orders/${r.docId}`
              return (
                <li
                  key={`${r.docId}-${i}`}
                  className="flex flex-wrap items-baseline gap-x-2 text-xs"
                >
                  <Link
                    href={href}
                    className="font-mono text-primary hover:underline"
                  >
                    {r.docNumber}
                  </Link>
                  {r.orderToName && (
                    <span className="text-muted-foreground">
                      {r.orderToName}
                    </span>
                  )}
                  {r.itemCode && (
                    <span className="font-mono text-muted-foreground">
                      {r.itemCode}
                    </span>
                  )}
                  <span className="font-medium">{r.itemName}</span>
                  {r.colorCode && (
                    <span className="text-muted-foreground">
                      C/#{r.colorCode}
                    </span>
                  )}
                  <span className="tabular-nums">
                    {r.quantity.toLocaleString("ja-JP")}
                    {r.unit} ×{" "}
                    {r.unitPrice === null ? "未定" : yen(r.unitPrice, r.currency)}
                    {" = "}
                    {yen(r.subtotal, r.currency)}
                  </span>
                  {r.excluded && r.excludeReason && (
                    <Badge variant="outline" className="text-[10px]">
                      {EXCLUDE_LABEL[r.excludeReason]}
                    </Badge>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
