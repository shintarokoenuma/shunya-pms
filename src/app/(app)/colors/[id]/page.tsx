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
import { getColor } from "@/lib/actions/colors"
import type { ColorStatusValue } from "@/lib/validators/color"
import { ColorActions } from "../_components/color-delete-button"
import { ColorSwatch } from "../_components/color-swatch"
import {
  COLOR_STATUS_LABELS,
  COLOR_STATUS_BADGE_VARIANT,
  HUE_GROUP_LABELS,
} from "../_components/labels"

type Params = Promise<{ id: string }>

export default async function ColorDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const companyId = session.user.companyId
  if (!companyId) redirect("/login")

  const { id } = await params
  const color = await getColor(id)
  if (!color) notFound()

  const status = color.status as ColorStatusValue
  const isUndefined = color.colorNumber === "00"

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { tenantType: true },
  })
  const isMasterAdmin = company?.tenantType === "MASTER_ADMIN"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/colors">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧へ戻る
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/colors/${color.id}/edit`}>
              <Pencil className="mr-1 h-4 w-4" />
              編集
            </Link>
          </Button>
          <ColorActions
            id={color.id}
            name={color.colorName}
            status={status}
            isMasterAdmin={isMasterAdmin}
            variant="menu"
          />
        </div>
      </div>

      <div className="flex items-start gap-4">
        <ColorSwatch
          colorNumber={color.colorNumber}
          hex={color.hex}
          size="lg"
        />
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{color.colorName}</h1>
            <Badge variant={COLOR_STATUS_BADGE_VARIANT[status]}>
              {COLOR_STATUS_LABELS[status]}
            </Badge>
            <Badge variant="outline">
              {color.hueGroup}: {HUE_GROUP_LABELS[color.hueGroup] ?? "—"}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground font-mono">
            #{color.colorNumber}
          </div>
          {isUndefined && (
            <div className="mt-2 text-sm text-muted-foreground">
              カラー未定（マルチ／プリント／総柄など、単色指定なし）
            </div>
          )}
        </div>
      </div>

      {/* ───────── 基本情報 ───────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="色番号" value={color.colorNumber} mono />
          <Row label="色名" value={color.colorName} />
          <Row
            label="色相系統"
            value={`${color.hueGroup}: ${HUE_GROUP_LABELS[color.hueGroup] ?? "—"}`}
          />
          <Row label="トーン段階" value={String(color.toneStep)} />
          <Row label="表示順" value={String(color.sortOrder)} />
        </CardContent>
      </Card>

      {/* ───────── 色値 ───────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">色値</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row
            label="CMYK"
            value={
              color.cmyk ? (
                <span className="font-mono">{color.cmyk}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )
            }
          />
          <Row
            label="HEX"
            value={
              color.hex ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono">{color.hex}</span>
                  <ColorSwatch
                    colorNumber={color.colorNumber}
                    hex={color.hex}
                    size="sm"
                  />
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )
            }
          />
          <Row
            label="印象キーワード"
            value={
              color.impression ?? (
                <span className="text-muted-foreground">—</span>
              )
            }
          />
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
