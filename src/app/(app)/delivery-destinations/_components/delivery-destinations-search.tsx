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
import { DELIVERY_DESTINATION_STATUS_OPTIONS } from "./labels"

type ClientOption = {
  id: string
  clientCode: string
  companyName: string
}

type BuyerOption = {
  id: string
  buyerCode: string
  buyerName: string
  clientId: string | null
}

type Props = {
  clients: ClientOption[]
  buyers: BuyerOption[]
}

const NO_CLIENT = "__all_clients__"
const NO_BUYER = "__all_buyers__"

export function DeliveryDestinationsSearch({ clients, buyers }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const [status, setStatus] = useState(searchParams.get("status") ?? "all")
  const [clientId, setClientId] = useState(
    searchParams.get("clientId") ?? NO_CLIENT,
  )
  const [buyerId, setBuyerId] = useState(
    searchParams.get("buyerId") ?? NO_BUYER,
  )

  // Client が選択されている場合、その配下の Buyer のみ表示
  const filteredBuyers =
    clientId === NO_CLIENT
      ? buyers
      : buyers.filter((b) => b.clientId === clientId)

  const handleClientChange = (next: string) => {
    setClientId(next)
    // Client を変えたら、選択中の Buyer が新 Client 配下に無ければリセット
    if (next !== NO_CLIENT && buyerId !== NO_BUYER) {
      const stillValid = buyers.some(
        (b) => b.id === buyerId && b.clientId === next,
      )
      if (!stillValid) setBuyerId(NO_BUYER)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (status !== "all") params.set("status", status)
    if (clientId !== NO_CLIENT) params.set("clientId", clientId)
    if (buyerId !== NO_BUYER) params.set("buyerId", buyerId)
    startTransition(() => {
      router.push(
        params.toString()
          ? `/delivery-destinations?${params.toString()}`
          : "/delivery-destinations",
      )
    })
  }

  const handleClear = () => {
    setQ("")
    setStatus("all")
    setClientId(NO_CLIENT)
    setBuyerId(NO_BUYER)
    startTransition(() => {
      router.push("/delivery-destinations")
    })
  }

  const hasFilter =
    q.trim().length > 0 ||
    status !== "all" ||
    clientId !== NO_CLIENT ||
    buyerId !== NO_BUYER

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="コード / 納品先名 で検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={clientId} onValueChange={handleClientChange}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="クライアント" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CLIENT}>クライアント（全て）</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="font-mono text-xs text-muted-foreground mr-2">
                  {c.clientCode}
                </span>
                {c.companyName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={buyerId} onValueChange={setBuyerId}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="バイヤー" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_BUYER}>バイヤー（全て）</SelectItem>
            {filteredBuyers.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                <span className="font-mono text-xs text-muted-foreground mr-2">
                  {b.buyerCode}
                </span>
                {b.buyerName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ステータス（全て）</SelectItem>
            {DELIVERY_DESTINATION_STATUS_OPTIONS.map((o) => (
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
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              disabled={isPending}
            >
              <X className="mr-1 h-4 w-4" />
              クリア
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
