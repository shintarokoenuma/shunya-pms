"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PURCHASE_ORDER_STATUS_OPTIONS } from "./labels"
import type { SupplierOption } from "@/lib/actions/purchase-orders"

const NO_SUP = "__all_suppliers__"

export function PurchaseOrdersSearch({ suppliers }: { suppliers: SupplierOption[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const [status, setStatus] = useState(searchParams.get("status") ?? "all")
  const [supplierId, setSupplierId] = useState(
    searchParams.get("supplierId") ?? NO_SUP,
  )

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (status !== "all") params.set("status", status)
    if (supplierId !== NO_SUP) params.set("supplierId", supplierId)
    startTransition(() =>
      router.push(
        params.toString() ? `/purchase-orders?${params.toString()}` : "/purchase-orders",
      ),
    )
  }

  const clear = () => {
    setQ("")
    setStatus("all")
    setSupplierId(NO_SUP)
    startTransition(() => router.push("/purchase-orders"))
  }

  const hasFilter = q.trim() || status !== "all" || supplierId !== NO_SUP

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="PO番号 / タイトル で検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="発注先" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_SUP}>発注先（全て）</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="font-mono text-xs text-muted-foreground mr-2">
                  {s.supplierCode}
                </span>
                {s.companyName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ステータス（全て）</SelectItem>
            {PURCHASE_ORDER_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button type="submit" disabled={isPending}>
            検索
          </Button>
          {hasFilter && (
            <Button type="button" variant="ghost" onClick={clear} disabled={isPending}>
              <X className="mr-1 h-4 w-4" />
              クリア
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
