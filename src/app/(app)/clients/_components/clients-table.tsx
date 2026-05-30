import Link from "next/link"
import type { Client } from "@prisma/client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Pencil } from "lucide-react"

import {
  BUSINESS_TYPE_LABEL,
  STATUS_LABEL,
  STATUS_BADGE_VARIANT,
} from "./labels"
import { ClientActions } from "./client-delete-button"

type Props = {
  items: Client[]
  isMasterAdmin: boolean
}

export function ClientsTable({ items, isMasterAdmin }: Props) {
  if (items.length === 0) {
    return (
      <div className="border rounded-md py-16 text-center text-sm text-muted-foreground">
        該当するクライアントがありません
      </div>
    )
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>会社名</TableHead>
            <TableHead>コード</TableHead>
            <TableHead>業態</TableHead>
            <TableHead>国</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead className="w-32 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/clients/${c.id}`}
                  className="hover:underline"
                >
                  {c.companyName}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs">
                <Link
                  href={`/clients/${c.id}`}
                  className="hover:underline"
                >
                  {c.clientCode}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                {BUSINESS_TYPE_LABEL[c.businessType]}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {c.country}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_BADGE_VARIANT[c.status]}>
                  {STATUS_LABEL[c.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button asChild variant="ghost" size="icon">
                    <Link href={`/clients/${c.id}/edit`}>
                      <Pencil className="size-4" />
                      <span className="sr-only">編集</span>
                    </Link>
                  </Button>
                  <ClientActions
                    id={c.id}
                    name={c.companyName}
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
