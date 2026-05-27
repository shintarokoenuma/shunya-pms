import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, Pencil } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getDeliveryDestination } from "@/lib/actions/delivery-destinations"
import { DeliveryDestinationActions } from "../_components/delivery-destination-delete-button"
import {
  DELIVERY_DESTINATION_STATUS_LABELS,
  DELIVERY_DESTINATION_STATUS_BADGE_VARIANT,
  COUNTRY_OPTIONS,
  TIMEZONE_OPTIONS,
} from "../_components/labels"

type Params = Promise<{ id: string }>

const countryLabel = (v: string) =>
  COUNTRY_OPTIONS.find((o) => o.value === v)?.label ?? v

const timezoneLabel = (v: string | null) => {
  if (!v) return "—"
  return TIMEZONE_OPTIONS.find((o) => o.value === v)?.label ?? v
}

export default async function DeliveryDestinationDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const result = await getDeliveryDestination(id)
  if (!result.ok) {
    notFound()
  }
  const item = result.data

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { tenantType: true },
  })
  const isMasterAdmin = company?.tenantType === "MASTER_ADMIN"

  return (
    <div className="space-y-6 p-6">
      {/* ヘッダー */}
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/delivery-destinations">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {item.destinationName}
              </h1>
              <Badge
                variant={DELIVERY_DESTINATION_STATUS_BADGE_VARIANT[item.status]}
              >
                {DELIVERY_DESTINATION_STATUS_LABELS[item.status]}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono">{item.destinationCode}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/delivery-destinations/${id}/edit`}>
                <Pencil className="mr-1 h-4 w-4" />
                編集
              </Link>
            </Button>
            <DeliveryDestinationActions
              id={item.id}
              destinationName={item.destinationName}
              status={item.status}
              isMasterAdmin={isMasterAdmin}
            />
          </div>
        </div>
      </div>

      {/* 関連バイヤー / クライアント */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">関連バイヤー</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link
            href={`/buyers/${item.buyer.id}`}
            className="inline-flex items-center gap-2 hover:underline"
          >
            <span className="font-mono text-xs text-muted-foreground">
              {item.buyer.buyerCode}
            </span>
            <span className="font-medium">{item.buyer.buyerName}</span>
          </Link>
          {item.buyer.client && (
            <div className="text-sm text-muted-foreground">
              クライアント:{" "}
              <Link
                href={`/clients/${item.buyer.client.id}`}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <span className="font-mono text-xs">
                  {item.buyer.client.clientCode}
                </span>
                <span>{item.buyer.client.companyName}</span>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 住所 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">住所</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow label="国" value={countryLabel(item.country)} />
          <DetailRow label="郵便番号" value={item.postalCode ?? "—"} />
          <DetailRow label="都道府県" value={item.prefecture ?? "—"} />
          <DetailRow label="市区町村" value={item.city ?? "—"} />
          <DetailRow label="住所" value={item.address ?? "—"} />
          <DetailRow label="建物・部屋番号" value={item.addressLine2 ?? "—"} />
        </CardContent>
      </Card>

      {/* 連絡先 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">連絡先</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow label="担当者名" value={item.contactPerson ?? "—"} />
          <DetailRow label="電話" value={item.phone ?? "—"} />
          <DetailRow
            label="メール"
            value={
              item.email ? (
                <a
                  href={`mailto:${item.email}`}
                  className="text-primary underline"
                >
                  {item.email}
                </a>
              ) : (
                "—"
              )
            }
          />
        </CardContent>
      </Card>

      {/* 配送指示 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">配送指示</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow
            label="配送メモ"
            value={
              item.deliveryNotes ? (
                <p className="whitespace-pre-wrap">{item.deliveryNotes}</p>
              ) : (
                "—"
              )
            }
          />
          <DetailRow
            label="希望納品曜日"
            value={item.preferredDeliveryDays ?? "—"}
          />
          <DetailRow
            label="希望納品時間帯"
            value={item.preferredDeliveryHours ?? "—"}
          />
          <DetailRow label="タイムゾーン" value={timezoneLabel(item.timezone)} />
        </CardContent>
      </Card>

      {/* メモ */}
      {item.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">メモ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{item.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* メタ情報 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">メタ情報</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow
            label="作成日時"
            value={new Date(item.createdAt).toLocaleString("ja-JP")}
          />
          <DetailRow
            label="最終更新"
            value={new Date(item.updatedAt).toLocaleString("ja-JP")}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm py-1">
      <div className="text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  )
}
