"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { Search } from "lucide-react"
import { ProductStatus } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PRODUCT_STATUS_LABELS } from "./labels"

type BrandOption = { id: string; brandCode: string; brandName: string }
type CategoryOption = {
  id: string
  categoryCode: string
  categoryName: string
}

type Props = {
  brands: BrandOption[]
  categories: CategoryOption[]
}

export function ProductsSearch({ brands, categories }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const [brandId, setBrandId] = useState(searchParams.get("brandId") ?? "_all")
  const [categoryId, setCategoryId] = useState(
    searchParams.get("categoryId") ?? "_all",
  )
  const [status, setStatus] = useState(searchParams.get("status") ?? "_all")
  const [season, setSeason] = useState(searchParams.get("season") ?? "")

  const apply = (next: {
    q?: string
    brandId?: string
    categoryId?: string
    status?: string
    season?: string
  }) => {
    const params = new URLSearchParams(searchParams.toString())
    const setParam = (key: string, value: string | undefined) => {
      if (!value || value === "" || value === "_all") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    setParam("q", next.q ?? q)
    setParam("brandId", next.brandId ?? brandId)
    setParam("categoryId", next.categoryId ?? categoryId)
    setParam("status", next.status ?? status)
    setParam("season", next.season ?? season)
    params.delete("page")
    startTransition(() => {
      router.push(`/products?${params.toString()}`)
    })
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    apply({})
  }

  const onReset = () => {
    setQ("")
    setBrandId("_all")
    setCategoryId("_all")
    setStatus("_all")
    setSeason("")
    startTransition(() => {
      router.push("/products")
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[220px]">
        <label className="text-xs text-muted-foreground mb-1 block">検索</label>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="社内品番・商品名・先方品番"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      <div className="w-[200px]">
        <label className="text-xs text-muted-foreground mb-1 block">
          ブランド
        </label>
        <Select
          value={brandId}
          onValueChange={(v) => {
            setBrandId(v)
            apply({ brandId: v })
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">すべて</SelectItem>
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
      </div>
      <div className="w-[200px]">
        <label className="text-xs text-muted-foreground mb-1 block">
          カテゴリ
        </label>
        <Select
          value={categoryId}
          onValueChange={(v) => {
            setCategoryId(v)
            apply({ categoryId: v })
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">すべて</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="font-mono text-xs text-muted-foreground mr-2">
                  {c.categoryCode}
                </span>
                {c.categoryName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-[140px]">
        <label className="text-xs text-muted-foreground mb-1 block">
          シーズン
        </label>
        <Input
          placeholder="26SS"
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          className="font-mono"
        />
      </div>
      <div className="w-[180px]">
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
            {Object.entries(PRODUCT_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k as ProductStatus}>
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
