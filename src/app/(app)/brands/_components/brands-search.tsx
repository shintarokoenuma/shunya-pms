"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { Search } from "lucide-react"
import { BrandStatus } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BRAND_STATUS_LABEL } from "./labels"

type ClientOption = {
  id: string
  clientCode: string
  companyName: string
}

export function BrandsSearch({ clientOptions }: { clientOptions: ClientOption[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const [status, setStatus] = useState(searchParams.get("status") ?? "_all")
  const [clientId, setClientId] = useState(searchParams.get("clientId") ?? "_all")

  const apply = (next: { q?: string; status?: string; clientId?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    const setParam = (key: string, value: string | undefined) => {
      if (!value || value === "" || value === "_all") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    setParam("q", next.q ?? q)
    setParam("status", next.status ?? status)
    setParam("clientId", next.clientId ?? clientId)
    params.delete("page")
    startTransition(() => {
      router.push(`/brands?${params.toString()}`)
    })
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    apply({})
  }

  const onReset = () => {
    setQ("")
    setStatus("_all")
    setClientId("_all")
    startTransition(() => {
      router.push("/brands")
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <label className="text-xs text-muted-foreground mb-1 block">検索</label>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ブランド名・コード"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      <div className="w-[200px]">
        <label className="text-xs text-muted-foreground mb-1 block">クライアント</label>
        <Select
          value={clientId}
          onValueChange={(v) => {
            setClientId(v)
            apply({ clientId: v })
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">すべて</SelectItem>
            {clientOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.companyName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-[140px]">
        <label className="text-xs text-muted-foreground mb-1 block">ステータス</label>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v)
            apply({ status: v })
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">すべて</SelectItem>
            {Object.entries(BRAND_STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending} size="sm">
          検索
        </Button>
        <Button type="button" variant="outline" onClick={onReset} disabled={isPending} size="sm">
          クリア
        </Button>
      </div>
    </form>
  )
}
