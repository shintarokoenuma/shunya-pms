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
  CONTRACTOR_STATUS_LABELS,
  CONTRACTOR_SPECIALTY_OPTIONS,
  CONTRACTOR_CONTRACT_TYPE_OPTIONS,
} from "./labels"

export function ContractorsSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const [status, setStatus] = useState(searchParams.get("status") ?? "_all")
  const [specialty, setSpecialty] = useState(
    searchParams.get("specialty") ?? "_all"
  )
  const [contractType, setContractType] = useState(
    searchParams.get("contractType") ?? "_all"
  )
  const [isIndividual, setIsIndividual] = useState(
    searchParams.get("isIndividual") ?? "_all"
  )

  const apply = (next: {
    q?: string
    status?: string
    specialty?: string
    contractType?: string
    isIndividual?: string
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
    setParam("status", next.status ?? status)
    setParam("specialty", next.specialty ?? specialty)
    setParam("contractType", next.contractType ?? contractType)
    setParam("isIndividual", next.isIndividual ?? isIndividual)
    params.delete("page")
    startTransition(() => {
      router.push(`/contractors?${params.toString()}`)
    })
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    apply({})
  }

  const onReset = () => {
    setQ("")
    setStatus("_all")
    setSpecialty("_all")
    setContractType("_all")
    setIsIndividual("_all")
    startTransition(() => {
      router.push("/contractors")
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <label className="text-xs text-muted-foreground mb-1 block">検索</label>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="外注先名・コード"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      <div className="w-[180px]">
        <label className="text-xs text-muted-foreground mb-1 block">専門分野</label>
        <Select
          value={specialty}
          onValueChange={(v) => {
            setSpecialty(v)
            apply({ specialty: v })
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">すべて</SelectItem>
            {CONTRACTOR_SPECIALTY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-[160px]">
        <label className="text-xs text-muted-foreground mb-1 block">契約形態</label>
        <Select
          value={contractType}
          onValueChange={(v) => {
            setContractType(v)
            apply({ contractType: v })
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">すべて</SelectItem>
            {CONTRACTOR_CONTRACT_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-[140px]">
        <label className="text-xs text-muted-foreground mb-1 block">区分</label>
        <Select
          value={isIndividual}
          onValueChange={(v) => {
            setIsIndividual(v)
            apply({ isIndividual: v })
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">すべて</SelectItem>
            <SelectItem value="true">個人事業主</SelectItem>
            <SelectItem value="false">法人</SelectItem>
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
            {Object.entries(CONTRACTOR_STATUS_LABELS).map(([k, v]) => (
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
