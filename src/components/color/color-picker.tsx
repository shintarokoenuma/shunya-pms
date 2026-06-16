"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import type { ColorPickerOption } from "@/lib/types/color"

/**
 * B-063: ハイブリッド カラーピッカー（検索 + スウォッチグリッド）。
 * - 検索: color_number / color_name の部分一致（type-to-filter）。
 * - グリッド: hue_group ごとに行を分け、各行内は tone_step 昇順。
 * - 「00 カラー未定」は盤面に混ぜず別枠ボタン。
 * - 選択で onChange(colorId, hex) を返す。colorId 未選択（null）も許容＝手入力 colorHex 運用を奪わない。
 */

const HUE_LABELS: Record<number, string> = {
  0: "グレー（明）",
  1: "レッド",
  2: "オレンジ",
  3: "イエロー",
  4: "グリーン",
  5: "ブルー",
  6: "パープル",
  7: "ピンク",
  8: "ブラウン",
  9: "グレー（暗）",
}

export function ColorPicker({
  value,
  colors,
  onChange,
}: {
  value: string | null
  colors: ColorPickerOption[]
  onChange: (colorId: string | null, hex: string | null) => void
}) {
  const [q, setQ] = useState("")

  const undefinedColor = colors.find((c) => c.colorNumber === "00") ?? null

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    const filtered = colors
      .filter((c) => c.colorNumber !== "00")
      .filter(
        (c) =>
          term === "" ||
          c.colorNumber.toLowerCase().includes(term) ||
          c.colorName.toLowerCase().includes(term),
      )
    const byHue = new Map<number, ColorPickerOption[]>()
    for (const c of filtered) {
      const arr = byHue.get(c.hueGroup)
      if (arr) arr.push(c)
      else byHue.set(c.hueGroup, [c])
    }
    return [...byHue.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([hue, items]) => ({
        hue,
        items: items.sort((a, b) => a.toneStep - b.toneStep),
      }))
  }, [q, colors])

  return (
    <div className="space-y-2">
      <Input
        placeholder="番号 or 色名で検索（例: 57 / ネイビー）"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-8"
      />

      <div>
        <button
          type="button"
          onClick={() => onChange(undefinedColor?.id ?? null, null)}
          className={`rounded border px-2 py-1 text-xs ${
            value && undefinedColor && value === undefinedColor.id
              ? "border-primary ring-1 ring-primary"
              : "border-muted-foreground/30"
          }`}
        >
          00 カラー未定
        </button>
      </div>

      <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
        {groups.map((g) => (
          <div key={g.hue}>
            <div className="text-[10px] text-muted-foreground">
              {g.hue}: {HUE_LABELS[g.hue] ?? ""}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((c) => {
                const sel = value === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={`${c.colorNumber} ${c.colorName}`}
                    onClick={() => onChange(c.id, c.hex)}
                    className={`flex w-[64px] flex-col items-center rounded border p-1 ${
                      sel
                        ? "border-primary ring-1 ring-primary"
                        : "border-transparent hover:border-muted-foreground/40"
                    }`}
                  >
                    <span
                      className="block h-6 w-full rounded border"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span className="mt-0.5 font-mono text-[9px] leading-tight">
                      {c.colorNumber}
                    </span>
                    <span className="block w-full truncate text-[9px] leading-tight text-muted-foreground">
                      {c.colorName}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="py-4 text-center text-xs text-muted-foreground">
            該当なし
          </div>
        )}
      </div>
    </div>
  )
}
