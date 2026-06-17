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
import { TextilePatternActions } from "./textile-pattern-delete-button"
import {
  TEXTILE_PATTERN_STATUS_LABELS,
  TEXTILE_PATTERN_STATUS_BADGE_VARIANT,
} from "./labels"
import type {
  TextilePatternRow,
  TextilePatternStatusValue,
} from "@/lib/types/textile-pattern"

export function TextilePatternsTable({
  items,
  isMasterAdmin,
}: {
  items: TextilePatternRow[]
  isMasterAdmin: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        柄がありません。新規作成ボタンから登録してください。
      </div>
    )
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[110px]">柄番号(D#)</TableHead>
            <TableHead>柄名</TableHead>
            <TableHead className="w-[140px]">種別</TableHead>
            <TableHead className="w-[80px]">表示順</TableHead>
            <TableHead className="w-[100px]">ステータス</TableHead>
            <TableHead className="w-[120px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c) => {
            const status = c.status as TextilePatternStatusValue
            return (
              <TableRow key={c.id}>
                <TableCell>
                  <Link
                    href={`/textile-patterns/${c.id}`}
                    className="font-mono font-medium hover:underline"
                  >
                    {c.patternNumber}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{c.patternName}</TableCell>
                <TableCell className="text-sm">
                  {c.typeName ? (
                    <Badge variant="outline" className="text-xs">
                      {c.typeName}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {c.sortOrder}
                </TableCell>
                <TableCell>
                  <Badge variant={TEXTILE_PATTERN_STATUS_BADGE_VARIANT[status]}>
                    {TEXTILE_PATTERN_STATUS_LABELS[status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button asChild variant="ghost" size="icon" aria-label="編集">
                      <Link href={`/textile-patterns/${c.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <TextilePatternActions
                      id={c.id}
                      name={c.patternName}
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
