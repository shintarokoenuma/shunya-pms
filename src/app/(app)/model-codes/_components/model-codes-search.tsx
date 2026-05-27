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
import { MODEL_CODE_STATUS_OPTIONS } from "./labels"

type BrandOption = {
  id: string
  brandCode: string
  brandName: string
}

type Props = {
  brands: BrandOption[]
}

const NO_BRAND = "__all_brands__"
const NO_CATEGORY = "__all_categories__"

export function ModelCodesSearch({ brands }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const [status, setStatus] = useState(searchParams.get("status") ?? "all")
  const [brandId, setBrandId] = useState(
    searchParams.get("brandId") ?? NO_BRAND,
  )
  // Category は Phase 1A では選択肢が空。フィルタ状態だけ保持
  const [categoryId] = useState(
    searchParams.get("categoryId") ?? NO_CATEGORY,
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (status !== "all") params.set("status", status)
    if (brandId !== NO_BRAND) params.set("brandId", brandId)
    if (categoryId !== NO_CATEGORY) params.set("categoryId", categoryId)
    startTransition(() => {
      router.push(
        params.toString() ? `/model-codes?${params.toString()}` : "/model-codes",
      )
    })
  }

  const handleClear = () => {
    setQ("")
    setStatus("all")
    setBrandId(NO_BRAND)
    startTransition(() => {
      router.push("/model-codes")
    })
  }

  const hasFilter =
    q.trim().length > 0 || status !== "all" || brandId !== NO_BRAND

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="モデルコード / モデル名 で検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={brandId} onValueChange={setBrandId}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="ブランド" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_BRAND}>ブランド（全て）</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                <span className="font-mono text-xs text-muted-foreground mr-2">
                  {b.brandCode}
                </span>
                {b.brandName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value="all" disabled>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="カテゴリ（未実装）" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">商品カテゴリ実装後に有効化</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ステータス（全て）</SelectItem>
            {MODEL_CODE_STATUS_OPTIONS.map((o) => (
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
