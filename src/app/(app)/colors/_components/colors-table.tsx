import Link from "next/link"
import { Pencil } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ColorActions } from "./color-delete-button"
import { ColorSwatch } from "./color-swatch"
import {
  COLOR_STATUS_LABELS,
  COLOR_STATUS_BADGE_VARIANT,
  HUE_GROUP_LABELS,
} from "./labels"
import type { ColorStatusValue } from "@/lib/validators/color"

type ColorRow = {
  id: string
  colorNumber: string
  colorName: string
  hueGroup: number
  toneStep: number
  cmyk: string
  hex: string
  impression: string | null
  status: string
}

export function ColorsTable({
  items,
  isMasterAdmin,
}: {
  items: ColorRow[]
  isMasterAdmin: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        色がありません。新規作成ボタンから登録してください。
      </div>
    )
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">見本</TableHead>
            <TableHead>色名</TableHead>
            <TableHead className="w-[80px]">番号</TableHead>
            <TableHead>色相系統</TableHead>
            <TableHead className="w-[140px]">CMYK</TableHead>
            <TableHead className="w-[100px]">HEX</TableHead>
            <TableHead className="w-[100px]">ステータス</TableHead>
            <TableHead className="w-[120px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c) => {
            const status = c.status as ColorStatusValue
            const isUndefined = c.colorNumber === "00"
            return (
              <TableRow key={c.id}>
                <TableCell>
                  <ColorSwatch
                    colorNumber={c.colorNumber}
                    hex={c.hex}
                    size="md"
                  />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/colors/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.colorName}
                  </Link>
                  {isUndefined && (
                    <div className="text-xs text-muted-foreground">
                      マルチ／プリント
                    </div>
                  )}
                  {!isUndefined && c.impression && (
                    <div className="text-xs text-muted-foreground">
                      {c.impression}
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-mono">{c.colorNumber}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {c.hueGroup}: {HUE_GROUP_LABELS[c.hueGroup] ?? "—"}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {c.cmyk || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {c.hex || <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <Badge variant={COLOR_STATUS_BADGE_VARIANT[status]}>
                    {COLOR_STATUS_LABELS[status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      aria-label="編集"
                    >
                      <Link href={`/colors/${c.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <ColorActions
                      id={c.id}
                      name={c.colorName}
                      status={status}
                      isMasterAdmin={isMasterAdmin}
                      variant="icon"
                    />
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
