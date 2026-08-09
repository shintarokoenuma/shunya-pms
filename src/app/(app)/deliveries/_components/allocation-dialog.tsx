"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2, Plus, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { SAMPLE_ROUND_LABELS } from "../../samples/_components/labels"
import {
  listAllocationCandidates,
  type AllocationCandidates,
  type AllocationProductGroup,
} from "@/lib/actions/delivery-allocation"

/** 親（DeliveryNoteForm）に渡す明細行。ItemRow と同じ形。 */
export type AllocationPickedRow = {
  productId: string
  productName: string
  clientProductCode: string
  colorName: string
  size: string
  quantity: string
  unit: string
  unitPrice: string
  sourceSampleProductionId: string | null
  sourceWoItemId: string | null
  sourceWorkOrderId: string | null
  sourcePoItemId: string | null
  sourcePurchaseOrderId: string | null
}

type Props = {
  clientId: string
  onAdd: (rows: AllocationPickedRow[]) => void
}

type TabKey = "SAMPLE" | "ORDER"

function fmtYen(n: number | null): string {
  if (n == null) return "単価未定"
  return `¥${n.toLocaleString("ja-JP")}`
}

export function AllocationDialog({ clientId, onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabKey>("SAMPLE")
  const [candidates, setCandidates] = useState<AllocationCandidates | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setSelected(new Set())
      setTab("SAMPLE")
      setError(null)
      setCandidates(null)
      setLoading(true)
      listAllocationCandidates(clientId)
        .then((r) => {
          if (r.ok) setCandidates(r.data)
          else setError(r.error)
        })
        .finally(() => setLoading(false))
    } else {
      setSelected(new Set())
    }
  }

  const toggle = (key: string) => {
    setSelected((prev) => {
      const nextSet = new Set(prev)
      if (nextSet.has(key)) nextSet.delete(key)
      else nextSet.add(key)
      return nextSet
    })
  }

  const handleAdd = () => {
    if (!candidates || selected.size === 0) return
    const productNameById = new Map(
      candidates.groups.map((g) => [g.productId, g.productName]),
    )
    const rows: AllocationPickedRow[] = []

    for (const s of candidates.samples) {
      if (!selected.has(`SAMPLE:${s.sampleProductionId}`)) continue
      rows.push({
        productId: s.productId,
        // サンプルに title があればそれを品名に使う（同一品番で複数サンプルを
        // 引き当てたとき、明細上で区別できなくなるため）。無ければ品番名。
        productName: s.title?.trim() || productNameById.get(s.productId) || "",
        clientProductCode: "",
        colorName: "",
        size: "",
        quantity: String(s.quantity),
        unit: "枚",
        unitPrice: "",
        sourceSampleProductionId: s.sampleProductionId,
        sourceWoItemId: null,
        sourceWorkOrderId: null,
        sourcePoItemId: null,
        sourcePurchaseOrderId: null,
      })
    }

    for (const o of candidates.orders) {
      if (!selected.has(`${o.kind}:${o.itemId}`)) continue
      rows.push({
        productId: o.productId,
        productName: o.description,
        clientProductCode: "",
        colorName: "",
        size: "",
        quantity: String(o.quantity),
        unit: o.unit,
        unitPrice: o.unitPrice != null ? String(o.unitPrice) : "",
        sourceSampleProductionId: null,
        sourceWoItemId: o.kind === "WO" ? o.itemId : null,
        sourceWorkOrderId: o.kind === "WO" ? o.orderId : null,
        sourcePoItemId: o.kind === "PO" ? o.itemId : null,
        sourcePurchaseOrderId: o.kind === "PO" ? o.orderId : null,
      })
    }

    if (rows.length === 0) return
    onAdd(rows)
    toast.success(`${rows.length} 件を明細に追加しました`)
    setOpen(false)
    setSelected(new Set())
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={!clientId}>
          <Plus className="mr-1 h-4 w-4" />
          発注・サンプルから引き当て
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>発注・サンプルから引き当て</DialogTitle>
          <DialogDescription>
            このクライアント配下の候補から選んで明細に一括追加します（複数可）。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            候補を読み込み中…
          </div>
        ) : error ? (
          <p className="py-10 text-center text-sm text-destructive">{error}</p>
        ) : candidates ? (
          <>
            {/* タブ（自前ボタン切替・tabs.tsx が無いため） */}
            <div className="flex gap-1 border-b">
              <TabButton
                active={tab === "SAMPLE"}
                onClick={() => setTab("SAMPLE")}
                label={`サンプル（${candidates.samples.length}）`}
              />
              <TabButton
                active={tab === "ORDER"}
                onClick={() => setTab("ORDER")}
                label={`発注（${candidates.orders.length}）`}
              />
            </div>

            <div className="max-h-[420px] space-y-4 overflow-y-auto py-1">
              {tab === "SAMPLE" ? (
                <SampleTab
                  candidates={candidates}
                  selected={selected}
                  toggle={toggle}
                />
              ) : (
                <OrderTab
                  candidates={candidates}
                  selected={selected}
                  toggle={toggle}
                />
              )}
            </div>
          </>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          <Button
            onClick={() => startTransition(handleAdd)}
            disabled={selected.size === 0}
          >
            追加（{selected.size}）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "border-b-2 px-3 py-2 text-sm transition-colors " +
        (active
          ? "border-primary font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground")
      }
    >
      {label}
    </button>
  )
}

