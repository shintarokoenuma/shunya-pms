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
import type { FactoryStatus, FactoryType } from "@prisma/client"
import { FactoryActions } from "./factory-delete-button"
import {
  FACTORY_STATUS_LABELS,
  FACTORY_STATUS_BADGE_VARIANT,
  FACTORY_TYPE_LABELS,
} from "./labels"

type FactoryRow = {
  id: string
  factoryCode: string
  factoryName: string
  factoryNameEn: string | null
  factoryTypes: FactoryType[]
  country: string
  status: FactoryStatus
}

export function FactoriesTable({
  items,
  isMasterAdmin,
}: {
  items: FactoryRow[]
  isMasterAdmin: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        工場がありません。新規作成ボタンから登録してください。
      </div>
    )
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>工場名</TableHead>
            <TableHead className="w-[100px]">コード</TableHead>
            <TableHead>工場タイプ</TableHead>
            <TableHead className="w-[80px]">国</TableHead>
            <TableHead className="w-[100px]">ステータス</TableHead>
            <TableHead className="w-[120px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((f) => (
            <TableRow key={f.id}>
              <TableCell>
                <Link
                  href={`/factories/${f.id}`}
                  className="font-medium hover:underline"
                >
                  {f.factoryName}
                </Link>
                {f.factoryNameEn && (
                  <div className="text-xs text-muted-foreground">
                    {f.factoryNameEn}
                  </div>
                )}
              </TableCell>
              <TableCell className="font-mono">{f.factoryCode}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {f.factoryTypes.length > 0 ? (
                    f.factoryTypes.map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">
                        {FACTORY_TYPE_LABELS[t]}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">未設定</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm">{f.country}</TableCell>
              <TableCell>
                <Badge variant={FACTORY_STATUS_BADGE_VARIANT[f.status]}>
                  {FACTORY_STATUS_LABELS[f.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button asChild variant="ghost" size="icon" aria-label="編集">
                    <Link href={`/factories/${f.id}/edit`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <FactoryActions
                    id={f.id}
                    name={f.factoryName}
                    status={f.status}
                    isMasterAdmin={isMasterAdmin}
                    variant="icon"
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
