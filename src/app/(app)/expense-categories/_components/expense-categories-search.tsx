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
  EXPENSE_CATEGORY_STATUS_OPTIONS,
  EXPENSE_TYPE_OPTIONS,
} from "./labels"

export function ExpenseCategoriesSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const [status, setStatus] = useState(searchParams.get("status") ?? "all")
  const [expenseType, setExpenseType] = useState(
    searchParams.get("expenseType") ?? "all",
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (status !== "all") params.set("status", status)
    if (expenseType !== "all") params.set("expenseType", expenseType)
    startTransition(() => {
      router.push(
        params.toString()
          ? `/expense-categories?${params.toString()}`
          : "/expense-categories",
      )
    })
  }

  const handleClear = () => {
    setQ("")
    setStatus("all")
    setExpenseType("all")
    startTransition(() => {
      router.push("/expense-categories")
    })
  }

  const hasFilter =
    q.trim().length > 0 || status !== "all" || expenseType !== "all"

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
        <Select value={expenseType} onValueChange={setExpenseType}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="費用種別" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">費用種別（全て）</SelectItem>
            {EXPENSE_TYPE_OPTIONS.map((opt) => (
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
            {EXPENSE_CATEGORY_STATUS_OPTIONS.map((opt) => (
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
