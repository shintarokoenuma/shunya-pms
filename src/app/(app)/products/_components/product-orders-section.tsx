import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProductOrderRow } from "@/lib/actions/product-orders"
import {
  PURCHASE_ORDER_STATUS_LABELS,
  PURCHASE_ORDER_STATUS_BADGE_VARIANT,
} from "../../purchase-orders/_components/labels"
import {
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUS_BADGE_VARIANT,
  WORK_ORDER_CATEGORY_LABELS,
} from "../../work-orders/_components/labels"
import type { PurchaseOrderStatus, WorkOrderStatus } from "@prisma/client"

function money(v: number | null, currency: string): string {
  if (v === null) return "—"
  return `${currency === "JPY" ? "¥" : ""}${v.toLocaleString("ja-JP")}${
    currency === "JPY" ? "" : ` ${currency}`
  }`
}

export function ProductOrdersSection({ rows }: { rows: ProductOrderRow[] }) {
  return (
    <Card id="orders">
      <CardHeader>
        <CardTitle className="text-base">発注（PO / WO）</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            この品番に紐づく発注（PO / WO）はまだありません。
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const href =
                r.kind === "PO"
                  ? `/purchase-orders/${r.id}`
                  : `/work-orders/${r.id}`
              const isDraft = r.status === "DRAFT"
              const statusLabel =
                r.kind === "PO"
                  ? PURCHASE_ORDER_STATUS_LABELS[r.status as PurchaseOrderStatus]
                  : WORK_ORDER_STATUS_LABELS[r.status as WorkOrderStatus]
              const statusVariant =
                r.kind === "PO"
                  ? PURCHASE_ORDER_STATUS_BADGE_VARIANT[
                      r.status as PurchaseOrderStatus
                    ]
                  : WORK_ORDER_STATUS_BADGE_VARIANT[r.status as WorkOrderStatus]
              const isProduction = r.workCategory === "PRODUCTION"
              return (
                <div
                  key={`${r.kind}-${r.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-3 text-sm"
                >
                  <Badge
                    variant="outline"
                    className={
                      r.kind === "PO"
                        ? "border-sky-300 text-sky-700"
                        : "border-emerald-300 text-emerald-700"
                    }
                  >
                    {r.kind}
                  </Badge>
                  <Link
                    href={href}
                    className="font-mono font-medium hover:underline"
                  >
                    {r.number}
                  </Link>
                  {/* DRAFT は目立たせる（下書き＝人が確定前）。 */}
                  {isDraft ? (
                    <Badge className="border-amber-300 bg-amber-100 text-amber-800">
                      {statusLabel}
                    </Badge>
                  ) : (
                    <Badge variant={statusVariant}>{statusLabel}</Badge>
                  )}
                  {r.kind === "WO" && r.workCategory && (
                    <Badge
                      variant="outline"
                      className={
                        isProduction
                          ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                          : "text-[11px]"
                      }
                    >
                      {WORK_ORDER_CATEGORY_LABELS[r.workCategory]}
                    </Badge>
                  )}
                  <span className="text-muted-foreground">
                    {r.counterpartyName}
                  </span>
                  {r.title && (
                    <span className="truncate text-muted-foreground">
                      {r.title}
                    </span>
                  )}
                  <span className="ml-auto font-mono">
                    {money(r.subtotalJpy, r.currency)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
