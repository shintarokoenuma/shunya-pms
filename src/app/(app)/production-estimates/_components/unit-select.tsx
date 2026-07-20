"use client"

import { useState } from "react"
import { PE_UNIT_OPTIONS } from "@/lib/constants/production-estimate-types"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const OTHER = "__other__"

/**
 * PE 明細行の単位入力。候補プルダウン＋「その他…」自由入力フォールバック。
 * 既存値が候補外なら自動で自由入力モードで開始（既存データを壊さない）。
 */
export function UnitSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const inList = value !== "" && PE_UNIT_OPTIONS.includes(value)
  const [manual, setManual] = useState(value !== "" && !inList)

  if (manual) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoComplete="off"
          placeholder="単位を入力"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="shrink-0 text-[10px] text-primary hover:underline"
          onClick={() => {
            setManual(false)
            onChange("")
          }}
        >
          候補
        </button>
      </div>
    )
  }

  return (
    <Select
      value={inList ? value : undefined}
      onValueChange={(v) => {
        if (v === OTHER) {
          setManual(true)
          onChange("")
        } else {
          onChange(v)
        }
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="単位" />
      </SelectTrigger>
      <SelectContent position="popper">
        {PE_UNIT_OPTIONS.map((u) => (
          <SelectItem key={u} value={u}>
            {u}
          </SelectItem>
        ))}
        <SelectItem value={OTHER}>その他…</SelectItem>
      </SelectContent>
    </Select>
  )
}
