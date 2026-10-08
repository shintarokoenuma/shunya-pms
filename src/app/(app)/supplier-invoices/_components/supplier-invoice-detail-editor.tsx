"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SearchableSelect, type SearchableOption } from "../../_components/searchable-select"
import {
  confirmSupplierInvoiceLines,
  updateSupplierInvoiceCounterpart,
  updateSupplierInvoiceLine,
  type SupplierInvoiceDetail,
  type SupplierInvoiceOptions,
} from "@/lib/actions/supplier-invoices"
import { COUNTERPART_TYPE_LABELS, MATCH_BADGE_VARIANT, fmtAmount, fmtNum, fmtYmdSlash, matchBadgeLabel } from "./labels"

const NONE = "__none__"
const OTHER = "OTHER"

/**
 * B-212 PR-1（P1-D8）: 詳細で直せるもの＝相手先の当て・明細の品番・費目・要確認の行の確認。直したら覚えた対応も書き換わる（D-5）。
 * 読み取った値（金額・日付など）は直せない
 */
export function SupplierInvoiceDetailEditor({ detail, options }: { detail: SupplierInvoiceDetail; options: SupplierInvoiceOptions }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busyLine, setBusyLine] = useState<string | null>(null)

  const cpOptions = useMemo<SearchableOption[]>(() => [
    { value: OTHER, label: "相手先なし（マスターに当てない）", keywords: "なし OTHER" },
    ...options.counterparts.map((c) => ({ value: `${c.type}:${c.id}`, label: `${COUNTERPART_TYPE_LABELS[c.type]}　${c.name}`, keywords: `${c.code} ${c.name}` })),
  ], [options])
  const productOpts = useMemo<SearchableOption[]>(() => options.products.map((p) => ({
    value: p.id, label: `${p.productCode}　${p.productName}`, keywords: [p.productCode, p.productName, p.clientProductCode ?? "", p.patternNumber ?? ""].join(" "),
  })), [options])
  const cpValue = detail.counterpartType === "OTHER" || !detail.counterpartId ? OTHER : `${detail.counterpartType}:${detail.counterpartId}`

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string } | { ok: true; data: unknown }>, done: string, lineId?: string) => {
    setBusyLine(lineId ?? null)
    startTransition(async () => {
      const r = await fn()
      setBusyLine(null)
      if (!r.ok) { toast.error(r.error); return }
      toast.success(done)
      router.refresh()
    })
  }
  const pendingIds = detail.lines.filter((l) => l.matchStatus === "RULE_PENDING").map((l) => l.id)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md border p-4 text-sm">
        <span className="text-muted-foreground">相手先の当て</span>
        <SearchableSelect
          options={cpOptions}
          value={cpValue}
          onChange={(v) => {
            const [t, id] = v === OTHER ? [OTHER, null] : v.split(":")
            run(() => updateSupplierInvoiceCounterpart({ id: detail.id, counterpartType: t, counterpartId: id }), "相手先を直しました（覚えた対応も書き換えました）")
          }}
          className="w-[340px]"
          disabled={isPending}
          ariaLabel="相手先"
        />
        <span className="text-xs text-muted-foreground">読み取った社名: {detail.counterpartNameRaw}{detail.counterpartCodeRaw ? `（コード ${detail.counterpartCodeRaw}）` : ""}</span>
        <div className="ml-auto flex items-center gap-2">
          {pendingIds.length > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={() => run(() => confirmSupplierInvoiceLines({ id: detail.id }), `${pendingIds.length} 行を確認済みにしました`)} disabled={isPending}>
              要確認をまとめて確認済みにする（{pendingIds.length}）
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">行</TableHead>
              <TableHead className="w-[100px]">伝票日付</TableHead>
              <TableHead className="w-[150px]">投入先</TableHead>
              <TableHead>品名</TableHead>
              <TableHead className="w-[80px] text-right">数量</TableHead>
              <TableHead className="w-[90px] text-right">単価</TableHead>
              <TableHead className="w-[110px] text-right">金額</TableHead>
              <TableHead className="w-[180px]">当て方</TableHead>
              <TableHead className="w-[300px]">品番</TableHead>
              <TableHead className="w-[220px]">費目</TableHead>
              <TableHead className="w-[90px]">原本</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.lines.map((l) => {
              const busy = isPending && busyLine === l.id
              return (
                <TableRow key={l.id}>
                  <TableCell className="text-sm tabular-nums">{l.lineNo}</TableCell>
                  <TableCell className="text-sm tabular-nums">{fmtYmdSlash(l.slipDate)}{l.slipNumber ? <span className="block text-xs text-muted-foreground">{l.slipNumber}</span> : null}</TableCell>
                  <TableCell className="font-mono text-xs">{l.targetRaw ?? "—"}</TableCell>
                  <TableCell className="text-sm">{l.itemName ?? "—"}{l.itemCodeRaw ? <span className="ml-1 text-xs text-muted-foreground">{l.itemCodeRaw}</span> : null}{l.memo ? <span className="block text-xs text-muted-foreground">{l.memo}</span> : null}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{fmtNum(l.quantity)}{l.unit ? ` ${l.unit}` : ""}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{fmtAmount(l.unitPrice, detail.currency)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{fmtAmount(l.amount, detail.currency)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={MATCH_BADGE_VARIANT[l.matchStatus]} className="w-fit">{matchBadgeLabel(l.matchStatus, l.matchedBy)}</Badge>
                      {l.matchStatus === "RULE_PENDING" ? (
                        <button type="button" className="text-left text-xs underline" onClick={() => run(() => confirmSupplierInvoiceLines({ id: detail.id, lineIds: [l.id] }), "確認済みにしました", l.id)} disabled={isPending}>確認済みにする</button>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <SearchableSelect
                        options={productOpts}
                        value={l.productId}
                        onChange={(v) => run(() => updateSupplierInvoiceLine({ lineId: l.id, productId: v, noProduct: false, costCategoryId: l.costCategoryId }), "品番を直しました（覚えた対応も書き換えました）", l.id)}
                        placeholder={l.matchStatus === "NO_PRODUCT" ? "品番なし" : "品番を選ぶ"}
                        className="w-[290px]"
                        disabled={isPending}
                        ariaLabel={`行 ${l.lineNo} の品番`}
                      />
                      {l.matchStatus !== "NO_PRODUCT" ? (
                        <button type="button" className="text-left text-xs text-muted-foreground underline" onClick={() => run(() => updateSupplierInvoiceLine({ lineId: l.id, productId: null, noProduct: true, costCategoryId: l.costCategoryId }), "品番なしにしました", l.id)} disabled={isPending}>品番なし（その他経費）にする</button>
                      ) : null}
                      {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={l.costCategoryId ?? NONE}
                      onValueChange={(v) => run(() => updateSupplierInvoiceLine({ lineId: l.id, productId: l.productId, noProduct: l.matchStatus === "NO_PRODUCT", costCategoryId: v === NONE ? null : v }), "費目を直しました", l.id)}
                      disabled={isPending}
                    >
                      <SelectTrigger className="w-[210px]" aria-label={`行 ${l.lineNo} の費目`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>費目なし</SelectItem>
                        {options.costCategories.map((cc) => <SelectItem key={cc.id} value={cc.id}>{cc.level === 2 ? "　" : ""}{cc.categoryName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.sourcePage != null ? `p.${l.sourcePage}` : "—"}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
