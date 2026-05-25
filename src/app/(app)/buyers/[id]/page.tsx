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
import { getBuyer } from "@/lib/actions/buyers"
import { BuyerActions } from "../_components/buyer-delete-button"
import {
  BUYER_STATUS_LABELS,
  BUYER_STATUS_BADGE_VARIANT,
  COUNTRY_OPTIONS,
} from "../_components/labels"

type Params = Promise<{ id: string }>

const countryLabel = (v: string) =>
  COUNTRY_OPTIONS.find((o) => o.value === v)?.label ?? v

export default async function BuyerDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const result = await getBuyer(id)
  if (!result.ok) {
    notFound()
  }
  const item = result.data

  // MASTER_ADMIN 判定
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
          <Link href="/buyers">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {item.buyerName}
              </h1>
              <Badge variant={BUYER_STATUS_BADGE_VARIANT[item.status]}>
                {BUYER_STATUS_LABELS[item.status]}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono">{item.buyerCode}</span>
              {item.buyerNameEn && (
                <>
                  <span>·</span>
                  <span>{item.buyerNameEn}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/buyers/${id}/edit`}>
                <Pencil className="mr-1 h-4 w-4" />
                編集
              </Link>
            </Button>
            <BuyerActions
              id={item.id}
              buyerName={item.buyerName}
              status={item.status}
              isMasterAdmin={isMasterAdmin}
            />
          </div>
        </div>
      </div>

      {/* 関連クライアント */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">関連クライアント</CardTitle>
        </CardHeader>
        <CardContent>
          {item.client ? (
            <Link
              href={`/clients/${item.client.id}`}
              className="inline-flex items-center gap-2 hover:underline"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {item.client.clientCode}
              </span>
              <span className="font-medium">{item.client.companyName}</span>
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">指定なし</span>
          )}
        </CardContent>
      </Card>

      {/* 連絡先 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">連絡先</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow label="国" value={countryLabel(item.country)} />
          <DetailRow label="郵便番号" value={item.postalCode ?? "—"} />
          <DetailRow label="都道府県" value={item.prefecture ?? "—"} />
          <DetailRow label="市区町村" value={item.city ?? "—"} />
          <DetailRow label="住所" value={item.address ?? "—"} />
          <DetailRow label="建物・部屋番号" value={item.addressLine2 ?? "—"} />
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

      {/* 関連納品先（Phase 1A-10 完成時に追加予定） */}
      {/*
        Phase 1A-10（DeliveryDestination）完成時、以下のセクションを追加：
        - listDeliveryDestinations({ buyerId: id })
        - 「納品先を追加」ボタン → /delivery-destinations/new?buyerId=<id>
      */}

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
