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
import type { MaterialCategoryStatus } from "@prisma/client"
import { MaterialCategoryActions } from "./material-category-delete-button"
import {
  MATERIAL_CATEGORY_STATUS_LABELS,
  MATERIAL_CATEGORY_STATUS_BADGE_VARIANT,
  MATERIAL_CATEGORY_LEVEL_LABELS,
} from "./labels"

type MaterialCategoryRow = {
  id: string
  categoryCode: string
  categoryName: string
  categoryNameEn: string | null
  level: number
  status: MaterialCategoryStatus
  parent: {
    id: string
    categoryCode: string
    categoryName: string
    level: number
  } | null
}

export function MaterialCategoriesTable({
  items,
  isMasterAdmin,
}: {
  items: MaterialCategoryRow[]
  isMasterAdmin: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        素材カテゴリがありません。新規作成ボタンから登録してください。
      </div>
    )
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">コード</TableHead>
            <TableHead>カテゴリ名</TableHead>
            <TableHead className="w-[100px]">階層</TableHead>
            <TableHead>親カテゴリ</TableHead>
            <TableHead className="w-[100px]">ステータス</TableHead>
            <TableHead className="w-[120px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c) => {
            const levelLabel =
              c.level === 1 || c.level === 2 || c.level === 3
                ? MATERIAL_CATEGORY_LEVEL_LABELS[c.level as 1 | 2 | 3]
                : `レベル ${c.level}`
            return (
              <TableRow key={c.id}>
                <TableCell className="font-mono">{c.categoryCode}</TableCell>
                <TableCell>
                  <Link
                    href={`/material-categories/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.categoryName}
                  </Link>
                  {c.categoryNameEn && (
                    <div className="text-xs text-muted-foreground">
                      {c.categoryNameEn}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {levelLabel}
                  </Badge>
                </TableCell>
                <TableCell>
                  {c.parent ? (
                    <span className="text-sm">
                      <span className="font-mono text-xs text-muted-foreground">
                        {c.parent.categoryCode}
                      </span>{" "}
                      {c.parent.categoryName}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={MATERIAL_CATEGORY_STATUS_BADGE_VARIANT[c.status]}
                  >
                    {MATERIAL_CATEGORY_STATUS_LABELS[c.status]}
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
                      <Link href={`/material-categories/${c.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <MaterialCategoryActions
                      id={c.id}
                      name={c.categoryName}
                      status={c.status}
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
