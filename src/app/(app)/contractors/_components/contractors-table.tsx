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
import type {
  ContractorStatus,
  ContractorSpecialty,
  ContractorContractType,
} from "@prisma/client"
import { ContractorActions } from "./contractor-delete-button"
import {
  CONTRACTOR_STATUS_LABELS,
  CONTRACTOR_STATUS_BADGE_VARIANT,
  CONTRACTOR_SPECIALTY_LABELS,
  CONTRACTOR_CONTRACT_TYPE_LABELS,
} from "./labels"

type ContractorRow = {
  id: string
  contractorCode: string
  contractorName: string
  contractorNameEn: string | null
  isIndividual: boolean
  specialties: ContractorSpecialty[]
  contractType: ContractorContractType
  country: string
  status: ContractorStatus
}

export function ContractorsTable({
  items,
  isMasterAdmin,
}: {
  items: ContractorRow[]
  isMasterAdmin: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        外注先がありません。新規作成ボタンから登録してください。
      </div>
    )
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>外注先名</TableHead>
            <TableHead className="w-[100px]">コード</TableHead>
            <TableHead className="w-[90px]">区分</TableHead>
            <TableHead>専門分野</TableHead>
            <TableHead className="w-[140px]">契約形態</TableHead>
            <TableHead className="w-[80px]">国</TableHead>
            <TableHead className="w-[100px]">ステータス</TableHead>
            <TableHead className="w-[120px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link
                  href={`/contractors/${c.id}`}
                  className="font-medium hover:underline"
                >
                  {c.contractorName}
                </Link>
                {c.contractorNameEn && (
                  <div className="text-xs text-muted-foreground">
                    {c.contractorNameEn}
                  </div>
                )}
              </TableCell>
              <TableCell className="font-mono">{c.contractorCode}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs">
                  {c.isIndividual ? "個人" : "法人"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {c.specialties.length > 0 ? (
                    c.specialties.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs">
                        {CONTRACTOR_SPECIALTY_LABELS[s]}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">未設定</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {CONTRACTOR_CONTRACT_TYPE_LABELS[c.contractType]}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{c.country}</TableCell>
              <TableCell>
                <Badge variant={CONTRACTOR_STATUS_BADGE_VARIANT[c.status]}>
                  {CONTRACTOR_STATUS_LABELS[c.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button asChild variant="ghost" size="icon" aria-label="編集">
                    <Link href={`/contractors/${c.id}/edit`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <ContractorActions
                    id={c.id}
                    name={c.contractorName}
                    status={c.status}
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
