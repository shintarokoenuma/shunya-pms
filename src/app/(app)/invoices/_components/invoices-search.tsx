"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { INVOICE_STATUS_OPTIONS } from "./labels"

/**
 * addendum v0.9 §2-1: フィルタは `状態: すべて` / `クライアント: すべて` の2つ。
 * ★「未入金・一部入金・入金済み」のフィルタは作らない（D-25・D-30）。
 */
export function InvoicesSearch({
  clients,
}: {
  clients: { id: string; companyName: string }[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const status = searchParams.get("status") ?? "all"
  const clientId = searchParams.get("clientId") ?? "all"

  const push = (nextStatus: string, nextClientId: string) => {
    const params = new URLSearchParams()
    if (nextStatus !== "all") params.set("status", nextStatus)
    if (nextClientId !== "all") params.set("clientId", nextClientId)
    startTransition(() =>
      router.push(params.toString() ? `/invoices?${params.toString()}` : "/invoices"),
    )
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Select value={status} onValueChange={(v) => push(v, clientId)} disabled={isPending}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">状態: すべて</SelectItem>
          {INVOICE_STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              状態: {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={clientId} onValueChange={(v) => push(status, v)} disabled={isPending}>
        <SelectTrigger className="w-full sm:w-[260px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">クライアント: すべて</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.companyName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
