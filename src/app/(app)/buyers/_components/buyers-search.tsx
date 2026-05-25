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
import { BUYER_STATUS_OPTIONS } from "./labels"

type ClientOption = {
  id: string
  clientCode: string
  companyName: string
}

type Props = {
  clients: ClientOption[]
}

const NO_CLIENT = "__all__"

export function BuyersSearch({ clients }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const [status, setStatus] = useState(searchParams.get("status") ?? "all")
  const [clientId, setClientId] = useState(
    searchParams.get("clientId") ?? NO_CLIENT,
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (status !== "all") params.set("status", status)
    if (clientId !== NO_CLIENT) params.set("clientId", clientId)
    startTransition(() => {
      router.push(
        params.toString() ? `/buyers?${params.toString()}` : "/buyers",
      )
    })
  }

  const handleClear = () => {
    setQ("")
    setStatus("all")
    setClientId(NO_CLIENT)
    startTransition(() => {
      router.push("/buyers")
    })
  }

  const hasFilter =
    q.trim().length > 0 || status !== "all" || clientId !== NO_CLIENT

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="コード / バイヤー名 / 英名で検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="関連クライアント" />
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
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ステータス（全て）</SelectItem>
            {BUYER_STATUS_OPTIONS.map((o) => (
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
