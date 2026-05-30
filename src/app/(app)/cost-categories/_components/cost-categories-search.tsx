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
import {
  COST_CATEGORY_STATUS_OPTIONS,
  EXTERNAL_COST_CATEGORY_OPTIONS,
} from "./labels"

export function CostCategoriesSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const [status, setStatus] = useState(searchParams.get("status") ?? "all")
  const [externalCategory, setExternalCategory] = useState(
    searchParams.get("externalCategory") ?? "all",
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (status !== "all") params.set("status", status)
    if (externalCategory !== "all")
      params.set("externalCategory", externalCategory)
    startTransition(() => {
      router.push(
        params.toString()
          ? `/cost-categories?${params.toString()}`
          : "/cost-categories",
      )
    })
  }

  const handleClear = () => {
    setQ("")
    setStatus("all")
    setExternalCategory("all")
    startTransition(() => {
      router.push("/cost-categories")
    })
  }

  const hasFilter =
    q.trim().length > 0 || status !== "all" || externalCategory !== "all"

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="コード / 名称 / 英名で検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={externalCategory}
          onValueChange={setExternalCategory}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="大分類" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">大分類（全て）</SelectItem>
            {EXTERNAL_COST_CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
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
            {COST_CATEGORY_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
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