/** グループ見出し（[ブランド] 品番コード 品番名）。候補が1件以上あるときのみ表示。 */
function GroupHeading({ group }: { group: AllocationProductGroup }) {
  return (
    <div className="flex items-baseline gap-2 border-b pb-1 pt-2">
      {group.brandName && (
        <span className="text-xs text-muted-foreground">[{group.brandName}]</span>
      )}
      <span className="font-mono text-xs text-muted-foreground">
        {group.productCode}
      </span>
      <span className="text-sm font-medium">{group.productName}</span>
    </div>
  )
}

function SampleTab({
  candidates,
  selected,
  toggle,
}: {
  candidates: AllocationCandidates
  selected: Set<string>
  toggle: (key: string) => void
}) {
  const { groups, samples } = candidates
  if (samples.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        引き当て可能なサンプルがありません。
      </p>
    )
  }
  return (
    <div className="space-y-1">
      {groups.map((g) => {
        const rows = samples.filter((s) => s.productId === g.productId)
        if (rows.length === 0) return null
        return (
          <div key={g.productId}>
            <GroupHeading group={g} />
            {rows.map((s) => {
              const key = `SAMPLE:${s.sampleProductionId}`
              return (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50"
                >
                  <Checkbox
                    checked={selected.has(key)}
                    onCheckedChange={() => toggle(key)}
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {s.sampleNumber}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {SAMPLE_ROUND_LABELS[
                      s.sampleRound as keyof typeof SAMPLE_ROUND_LABELS
                    ] ?? s.sampleRound}
                  </span>
                  {s.title && <span className="text-sm">{s.title}</span>}
                  <span className="text-sm">{s.quantity}枚</span>
                  {s.deliveredIn.length > 0 && (
                    <Badge variant="secondary">
                      {s.deliveredIn.join(", ")} で納品済み
                    </Badge>
                  )}
                </label>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function OrderTab({
  candidates,
  selected,
  toggle,
}: {
  candidates: AllocationCandidates
  selected: Set<string>
  toggle: (key: string) => void
}) {
  const { groups, orders, blocked } = candidates
  const noProduct = blocked.filter((b) => b.reason === "NO_PRODUCT")
  const productMissing = blocked.filter((b) => b.reason === "PRODUCT_MISSING")

  return (
    <div className="space-y-3">
      {orders.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          引き当て可能な発注明細がありません。
        </p>
      ) : (
        <div className="space-y-1">
          {groups.map((g) => {
            const rows = orders.filter((o) => o.productId === g.productId)
            if (rows.length === 0) return null
            return (
              <div key={g.productId}>
                <GroupHeading group={g} />
                {rows.map((o) => {
                  const key = `${o.kind}:${o.itemId}`
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer flex-col gap-1 rounded-md px-2 py-2 hover:bg-accent/50"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selected.has(key)}
                          onCheckedChange={() => toggle(key)}
                        />
                        <span className="text-sm">{o.description}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {o.orderNumber}
                        </span>
                        <span className="text-sm">
                          {o.quantity}
                          {o.unit}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {fmtYen(o.unitPrice)}
                        </span>
                        {o.isPhysicalAsset && (
                          <Badge variant="outline">物理資産</Badge>
                        )}
                        {o.orderHasDelivery && (
                          <Badge variant="secondary">
                            この発注に納品実績あり
                          </Badge>
                        )}
                      </div>
                      {o.hasFractionalQuantity && (
                        <span className="pl-7 text-xs text-destructive">
                          数量が小数です。整数で入力してください
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* ⑤ blocked 警告（折りたたまない・常時表示・reason で2分割） */}
      {noProduct.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            品番が紐づいていないため引き当てできません（{noProduct.length}件）
          </div>
          <ul className="mt-2 space-y-1 pl-6 text-xs text-muted-foreground">
            {noProduct.map((b, i) => (
              <li key={i}>
                {b.description}　{b.orderNumber}
              </li>
            ))}
          </ul>
          <p className="mt-2 pl-6 text-xs text-muted-foreground">
            → 発注側で品番を設定してください
          </p>
        </div>
      )}

      {productMissing.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            品番が見つからないため引き当てできません（{productMissing.length}件）
          </div>
          <ul className="mt-2 space-y-1 pl-6 text-xs text-muted-foreground">
            {productMissing.map((b, i) => (
              <li key={i}>
                {b.description}　{b.orderNumber}
              </li>
            ))}
          </ul>
          <p className="mt-2 pl-6 text-xs text-muted-foreground">
            → 品番が削除されている可能性があります。発注側で品番を設定し直してください。
          </p>
        </div>
      )}
    </div>
  )
}
