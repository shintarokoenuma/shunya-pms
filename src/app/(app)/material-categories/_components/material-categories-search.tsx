"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MATERIAL_CATEGORY_STATUS_LABELS,
  MATERIAL_CATEGORY_LEVEL_OPTIONS,
} from "./labels"

export function MaterialCategoriesSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const [status, setStatus] = useState(searchParams.get("status") ?? "_all")
  const [level, setLevel] = useState(searchParams.get("level") ?? "_all")

  const apply = (next: { q?: string; status?: string; level?: string }) => {
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
    setParam("level", next.level ?? level)
    params.delete("page")
    startTransition(() => {
      router.push(`/material-categories?${params.toString()}`)
    })
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    apply({})
  }

  const onReset = () => {
    setQ("")
    setStatus("_all")
    setLevel("_all")
    startTransition(() => {
      router.push("/material-categories")
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <label className="text-xs text-muted-foreground mb-1 block">検索</label>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="カテゴリ名・コード"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      <div className="w-[180px]">
        <label className="text-xs text-muted-foreground mb-1 block">階層</label>
        <Select
          value={level}
          onValueChange={(v) => {
            setLevel(v)
            apply({ level: v })
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">すべて</SelectItem>
            {MATERIAL_CATEGORY_LEVEL_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={String(o.value)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-[140px]">
        <label className="text-xs text-muted-foreground mb-1 block">
          ステータス
        </label>
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
            {Object.entries(MATERIAL_CATEGORY_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending} size="sm">
          検索
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onReset}
          disabled={isPending}
          size="sm"
        >
          クリア
        </Button>
      </div>
    </form>
  )
}
