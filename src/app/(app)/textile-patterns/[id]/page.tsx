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
import { getTextilePattern } from "@/lib/actions/textile-patterns"
import type { TextilePatternStatusValue } from "@/lib/types/textile-pattern"
import { TextilePatternActions } from "../_components/textile-pattern-delete-button"
import {
  TEXTILE_PATTERN_STATUS_LABELS,
  TEXTILE_PATTERN_STATUS_BADGE_VARIANT,
} from "../_components/labels"

type Params = Promise<{ id: string }>

export default async function TextilePatternDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const companyId = session.user.companyId
  if (!companyId) redirect("/login")

  const { id } = await params
  const pattern = await getTextilePattern(id)
  if (!pattern) notFound()

  const status = pattern.status as TextilePatternStatusValue

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { tenantType: true },
  })
  const isMasterAdmin = company?.tenantType === "MASTER_ADMIN"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/textile-patterns">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧へ戻る
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/textile-patterns/${pattern.id}/edit`}>
              <Pencil className="mr-1 h-4 w-4" />
              編集
            </Link>
          </Button>
          <TextilePatternActions
            id={pattern.id}
            name={pattern.patternName}
            status={status}
            isMasterAdmin={isMasterAdmin}
            variant="menu"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold">{pattern.patternName}</h1>
          <Badge variant={TEXTILE_PATTERN_STATUS_BADGE_VARIANT[status]}>
            {TEXTILE_PATTERN_STATUS_LABELS[status]}
          </Badge>
          <Badge variant="outline" className="font-mono text-xs">
            {pattern.patternNumber}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="柄番号(D#)" value={pattern.patternNumber} mono />
          <Row label="柄名" value={pattern.patternName} />
          <Row
            label="種別"
            value={
              pattern.typeName
                ? `${pattern.typeName}（${pattern.typeCode}）`
                : "—"
            }
          />
          <Row label="表示順" value={String(pattern.sortOrder)} mono />
        </CardContent>
      </Card>
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
