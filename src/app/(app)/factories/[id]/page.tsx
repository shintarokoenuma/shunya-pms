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

import { getFactory } from "@/lib/actions/factories"
import { FactoryActions } from "../_components/factory-delete-button"
import { auth } from "@/lib/auth"
import {
  FACTORY_STATUS_LABELS,
  FACTORY_STATUS_BADGE_VARIANT,
  FACTORY_TYPE_LABELS,
  FACTORY_CONTRACT_TYPE_LABELS,
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

export default async function FactoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const isMasterAdmin = session?.user?.tenantType === "MASTER_ADMIN"
  const factory = await getFactory(id)

  if (!factory) notFound()

  const primary = factory.contacts.find((c) => c.isPrimary)

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/factories">
          <ChevronLeft className="mr-1 h-4 w-4" />
          工場一覧へ
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{factory.factoryName}</h1>
            <Badge variant={FACTORY_STATUS_BADGE_VARIANT[factory.status]}>
              {FACTORY_STATUS_LABELS[factory.status]}
            </Badge>
          </div>
          {factory.factoryNameEn && (
            <p className="text-sm text-muted-foreground mt-1">
              {factory.factoryNameEn}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            {factory.factoryCode}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/factories/${id}/edit`}>
              <Pencil className="mr-1 h-4 w-4" />
              編集
            </Link>
          </Button>
          <FactoryActions
            id={id}
            name={factory.factoryName}
            status={factory.status}
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
              <Item label="工場コード" value={factory.factoryCode} mono />
              <Item label="工場名" value={factory.factoryName} />
              <Item label="工場名(英)" value={factory.factoryNameEn} />
              <Item
                label="工場タイプ"
                value={
                  factory.factoryTypes.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {factory.factoryTypes.map((t) => (
                        <Badge key={t} variant="outline">
                          {FACTORY_TYPE_LABELS[t]}
                        </Badge>
                      ))}
                    </div>
                  ) : null
                }
              />
              <Item
                label="契約形態"
                value={
                  factory.contractTypes.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {factory.contractTypes.map((t) => (
                        <Badge key={t} variant="outline">
                          {FACTORY_CONTRACT_TYPE_LABELS[t]}
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
              <Item label="国" value={countryLabel(factory.country)} />
              <Item label="郵便番号" value={factory.postalCode} />
              <Item label="都道府県/州" value={factory.prefecture} />
              <Item label="市区町村" value={factory.city} />
              <Item label="住所" value={factory.address} />
              <Item label="建物名" value={factory.addressLine2} />
              <Item label="住所(英)" value={factory.addressEn} />
              <Item label="電話" value={factory.phone} />
              <Item label="FAX" value={factory.fax} />
              <Item
                label="メール"
                value={
                  factory.email ? (
                      <a
                        href={`mailto:${factory.email}`}
                      className="text-primary underline"
                    >
                      {factory.email}
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
              <Item label="チャットツール" value={factory.chatTool} />
              <Item label="チャットID" value={factory.chatToolId} />
              <Item
                label="優先言語"
                value={langLabel(factory.preferredLanguage)}
              />
              <Item
                label="優先通貨"
                value={currencyLabel(factory.preferredCurrency)}
              />
              <Item label="タイムゾーン" value={factory.timezone} />
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
                value={factory.taxId}
                mono
              />
              <Item
                label="適格事業者登録"
                value={factory.isQualifiedInvoiceIssuer ? "登録あり" : "未登録"}
              />
              <Item
                label="支払条件"
                value={PAYMENT_TERM_TYPE_LABELS[factory.paymentTermType]}
              />
              {factory.paymentTermType === "MONTHLY_CLOSING" && (
                <>
                  <Item
                    label="締日"
                    value={
                      factory.closingDay
                        ? factory.closingDay === 31
                          ? "月末"
                          : `${factory.closingDay} 日`
                        : null
                    }
                  />
                  <Item
                    label="支払い月"
                    value={
                      factory.paymentMonthOffset !== null
                        ? factory.paymentMonthOffset === 0
                          ? "当月"
                          : `${factory.paymentMonthOffset}ヶ月後`
                        : null
                    }
                  />
                  <Item
                    label="支払日"
                    value={
                      factory.paymentDay
                        ? factory.paymentDay === 31
                          ? "月末"
                          : `${factory.paymentDay} 日`
                        : null
                    }
                  />
                </>
              )}
            </Dl>
          </CardContent>
        </Card>

        {/* 製造キャパシティ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">製造キャパシティ</CardTitle>
          </CardHeader>
          <CardContent>
            <Dl>
              <Item
                label="月間生産可能数"
                value={
                  factory.monthlyCapacity !== null
                    ? factory.monthlyCapacity.toLocaleString() + " 着"
                    : null
                }
              />
              <Item
                label="最小ロット"
                value={
                  factory.minimumOrderQty !== null
                    ? factory.minimumOrderQty.toLocaleString() + " 着"
                    : null
                }
              />
              <Item
                label="標準リードタイム"
                value={
                  factory.averageLeadTimeDays !== null
                    ? factory.averageLeadTimeDays + " 日"
                    : null
                }
              />
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
      {factory.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">メモ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-line text-sm">{factory.notes}</div>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground flex gap-6">
        <span>
          作成:{" "}
          {factory.createdAt.toLocaleString("ja-JP", {
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
          {factory.updatedAt.toLocaleString("ja-JP", {
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
