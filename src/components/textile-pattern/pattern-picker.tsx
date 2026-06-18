"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { TextilePatternOption } from "@/lib/types/textile-pattern"

/**
 * B-066-③: 柄ピッカー（検索 + リスト）。
 * - color-picker と同じ「props で配列を受け取る・自前 fetch しない」方式。
 * - 検索: patternNumber(D#) / patternName / typeName の部分一致。
 * - 柄プレビューは作らない（構成色を持たない＝spec §7）。D#（mono）＋柄名＋種別バッジのみ。
 * - 選択で onChange(patternId) を返す。null（柄なし=単色）も許容。
 */
export function PatternPicker({
  value,
  patterns,
  onChange,
}: {
  value: string | null
  patterns: TextilePatternOption[]
  onChange: (patternId: string | null) => void
}) {
  const [q, setQ] = useState("")

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (term === "") return patterns
    return patterns.filter(
      (p) =>
        p.patternNumber.toLowerCase().includes(term) ||
        p.patternName.toLowerCase().includes(term) ||
        (p.typeName ?? "").toLowerCase().includes(term),
    )
  }, [q, patterns])

  return (
    <div className="space-y-2">
      <Input
        placeholder="柄番号(D#) or 柄名 or 種別で検索"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-8"
      />

      <div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`rounded border px-2 py-1 text-xs ${
            value === null
              ? "border-primary ring-1 ring-primary"
              : "border-muted-foreground/30"
          }`}
        >
          柄なし（単色）
        </button>
      </div>

      <div className="max-h-[260px] space-y-1 overflow-y-auto pr-1">
        {filtered.map((p) => {
          const sel = value === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-sm ${
                sel
                  ? "border-primary ring-1 ring-primary"
                  : "border-transparent hover:border-muted-foreground/40"
              }`}
            >
              <span className="font-mono text-xs">{p.patternNumber}</span>
              <span className="flex-1 truncate">{p.patternName}</span>
              {p.typeName && (
                <Badge variant="outline" className="text-[10px]">
                  {p.typeName}
                </Badge>
              )}
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div className="py-4 text-center text-xs text-muted-foreground">
            該当なし（柄マスターに登録すると選べます）
          </div>
        )}
      </div>
    </div>
  )
}
