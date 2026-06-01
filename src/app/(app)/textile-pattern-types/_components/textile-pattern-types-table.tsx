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
import { TextilePatternTypeActions } from "./textile-pattern-type-delete-button"
import {
  TEXTILE_PATTERN_TYPE_STATUS_LABELS,
  TEXTILE_PATTERN_TYPE_STATUS_BADGE_VARIANT,
} from "./labels"
import type { TextilePatternTypeStatusValue } from "@/lib/validators/textile-pattern-type"

type PatternTypeRow = {
  id: string
  typeCode: string
  typeName: string
  description: string | null
  sortOrder: number
  status: string
}

export function TextilePatternTypesTable({
  items,
  isMasterAdmin,
}: {
  items: PatternTypeRow[]
  isMasterAdmin: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        柄種別がありません。新規作成ボタンから登録してください。
      </div>
    )
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>柄種別名</TableHead>
            <TableHead className="w-[120px]">コード</TableHead>
            <TableHead>説明</TableHead>
            <TableHead className="w-[80px]">表示順</TableHead>
            <TableHead className="w-[100px]">ステータス</TableHead>
            <TableHead className="w-[120px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c) => {
            const status = c.status as TextilePatternTypeStatusValue
            return (
              <TableRow key={c.id}>
                <TableCell>
                  <Link
                    href={`/textile-pattern-types/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.typeName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">
                    {c.typeCode}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.description ? (
                    <span className="line-clamp-1">{c.description}</span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {c.sortOrder}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      TEXTILE_PATTERN_TYPE_STATUS_BADGE_VARIANT[status]
                    }
                  >
                    {TEXTILE_PATTERN_TYPE_STATUS_LABELS[status]}
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
                      <Link href={`/textile-pattern-types/${c.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <TextilePatternTypeActions
                      id={c.id}
                      name={c.typeName}
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
