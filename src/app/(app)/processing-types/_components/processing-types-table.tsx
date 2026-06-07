import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ProcessingTypeListItem } from "@/lib/actions/processing-types"
import {
  PROCESSING_TYPE_STATUS_LABELS,
  PROCESSING_TYPE_STATUS_BADGE_VARIANT,
} from "./labels"

type Props = {
  items: ProcessingTypeListItem[]
}

export function ProcessingTypesTable({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        加工種別がありません
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead className="w-[140px]">コード</TableHead>
            <TableHead className="w-[180px]">英語名</TableHead>
            <TableHead className="w-[90px]">並び順</TableHead>
            <TableHead className="w-[110px]">ステータス</TableHead>
            <TableHead className="w-[70px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="font-mono text-sm">{item.code}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {item.nameEn ?? "—"}
              </TableCell>
              <TableCell className="text-sm">{item.sortOrder}</TableCell>
              <TableCell>
                <Badge variant={PROCESSING_TYPE_STATUS_BADGE_VARIANT[item.status]}>
                  {PROCESSING_TYPE_STATUS_LABELS[item.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <Link
                  href={`/processing-types/${item.id}`}
                  className="inline-flex items-center text-sm text-primary hover:underline"
                >
                  詳細
                  <ChevronRight className="ml-0.5 h-4 w-4" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
