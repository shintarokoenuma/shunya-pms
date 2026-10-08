"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

/**
 * B-212 PR-1（P1-D8）: /supplier-invoices の絞り込み。月度・相手先・計上／参照・要確認／未一致がある書類だけ。
 * URL params を push する形は payments-search と同じ
 */
export function SupplierInvoicesSearch({
  periodMonths,
  counterparts,
}: {
  periodMonths: string[]
  counterparts: { value: string; label: string }[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const month = searchParams.get("month") ?? "all"
  const counterpart = searchParams.get("counterpart") ?? "all"
  const posting = searchParams.get("posting") ?? "all"
  const attention = searchParams.get("attention") === "1"

  const push = (next: { month?: string; counterpart?: string; posting?: string; attention?: boolean }) => {
    const params = new URLSearchParams()
    const m = next.month ?? month
    if (m !== "all") params.set("month", m)
    const c = next.counterpart ?? counterpart
    if (c !== "all") params.set("counterpart", c)
    const p = next.posting ?? posting
    if (p !== "all") params.set("posting", p)
    const a = next.attention ?? attention
    if (a) params.set("attention", "1")
    startTransition(() => router.push(params.toString() ? `/supplier-invoices?${params.toString()}` : "/supplier-invoices"))
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Select value={month} onValueChange={(v) => push({ month: v })} disabled={isPending}>
        <SelectTrigger className="w-full sm:w-[160px]" aria-label="月度"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべての月度</SelectItem>
          {periodMonths.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={counterpart} onValueChange={(v) => push({ counterpart: v })} disabled={isPending}>
        <SelectTrigger className="w-full sm:w-[260px]" aria-label="相手先"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべての相手先</SelectItem>
          {counterparts.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={posting} onValueChange={(v) => push({ posting: v })} disabled={isPending}>
        <SelectTrigger className="w-full sm:w-[140px]" aria-label="計上／参照"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">計上＋参照</SelectItem>
          <SelectItem value="COUNTED">計上だけ</SelectItem>
          <SelectItem value="REFERENCE">参照だけ</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Checkbox id="attention" checked={attention} onCheckedChange={(v) => push({ attention: v === true })} disabled={isPending} />
        <Label htmlFor="attention" className="text-sm">要確認・未一致がある書類だけ</Label>
      </div>
    </div>
  )
}
