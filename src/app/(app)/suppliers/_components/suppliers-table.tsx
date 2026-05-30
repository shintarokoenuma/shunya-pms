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
import type { SupplierStatus, SupplierType } from "@prisma/client"
import { SupplierActions } from "./supplier-delete-button"
import {
  SUPPLIER_STATUS_LABELS,
  SUPPLIER_STATUS_BADGE_VARIANT,
  SUPPLIER_TYPE_LABELS,
} from "./labels"

type SupplierRow = {
  id: string
  supplierCode: string
  companyName: string
  companyNameEn: string | null
  supplierType: SupplierType[]
  country: string
  status: SupplierStatus
}

export function SuppliersTable({
  items,
  isMasterAdmin,
}: {
  items: SupplierRow[]
  isMasterAdmin: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        仕入先がありません。新規作成ボタンから登録してください。
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>会社名</TableHead>
            <TableHead className="w-[100px]">コード</TableHead>
            <TableHead>取扱品目</TableHead>
            <TableHead className="w-[80px]">国</TableHead>
            <TableHead className="w-[100px]">ステータス</TableHead>
            <TableHead className="w-[120px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <Link
                  href={`/suppliers/${s.id}`}
                  className="font-medium hover:underline"
                >
                  {s.companyName}
                </Link>
                {s.companyNameEn && (
                  <div className="text-xs text-muted-foreground">
                    {s.companyNameEn}
                  </div>
                )}
              </TableCell>
              <TableCell className="font-mono">{s.supplierCode}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {s.supplierType.length > 0 ? (
                    s.supplierType.map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">
                        {SUPPLIER_TYPE_LABELS[t]}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">未設定</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm">{s.country}</TableCell>
              <TableCell>
                <Badge variant={SUPPLIER_STATUS_BADGE_VARIANT[s.status]}>
                  {SUPPLIER_STATUS_LABELS[s.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button asChild variant="ghost" size="icon" aria-label="編集">
                    <Link href={`/suppliers/${s.id}/edit`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <SupplierActions
                    id={s.id}
                    name={s.companyName}
                    status={s.status}
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
