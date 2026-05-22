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

import { getContractor } from "@/lib/actions/contractors"
import { ContractorActions } from "../_components/contractor-delete-button"
import { auth } from "@/lib/auth"
import {
  CONTRACTOR_STATUS_LABELS,
  CONTRACTOR_STATUS_BADGE_VARIANT,
  CONTRACTOR_SPECIALTY_LABELS,
  CONTRACTOR_CONTRACT_TYPE_LABELS,
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

// Decimal 値を整形（"30000" や "30000.00" のような文字列を JPY 形式に）
function formatDecimal(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const num = typeof v === "number" ? v : Number(v.toString())
  if (isNaN(num)) return null
  return "¥" + num.toLocaleString("ja-JP")
}

export default async function ContractorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const isMasterAdmin = session?.user?.tenantType === "MASTER_ADMIN"
  const contractor = await getContractor(id)

  if (!contractor) notFound()

  const primary = contractor.contacts.find((c) => c.isPrimary)
  const contractType = contractor.contractType

  // 料金体系の表示制御（フォームと同じロジック）
  const showPackage = contractType === "PACKAGE" || contractType === "HYBRID"
  const showHourly = contractType === "HOURLY" || contractType === "HYBRID"
  const showMonthly = contractType === "MONTHLY" || contractType === "HYBRID"
  const showPerTaskNotice = contractType === "PER_TASK"

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/contractors">
          <ChevronLeft className="mr-1 h-4 w-4" />
          外注先一覧へ
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{contractor.contractorName}</h1>
            <Badge variant={CONTRACTOR_STATUS_BADGE_VARIANT[contractor.status]}>
              {CONTRACTOR_STATUS_LABELS[contractor.status]}
            </Badge>
            <Badge variant="secondary">
              {contractor.isIndividual ? "個人事業主" : "法人"}
            </Badge>
          </div>
          {contractor.contractorNameEn && (
            <p className="text-sm text-muted-foreground mt-1">
              {contractor.contractorNameEn}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            {contractor.contractorCode}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/contractors/${id}/edit`}>
              <Pencil className="mr-1 h-4 w-4" />
              編集
            </Link>
          </Button>
          <ContractorActions
            id={id}
            name={contractor.contractorName}
            status={contractor.status}
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
              <Item label="外注先コード" value={contractor.contractorCode} mono />
              <Item label="外注先名" value={contractor.contractorName} />
              <Item label="外注先名(英)" value={contractor.contractorNameEn} />
              <Item
                label="区分"
                value={contractor.isIndividual ? "個人事業主" : "法人"}
              />
              <Item
                label="専門分野"
                value={
                  contractor.specialties.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {contractor.specialties.map((s) => (
                        <Badge key={s} variant="outline">
                          {CONTRACTOR_SPECIALTY_LABELS[s]}
                        </Badge>
                      ))}
                    </div>
                  ) : null
                }
              />
              <Item
                label="契約形態"
                value={
                  <Badge variant="outline">
                    {CONTRACTOR_CONTRACT_TYPE_LABELS[contractor.contractType]}
                  </Badge>
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
              <Item label="国" value={countryLabel(contractor.country)} />
              <Item label="郵便番号" value={contractor.postalCode} />
              <Item label="都道府県/州" value={contractor.prefecture} />
              <Item label="市区町村" value={contractor.city} />
              <Item label="住所" value={contractor.address} />
              <Item label="建物名" value={contractor.addressLine2} />
              <Item label="住所(英)" value={contractor.addressEn} />
              <Item label="電話" value={contractor.phone} />
              <Item label="FAX" value={contractor.fax} />
              <Item
                label="メール"
                value={
                  contractor.email ? (
                    <a
                      href={`mailto:${contractor.email}`}
                      className="text-primary underline"
                    >
                      {contractor.email}
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
              <Item label="チャットツール" value={contractor.chatTool} />
              <Item label="チャットID" value={contractor.chatToolId} />
              <Item
                label="優先言語"
                value={langLabel(contractor.preferredLanguage)}
              />
              <Item
                label="優先通貨"
                value={currencyLabel(contractor.preferredCurrency)}
              />
              <Item label="タイムゾーン" value={contractor.timezone} />
            </Dl>
          </CardContent>
        </Card>

        {/* 料金体系 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">料金体系</CardTitle>
          </CardHeader>
          <CardContent>
            {showPerTaskNotice ? (
              <div className="text-sm text-muted-foreground">
                個別作業単価は <strong>Phase 2 で実装予定</strong>。
                それまでは見積もり時に都度設定してください。
              </div>
            ) : (
              <Dl>
                {showPackage && (
                  <Item
                    label="パッケージ料金"
                    value={formatDecimal(contractor.packageFee)}
                  />
                )}
                {showHourly && (
                  <Item
                    label="時給"
                    value={formatDecimal(contractor.hourlyRate)}
                  />
                )}
                {showMonthly && (
                  <Item
                    label="月額固定"
                    value={formatDecimal(contractor.monthlyFee)}
                  />
                )}
              </Dl>
            )}
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
                label="適格事業者登録"
                value={
                  contractor.isQualifiedInvoiceIssuer ? "登録あり" : "未登録"
                }
              />
              <Item
                label="適格請求書発行事業者番号"
                value={contractor.taxId}
                mono
              />
              <Item
                label="支払条件"
                value={PAYMENT_TERM_TYPE_LABELS[contractor.paymentTermType]}
              />
              {contractor.paymentTermType === "MONTHLY_CLOSING" && (
                <>
                  <Item
                    label="締日"
                    value={
                      contractor.closingDay
                        ? contractor.closingDay === 31
                          ? "月末"
                          : `${contractor.closingDay} 日`
                        : null
                    }
                  />
                  <Item
                    label="支払い月"
                    value={
                      contractor.paymentMonthOffset !== null
                        ? contractor.paymentMonthOffset === 0
                          ? "当月"
                          : `${contractor.paymentMonthOffset}ヶ月後`
                        : null
                    }
                  />
                  <Item
                    label="支払日"
                    value={
                      contractor.paymentDay
                        ? contractor.paymentDay === 31
                          ? "月末"
                          : `${contractor.paymentDay} 日`
                        : null
                    }
                  />
                </>
              )}
            </Dl>
          </CardContent>
        </Card>

        {/* 先方担当者(法人かつ存在する場合のみ) */}
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
      {contractor.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">メモ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-line text-sm">{contractor.notes}</div>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground flex gap-6">
        <span>
          作成:{" "}
          {contractor.createdAt.toLocaleString("ja-JP", {
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
          {contractor.updatedAt.toLocaleString("ja-JP", {
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
