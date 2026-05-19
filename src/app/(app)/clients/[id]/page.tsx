import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { prisma } from "@/lib/prisma"
import { getClient } from "@/lib/actions/clients"
import { listBrandsByClient } from "@/lib/actions/brands"
import { ClientActions } from "../_components/client-delete-button"
import { auth } from "@/lib/auth"
import { Plus } from "lucide-react"
import {
  BUSINESS_TYPE_LABEL,
  CLIENT_SIZE_LABEL,
  STATUS_LABEL,
  STATUS_BADGE_VARIANT,
  DISPLAY_PATTERN_LABEL,
  LEAD_SOURCE_LABEL,
  PAYMENT_TERM_LABEL,
} from "../_components/labels"
import {
  BRAND_STATUS_LABEL,
  BRAND_STATUS_BADGE_VARIANT,
} from "../../brands/_components/labels"

function Dl({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-[120px_1fr] gap-y-3 gap-x-4 text-sm">{children}</dl>
}

function Item({
  label,
  value,
  mono = false,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  const isEmpty = value === null || value === undefined || value === ""
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono" : ""}>
        {isEmpty ? <span className="text-muted-foreground">—</span> : value}
      </dd>
    </>
  )
}

function formatAddress(parts: {
  postalCode?: string | null
  prefecture?: string | null
  city?: string | null
  address?: string | null
  addressLine2?: string | null
}) {
  const lines: string[] = []
  if (parts.postalCode) lines.push(`〒${parts.postalCode}`)
  const main = [parts.prefecture, parts.city, parts.address]
    .filter(Boolean)
    .join(" ")
  if (main) lines.push(main)
  if (parts.addressLine2) lines.push(parts.addressLine2)
  return lines.length > 0 ? lines.join("\n") : null
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const isMasterAdmin = session?.user?.tenantType === "MASTER_ADMIN"
  const client = await getClient(id)

  if (!client) {
    notFound()
  }

  // このクライアントのブランド一覧を取得
  const brands = await listBrandsByClient(id)

  // shunya 側担当者の名前を取得
  const assignedUser = client.assignedToUserId
    ? await prisma.user.findUnique({
        where: { id: client.assignedToUserId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          email: true,
        },
      })
    : null

  const contact = client.contacts[0]
  const masterAddress = formatAddress({
    postalCode: client.postalCode,
    prefecture: client.prefecture,
    city: client.city,
    address: client.address,
    addressLine2: client.addressLine2,
  })
  const billingAddress = formatAddress({
    postalCode: client.billingPostalCode,
    prefecture: client.billingPrefecture,
    city: client.billingCity,
    address: client.billingAddress,
    addressLine2: client.billingAddressLine2,
  })
  const shippingAddress = formatAddress({
    postalCode: client.shippingPostalCode,
    prefecture: client.shippingPrefecture,
    city: client.shippingCity,
    address: client.shippingAddress,
    addressLine2: client.shippingAddressLine2,
  })

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/clients">
          <ChevronLeft className="mr-1 h-4 w-4" />
          クライアント一覧へ
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{client.companyName}</h1>
            <Badge variant={STATUS_BADGE_VARIANT[client.status]}>
              {STATUS_LABEL[client.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            {client.clientCode}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/clients/${id}/edit`}>
              <Pencil className="mr-1 h-4 w-4" />
              編集
            </Link>
          </Button>
          <ClientActions id={id} name={client.companyName} status={client.status} isMasterAdmin={isMasterAdmin} variant="menu" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 基本情報 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本情報</CardTitle>
          </CardHeader>
          <CardContent>
            <Dl>
              <Item label="クライアントコード" value={client.clientCode} mono />
              <Item label="会社名" value={client.companyName} />
              <Item label="法人格 / 正式名称" value={client.legalEntity} />
              <Item label="業態" value={BUSINESS_TYPE_LABEL[client.businessType]} />
              <Item
                label="規模"
                value={
                  client.clientSize ? CLIENT_SIZE_LABEL[client.clientSize] : null
                }
              />
            </Dl>
          </CardContent>
        </Card>

        {/* 連絡先 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">連絡先</CardTitle>
          </CardHeader>
          <CardContent>
            <Dl>
              <Item label="国" value={client.country} />
              <Item label="電話" value={client.phone} />
              <Item label="メール" value={client.email} />
              <Item
                label="Web"
                value={
                  client.website ? (
                    <a
                      href={client.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      {client.website}
                    </a>
                  ) : null
                }
              />
            </Dl>
          </CardContent>
        </Card>

        {/* マスター住所 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">マスター住所</CardTitle>
          </CardHeader>
          <CardContent>
            <Dl>
              <Item
                label="住所"
                value={
                  masterAddress ? (
                    <div className="whitespace-pre-line">{masterAddress}</div>
                  ) : null
                }
              />
            </Dl>
          </CardContent>
        </Card>

        {/* 取引条件 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">取引条件</CardTitle>
          </CardHeader>
          <CardContent>
            <Dl>
              <Item
                label="支払条件"
                value={PAYMENT_TERM_LABEL[client.paymentTermType]}
              />
              {client.paymentTermType === "MONTHLY_CLOSING" && (
                <>
                  <Item
                    label="締め日"
                    value={client.closingDay ? `${client.closingDay} 日` : null}
                  />
                  <Item
                    label="支払いサイト"
                    value={
                      client.paymentDays !== null
                        ? `${client.paymentDays} 日後`
                        : null
                    }
                  />
                </>
              )}
              {client.paymentTermType === "DEPOSIT_COD" && (
                <Item
                  label="デポジット比率"
                  value={
                    client.depositPercentage
                      ? `${Number(client.depositPercentage)} %`
                      : null
                  }
                />
              )}
              <Item label="表示パターン" value={DISPLAY_PATTERN_LABEL[client.displayPattern]} />
            </Dl>
          </CardContent>
        </Card>
      </div>

      {/* 請求書発送先住所（マスターと異なる場合のみ表示） */}
      {billingAddress && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">請求書発送先住所</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-line text-sm">{billingAddress}</div>
          </CardContent>
        </Card>
      )}

      {/* 商品配送先住所（マスターと異なる場合のみ表示） */}
      {shippingAddress && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">商品配送先住所</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-line text-sm">{shippingAddress}</div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* shunya 側担当者 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">shunya 側担当</CardTitle>
          </CardHeader>
          <CardContent>
            <Dl>
              <Item
                label="担当者"
                value={
                  assignedUser
                    ? assignedUser.displayName ??
                      `${assignedUser.lastName} ${assignedUser.firstName}`
                    : null
                }
              />
              <Item label="メール" value={assignedUser?.email ?? null} />
            </Dl>
          </CardContent>
        </Card>

        {/* 先方担当者（主担当） */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">先方担当者（主担当）</CardTitle>
          </CardHeader>
          <CardContent>
            <Dl>
              <Item
                label="氏名"
                value={
                  contact
                    ? `${contact.lastName} ${contact.firstName}`
                    : null
                }
              />
              <Item label="メール" value={contact?.email ?? null} />
              <Item label="電話" value={contact?.phone ?? null} />
              <Item label="部署" value={contact?.department ?? null} />
              <Item label="役職" value={contact?.jobTitle ?? null} />
            </Dl>
          </CardContent>
        </Card>

        {/* 営業情報 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">営業情報</CardTitle>
          </CardHeader>
          <CardContent>
            <Dl>
              <Item
                label="流入経路"
                value={
                  client.leadSource ? LEAD_SOURCE_LABEL[client.leadSource] : null
                }
              />
              <Item label="紹介者" value={client.referrer} />
              <Item label="案件数" value={client.inquiryCount} />
              <Item label="成約数" value={client.successfulCount} />
            </Dl>
          </CardContent>
        </Card>
      </div>

      {/* ブランド一覧 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">ブランド一覧</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href={`/brands/new?clientId=${id}`}>
              <Plus className="mr-1 h-4 w-4" />
              ブランド追加
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {brands.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              このクライアントにはまだブランドが登録されていません。
            </div>
          ) : (
            <div className="space-y-2">
              {brands.map((b) => (
                <Link
                  key={b.id}
                  href={`/brands/${b.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-muted-foreground">
                      {b.brandCode}
                    </span>
                    <span className="font-medium">{b.brandName}</span>
                    {b.brandNameEn && (
                      <span className="text-xs text-muted-foreground">
                        ({b.brandNameEn})
                      </span>
                    )}
                  </div>
                  <Badge variant={BRAND_STATUS_BADGE_VARIANT[b.status]}>
                    {BRAND_STATUS_LABEL[b.status]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {client.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">メモ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-line text-sm">{client.notes}</div>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground flex gap-6">
        <span>
          作成:{" "}
          {client.createdAt.toLocaleString("ja-JP", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
        <span>
          更新:{" "}
          {client.updatedAt.toLocaleString("ja-JP", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>
    </div>
  )
}
