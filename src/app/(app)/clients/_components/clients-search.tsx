"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useTransition, useState, useEffect } from "react"
import { Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BUSINESS_TYPE_LABEL,
  STATUS_LABEL,
} from "./labels"

const ALL = "__all__"

export function ClientsSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const status = searchParams.get("status") ?? ALL
  const businessType = searchParams.get("businessType") ?? ALL

  // URL が変わったら検索フィールドを同期
  useEffect(() => {
    setQ(searchParams.get("q") ?? "")
  }, [searchParams])

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "" || value === ALL) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    // 検索条件変更時はページを1に戻す
    params.delete("page")
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateParam("q", q.trim())
  }

  function clearAll() {
    setQ("")
    startTransition(() => {
      router.push(pathname)
    })
  }

  const hasFilters =
    !!searchParams.get("q") ||
    !!searchParams.get("status") ||
    !!searchParams.get("businessType")

  return (
    <div className="flex flex-col md:flex-row gap-2">
      <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="クライアントコードか会社名で検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
            disabled={isPending}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          検索
        </Button>
      </form>

      <div className="flex gap-2">
        <Select
          value={status}
          onValueChange={(v) => updateParam("status", v)}
          disabled={isPending}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全ステータス</SelectItem>
            {Object.entries(STATUS_LABEL).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={businessType}
          onValueChange={(v) => updateParam("businessType", v)}
          disabled={isPending}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="業態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全業態</SelectItem>
            {Object.entries(BUSINESS_TYPE_LABEL).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearAll}
            disabled={isPending}
            title="絞り込みをクリア"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
