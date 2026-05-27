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
  MATERIAL_STATUS_OPTIONS,
  MATERIAL_TYPE_OPTIONS,
} from "./labels"

type SupplierOption = {
  id: string
  supplierCode: string
  companyName: string
}

type Props = {
  suppliers: SupplierOption[]
}

const ALL_TYPE = "__all_type__"
const ALL_SUPPLIER = "__all_supplier__"

export function MaterialsSearch({ suppliers }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const [status, setStatus] = useState(searchParams.get("status") ?? "all")
  const [materialType, setMaterialType] = useState(
    searchParams.get("materialType") ?? ALL_TYPE,
  )
  const [primarySupplierId, setPrimarySupplierId] = useState(
    searchParams.get("primarySupplierId") ?? ALL_SUPPLIER,
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (status !== "all") params.set("status", status)
    if (materialType !== ALL_TYPE) params.set("materialType", materialType)
    if (primarySupplierId !== ALL_SUPPLIER)
      params.set("primarySupplierId", primarySupplierId)
    startTransition(() => {
      router.push(
        params.toString() ? `/materials?${params.toString()}` : "/materials",
      )
    })
  }

  const handleClear = () => {
    setQ("")
    setStatus("all")
    setMaterialType(ALL_TYPE)
    setPrimarySupplierId(ALL_SUPPLIER)
    startTransition(() => {
      router.push("/materials")
    })
  }

  const hasFilter =
    q.trim().length > 0 ||
    status !== "all" ||
    materialType !== ALL_TYPE ||
    primarySupplierId !== ALL_SUPPLIER

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="コード / 素材名 で検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={materialType} onValueChange={setMaterialType}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="タイプ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPE}>タイプ（全て）</SelectItem>
            {MATERIAL_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={primarySupplierId}
          onValueChange={setPrimarySupplierId}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="仕入先" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SUPPLIER}>仕入先（全て）</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="font-mono text-xs text-muted-foreground mr-2">
                  {s.supplierCode}
                </span>
                {s.companyName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ステータス（全て）</SelectItem>
            {MATERIAL_STATUS_OPTIONS.map((o) => (
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
