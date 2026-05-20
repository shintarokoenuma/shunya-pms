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

import { getSupplier } from "@/lib/actions/suppliers"
import { SupplierActions } from "../_components/supplier-delete-button"
import { auth } from "@/lib/auth"
import {
  SUPPLIER_STATUS_LABELS,
  SUPPLIER_STATUS_BADGE_VARIANT,
  SUPPLIER_TYPE_LABELS,
  PAYMENT_TERM_TYPE_LABELS,
  LANGUAGE_OPTIONS,
  CURRENCY_OPTIONS,
  COUNTRY_OPTIONS,
} from "../_components/labels"

function Dl({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-[140px_1fr] gap-y-3 gap-x-4 text-sm">
      {children}
    </dl>
  )
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

const langLabel = (v: string) =>
  LANGUAGE_OPTIONS.find((o) => o.value === v)?.label ?? v
const currencyLabel = (v: string) =>
  CURRENCY_OPTIONS.find((o) => o.value === v)?.label ?? v
const countryLabel = (v: string) =>
  COUNTRY_OPTIONS.find((o) => o.value === v)?.label ?? v

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const isMasterAdmin = session?.user?.tenantType === "MASTER_ADMIN"
  const supplier = await getSupplier(id)

  if (!supplier) notFound()

  const primary = supplier.contacts.find((c) => c.isPrimary)

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/suppliers">
          <ChevronLeft className="mr-1 h-4 w-4" />
          仕入先一覧へ
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{supplier.companyName}</h1>
            <Badge variant={SUPPLIER_STATUS_BADGE_VARIANT[supplier.status]}>
              {SUPPLIER_STATUS_LABELS[supplier.status]}
            </Badge>
          </div>
          {supplier.companyNameEn && (
            <p className="text-sm text-muted-foreground mt-1">
              {supplier.companyNameEn}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            {supplier.supplierCode}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/suppliers/${id}/edit`}>
              <Pencil className="mr-1 h-4 w-4" />
              編集
            </Link>
          </Button>
          <SupplierActions
            id={id}
            name={supplier.companyName}
            status={supplier.status}
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
              <Item label="仕入先コード" value={supplier.supplierCode} mono />
              <Item label="会社名" value={supplier.companyName} />
              <Item label="会社名(英)" value={supplier.companyNameEn} />
              <Item
                label="取扱品目"
                value={
                  supplier.supplierType.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {supplier.supplierType.map((t) => (
                        <Badge key={t} variant="outline">
                          {SUPPLIER_TYPE_LABELS[t]}
                        </Badge>
                      ))}
                    </div>
                  ) : null
                }
              />
            </Dl>
          </CardContent>
        </Card>

        {/* 連絡先 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">連絡先・所在地</CardTitle>
          </CardHeader>
          <CardContent>
            <Dl>
              <Item label="国" value={countryLabel(supplier.country)} />
              <Item label="郵便番号" value={supplier.postalCode} />
              <Item label="都道府県/州" value={supplier.prefecture} />
              <Item label="市区町村" value={supplier.city} />
              <Item label="住所" value={supplier.address} />
              <Item label="建物名" value={supplier.addressLine2} />
              <Item label="住所(英)" value={supplier.addressEn} />
              <Item label="電話" value={supplier.phone} />
              <Item label="FAX" value={supplier.fax} />
              <Item
                label="メール"
                value={
                  supplier.email ? (
                      <a
                      href={`mailto:${supplier.email}`}
                      className="text-primary underline"
                    >
                      {supplier.email}
                    </a>
                  ) : null
                }
              />
              <Item
                label="ウェブサイト"
                value={
                  supplier.website ? (
                      <a
                      href={supplier.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline break-all"
                    >
                      {supplier.website}
                    </a>
                  ) : null
                }
              />
            </Dl>
          </CardContent>
        </Card>

        {/* 海外取引用 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">海外取引用</CardTitle>
          </CardHeader>
          <CardContent>
            <Dl>
              <Item label="チャットツール" value={supplier.chatTool} />
              <Item label="チャットID" value={supplier.chatToolId} />
              <Item
                label="優先言語"
                value={langLabel(supplier.preferredLanguage)}
              />
              <Item
                label="優先通貨"
                value={currencyLabel(supplier.preferredCurrency)}
              />
              <Item label="タイムゾーン" value={supplier.timezone} />
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
                label="適格請求書発行事業者番号"
                value={supplier.taxId}
                mono
              />
              <Item
                label="適格事業者登録"
                value={supplier.isQualifiedInvoiceIssuer ? "登録あり" : "未登録"}
              />
              <Item
                label="支払条件"
                value={PAYMENT_TERM_TYPE_LABELS[supplier.paymentTermType]}
              />
              {supplier.paymentTermType === "MONTHLY_CLOSING" && (
                <>
                  <Item
                    label="締日"
                    value={
                      supplier.closingDay
                        ? supplier.closingDay === 31
                          ? "月末"
                          : `${supplier.closingDay} 日`
                        : null
                    }
                  />
                  <Item
                    label="支払い月"
                    value={
                      supplier.paymentMonthOffset !== null
                        ? supplier.paymentMonthOffset === 0
                          ? "当月"
                          : `${supplier.paymentMonthOffset}ヶ月後`
                        : null
                    }
                  />
                  <Item
                    label="支払日"
                    value={
                      supplier.paymentDay
                        ? supplier.paymentDay === 31
                          ? "月末"
                          : `${supplier.paymentDay} 日`
                        : null
                    }
                  />
                </>
              )}
            </Dl>
          </CardContent>
        </Card>

        {/* 先方担当者 */}
        {primary && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">先方担当者(主担当)</CardTitle>
            </CardHeader>
            <CardContent>
              <Dl>
                <Item
                  label="氏名"
                  value={`${primary.lastName} ${primary.firstName}`}
                />
                <Item label="役職" value={primary.jobTitle} />
                <Item label="部署" value={primary.department} />
                <Item
                  label="メール"
                  value={
                    primary.email ? (
                        <a
                        href={`mailto:${primary.email}`}
                        className="text-primary underline"
                      >
                        {primary.email}
                      </a>
                    ) : null
                  }
                />
                <Item label="電話" value={primary.phone} />
                <Item label="携帯" value={primary.mobile} />
              </Dl>
            </CardContent>
          </Card>
        )}
      </div>

      {/* メモ */}
      {supplier.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">メモ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-line text-sm">{supplier.notes}</div>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground flex gap-6">
        <span>
          作成:{" "}
          {supplier.createdAt.toLocaleString("ja-JP", {
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
          {supplier.updatedAt.toLocaleString("ja-JP", {
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
