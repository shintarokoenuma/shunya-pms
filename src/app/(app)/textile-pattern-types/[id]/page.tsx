import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, Pencil } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getTextilePatternType } from "@/lib/actions/textile-pattern-types"
import type { TextilePatternTypeStatusValue } from "@/lib/validators/textile-pattern-type"
import { TextilePatternTypeActions } from "../_components/textile-pattern-type-delete-button"
import {
  TEXTILE_PATTERN_TYPE_STATUS_LABELS,
  TEXTILE_PATTERN_TYPE_STATUS_BADGE_VARIANT,
} from "../_components/labels"

type Params = Promise<{ id: string }>

export default async function TextilePatternTypeDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const companyId = session.user.companyId
  if (!companyId) redirect("/login")

  const { id } = await params
  const patternType = await getTextilePatternType(id)
  if (!patternType) notFound()

  const status = patternType.status as TextilePatternTypeStatusValue

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { tenantType: true },
  })
  const isMasterAdmin = company?.tenantType === "MASTER_ADMIN"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/textile-pattern-types">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧へ戻る
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/textile-pattern-types/${patternType.id}/edit`}>
              <Pencil className="mr-1 h-4 w-4" />
              編集
            </Link>
          </Button>
          <TextilePatternTypeActions
            id={patternType.id}
            name={patternType.typeName}
            status={status}
            isMasterAdmin={isMasterAdmin}
            variant="menu"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold">{patternType.typeName}</h1>
          <Badge variant={TEXTILE_PATTERN_TYPE_STATUS_BADGE_VARIANT[status]}>
            {TEXTILE_PATTERN_TYPE_STATUS_LABELS[status]}
          </Badge>
          <Badge variant="outline" className="font-mono text-xs">
            {patternType.typeCode}
          </Badge>
        </div>
      </div>

      {/* ───────── 基本情報 ───────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="コード" value={patternType.typeCode} mono />
          <Row label="柄種別名" value={patternType.typeName} />
          <Row label="表示順" value={String(patternType.sortOrder)} mono />
        </CardContent>
      </Card>

      {/* ───────── 説明 ───────── */}
      {patternType.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">説明</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">
              {patternType.description}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3">
      <div className="text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono" : ""}>{value}</div>
    </div>
  )
}
