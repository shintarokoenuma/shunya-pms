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

import { getClient } from "@/lib/actions/clients"
import { ClientDeleteButton } from "../_components/client-delete-button"
import {
  BUSINESS_TYPE_LABEL,
  CLIENT_SIZE_LABEL,
  CLIENT_STATUS_LABEL,
  CLIENT_STATUS_VARIANT,
  DISPLAY_PATTERN_LABEL,
  LEAD_SOURCE_LABEL,
} from "../_components/labels"

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = await getClient(id)

  if (!client) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/clients">
          <ChevronLeft className="size-4" />
          クライアント一覧へ
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {client.companyName}
            </h1>
            <Badge variant={CLIENT_STATUS_VARIANT[client.status]}>
              {CLIENT_STATUS_LABEL[client.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono">
            {client.clientCode}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild variant="outline">
            <Link href={`/clients/${client.id}/edit`}>
              <Pencil className="size-4" />
              編集
            </Link>
          </Button>
          <ClientDeleteButton id={client.id} name={client.companyName} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本情報</CardTitle>
          </CardHeader>
          <CardContent>
            <Dl>
              <Item label="クライアントコード" value={client.clientCode} mono />
              <Item label="会社名" value={client.companyName} />
              <Item label="法人格 / 正式名称" value={client.legalEntity} />
              <Item
                label="業態"
                value={BUSINESS_TYPE_LABEL[client.businessType]}
              />
              <Item
                label="規模"
                value={
                  client.clientSize ? CLIENT_SIZE_LABEL[client.clientSize] : null
                }
              />
            </Dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">連絡先</CardTitle>
          </CardHeader>
          <CardContent>
            <Dl>
              <Item label="国" value={client.country} />
              <Item label="電話" value={client.phone} />
              <Item label="メール" value={client.email} />
              <Item label="Web" value={client.website} link />
              <Item label="住所" value={client.address} preserveWhitespace />
            </Dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">表示</CardTitle>
          </CardHeader>
          <CardContent>
            <Dl>
              <Item
                label="表示パターン"
                value={DISPLAY_PATTERN_LABEL[client.displayPattern]}
              />
            </Dl>
          </CardContent>
        </Card>

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
              <Item label="案件数" value={String(client.inquiryCount)} />
              <Item label="成約数" value={String(client.successfulCount)} />
            </Dl>
          </CardContent>
        </Card>

        {client.notes && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">メモ</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="text-xs text-muted-foreground space-x-4">
        <span>作成: {client.createdAt.toLocaleString("ja-JP")}</span>
        <span>更新: {client.updatedAt.toLocaleString("ja-JP")}</span>
      </div>
    </div>
  )
}

function Dl({ children }: { children: React.ReactNode }) {
  return <dl className="space-y-2.5 text-sm">{children}</dl>
}

function Item({
  label,
  value,
  mono,
  link,
  preserveWhitespace,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
  link?: boolean
  preserveWhitespace?: boolean
}) {
  const display = value ?? "—"
  const isEmpty = !value
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          isEmpty
            ? "text-muted-foreground/60"
            : mono
            ? "font-mono text-xs"
            : preserveWhitespace
            ? "whitespace-pre-wrap"
            : ""
        }
      >
        {link && value ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
          >
            {value}
          </a>
        ) : (
          display
        )}
      </dd>
    </div>
  )
}
