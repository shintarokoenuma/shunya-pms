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
import type { ModelCodeListItem } from "@/lib/actions/model-codes"
import {
  MODEL_CODE_STATUS_LABELS,
  MODEL_CODE_STATUS_BADGE_VARIANT,
} from "./labels"

type Props = {
  items: ModelCodeListItem[]
}

export function ModelCodesTable({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        型番がありません
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">モデルコード</TableHead>
            <TableHead>モデル名</TableHead>
            <TableHead className="w-[180px]">ブランド</TableHead>
            <TableHead className="w-[200px]">クライアント</TableHead>
            <TableHead className="w-[100px]">リピート</TableHead>
            <TableHead className="w-[110px]">ステータス</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-sm">
                {item.modelCode}
              </TableCell>
              <TableCell>
                <div className="font-medium">{item.modelName}</div>
                {item.modelNameEn && (
                  <div className="text-xs text-muted-foreground">
                    {item.modelNameEn}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {item.brand ? (
                  <span>
                    <span className="font-mono text-xs text-muted-foreground mr-1">
                      {item.brand.brandCode}
                    </span>
                    {item.brand.brandName}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {item.brand?.client ? (
                  <Link
                    href={`/clients/${item.brand.client.id}`}
                    className="hover:underline"
                  >
                    <span className="font-mono text-xs text-muted-foreground mr-1">
                      {item.brand.client.clientCode}
                    </span>
                    {item.brand.client.companyName}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {item.totalRepetitions} 回
              </TableCell>
              <TableCell>
                <Badge variant={MODEL_CODE_STATUS_BADGE_VARIANT[item.status]}>
                  {MODEL_CODE_STATUS_LABELS[item.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <Link
                  href={`/model-codes/${item.id}`}
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
