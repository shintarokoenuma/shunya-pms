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
import type { SampleProductionListItem } from "@/lib/actions/sample-productions"
import { primaryProductCode } from "@/lib/utils/product-code"
import {
  SAMPLE_STATUS_LABELS,
  SAMPLE_STATUS_BADGE_VARIANT,
  SAMPLE_ROUND_LABELS,
  SAMPLE_ROUND_BADGE_VARIANT,
} from "./labels"

type Props = {
  items: SampleProductionListItem[]
  /** Product 詳細など、品番列を出さない場面で false */
  showProduct?: boolean
}

export function SampleProductionsTable({ items, showProduct = true }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        サンプル製作セットがありません
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">SP番号</TableHead>
            <TableHead>タイトル</TableHead>
            {showProduct && <TableHead className="w-[200px]">対象品番</TableHead>}
            <TableHead className="w-[90px]">ラウンド</TableHead>
            <TableHead className="w-[70px]">数量</TableHead>
            <TableHead className="w-[150px]">ステータス</TableHead>
            <TableHead className="w-[70px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-sm">
                {item.sampleNumber}
              </TableCell>
              <TableCell>
                <div className="font-medium">
                  {item.title ?? (
                    <span className="text-muted-foreground">（無題）</span>
                  )}
                </div>
              </TableCell>
              {showProduct && (
                <TableCell className="text-sm">
                  {item.product ? (
                    <Link
                      href={`/products/${item.product.id}`}
                      className="hover:underline"
                    >
                      <span className="font-mono">
                        {primaryProductCode(item.product)}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {item.product.productName}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              )}
              <TableCell>
                <Badge variant={SAMPLE_ROUND_BADGE_VARIANT[item.sampleRound]}>
                  {SAMPLE_ROUND_LABELS[item.sampleRound]}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{item.sampleQuantity}</TableCell>
              <TableCell>
                <Badge variant={SAMPLE_STATUS_BADGE_VARIANT[item.status]}>
                  {SAMPLE_STATUS_LABELS[item.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <Link
                  href={`/samples/${item.id}`}
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
