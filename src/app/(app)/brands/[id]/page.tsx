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

import { getBrand } from "@/lib/actions/brands"
import { BrandActions } from "../_components/brand-delete-button"
import { auth } from "@/lib/auth"
import {
  BRAND_STATUS_LABEL,
  BRAND_STATUS_BADGE_VARIANT,
} from "../_components/labels"

function Dl({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-[140px_1fr] gap-y-3 gap-x-4 text-sm">{children}</dl>
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

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const isMasterAdmin = session?.user?.tenantType === "MASTER_ADMIN"
  const brand = await getBrand(id)

  if (!brand) notFound()

  const brandColors = brand.brandColors as { main?: string } | null
  const mainColor = brandColors?.main ?? null

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/brands">
          <ChevronLeft className="mr-1 h-4 w-4" />
          ブランド一覧へ
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{brand.brandName}</h1>
            <Badge variant={BRAND_STATUS_BADGE_VARIANT[brand.status]}>
              {BRAND_STATUS_LABEL[brand.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            {brand.brandCode}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/brands/${id}/edit`}>
              <Pencil className="mr-1 h-4 w-4" />
              編集
            </Link>
          </Button>
          <BrandActions
            id={id}
            name={brand.brandName}
            status={brand.status}
            isMasterAdmin={isMasterAdmin}
            variant="menu"
          />
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
              <Item label="ブランドコード" value={brand.brandCode} mono />
              <Item label="ブランド名" value={brand.brandName} />
              <Item label="ブランド名（英）" value={brand.brandNameEn} />
              <Item
                label="クライアント"
                value={
                  <Link
                    href={`/clients/${brand.client.id}`}
                    className="hover:underline"
                  >
                    {brand.client.companyName}
                    <span className="text-muted-foreground font-mono text-xs ml-2">
                      ({brand.client.clientCode})
                    </span>
                  </Link>
                }
              />
            </Dl>
          </CardContent>
        </Card>

        {/* ブランディング */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ブランディング</CardTitle>
          </CardHeader>
          <CardContent>
            <Dl>
              <Item
                label="ロゴ URL"
                value={
                  brand.logoUrl ? (
                    <a
                      href={brand.logoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline break-all"
                    >
                      {brand.logoUrl}
                    </a>
                  ) : null
                }
              />
              <Item
                label="メインカラー"
                value={
                  mainColor ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="h-6 w-6 rounded border"
                        style={{ backgroundColor: mainColor }}
                      />
                      <span className="font-mono">{mainColor}</span>
                    </div>
                  ) : null
                }
              />
            </Dl>
          </CardContent>
        </Card>

        {/* 設定 */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">設定</CardTitle>
          </CardHeader>
          <CardContent>
            <Dl>
              <Item
                label="デフォルトマージン率"
                value={
                  brand.defaultMarginRate
                    ? `${Number(brand.defaultMarginRate)} %`
                    : null
                }
              />
              <Item
                label="マージン継承"
                value={
                  <span className="text-xs text-muted-foreground">
                    見積もりエンジン側で BRAND_LEVEL として参照されます（Phase 1B 以降）
                  </span>
                }
              />
            </Dl>
          </CardContent>
        </Card>
      </div>

      {/* コンセプト */}
      {brand.concept && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">コンセプト</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-line text-sm">{brand.concept}</div>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground flex gap-6">
        <span>
          作成:{" "}
          {brand.createdAt.toLocaleString("ja-JP", {
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
          {brand.updatedAt.toLocaleString("ja-JP", {
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
