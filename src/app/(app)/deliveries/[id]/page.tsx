import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getDeliveryNote } from "@/lib/actions/delivery-notes"
import { DeliveryNoteStatusControl } from "../_components/delivery-note-status-control"
import { DeliveryNoteDeleteButton } from "../_components/delivery-note-delete-button"
import {
  DELIVERY_NOTE_STATUS_LABELS,
  DELIVERY_NOTE_STATUS_BADGE_VARIANT,
} from "../_components/labels"

type Params = Promise<{ id: string }>

function fmtDate(d: Date | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("ja-JP")
}

function fmtYen(n: unknown): string {
  if (n == null) return "—"
  const num = typeof n === "object" && "toNumber" in (n as object)
    ? (n as { toNumber: () => number }).toNumber()
    : Number(n)
  return `¥${num.toLocaleString("ja-JP")}`
}

export default async function DeliveryNoteDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const result = await getDeliveryNote(id)
  if (!result.ok) notFound()
  const dn = result.data
  const isDraft = dn.status === "DRAFT"

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/deliveries">
            <ChevronLeft className="mr-1 h-4 w-4" />
            納品書一覧へ
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold tracking-tight">
                {dn.deliveryNumber}
              </h1>
              <Badge variant={DELIVERY_NOTE_STATUS_BADGE_VARIANT[dn.status]}>
                {DELIVERY_NOTE_STATUS_LABELS[dn.status]}
              </Badge>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {dn.clientName ?? "（クライアント未設定）"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DeliveryNoteStatusControl id={dn.id} status={dn.status} />
            {isDraft && (
              <DeliveryNoteDeleteButton
                id={dn.id}
                deliveryNumber={dn.deliveryNumber}
              />
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">納品日: </span>
            {fmtDate(dn.deliveryDate)}
          </div>
          <div>
            <span className="text-muted-foreground">数量合計: </span>
            {dn.totalQuantity.toLocaleString("ja-JP")}
          </div>
          <div className="md:col-span-2">
            <span className="text-muted-foreground">送り先: </span>
            {dn.shipToAddress}
            {dn.shipToContact ? ` / ${dn.shipToContact}` : ""}
            {dn.shipToPhone ? ` / ${dn.shipToPhone}` : ""}
          </div>
          {dn.clientNotes && (
            <div className="md:col-span-2">
              <span className="text-muted-foreground">メモ: </span>
              {dn.clientNotes}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">明細</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>品名</TableHead>
                  <TableHead className="w-[120px]">先方品番</TableHead>
                  <TableHead className="w-[90px]">色</TableHead>
                  <TableHead className="w-[70px]">サイズ</TableHead>
                  <TableHead className="w-[80px] text-right">数量</TableHead>
                  <TableHead className="w-[70px]">単位</TableHead>
                  {dn.showAmounts && (
                    <>
                      <TableHead className="w-[110px] text-right">単価</TableHead>
                      <TableHead className="w-[110px] text-right">金額</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dn.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="text-sm">{it.productName}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {it.clientProductCode ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{it.colorName ?? "—"}</TableCell>
                    <TableCell className="text-sm">{it.size ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">
                      {it.quantity.toLocaleString("ja-JP")}
                    </TableCell>
                    <TableCell className="text-sm">{it.unit}</TableCell>
                    {dn.showAmounts && (
                      <>
                        <TableCell className="text-right text-sm">
                          {fmtYen(it.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {fmtYen(it.subtotal)}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {dn.showAmounts && (
            <div className="mt-3 flex flex-col items-end gap-1 text-sm">
              <div>
                <span className="text-muted-foreground mr-3">小計</span>
                {fmtYen(dn.subtotalAmount)}
              </div>
              <div>
                <span className="text-muted-foreground mr-3">消費税</span>
                {fmtYen(dn.taxAmount)}
              </div>
              <div className="font-medium">
                <span className="text-muted-foreground mr-3">合計</span>
                {fmtYen(dn.totalAmount)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
