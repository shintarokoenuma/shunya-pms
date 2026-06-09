import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, Pencil } from "lucide-react"
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getProcessingType } from "@/lib/actions/processing-types"
import { ProcessingTypeActions } from "../_components/processing-type-delete-button"
import {
  PROCESSING_TYPE_STATUS_LABELS,
  PROCESSING_TYPE_STATUS_BADGE_VARIANT,
} from "../_components/labels"
import { WORK_ORDER_TYPE_LABELS } from "@/lib/constants/work-order-types"

type Params = Promise<{ id: string }>

export default async function ProcessingTypeDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const result = await getProcessingType(id)
  if (!result.ok) {
    notFound()
  }
  const item = result.data
  const isMasterAdmin = session.user.tenantType === "MASTER_ADMIN"

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/processing-types">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {item.name}
              </h1>
              <Badge variant={PROCESSING_TYPE_STATUS_BADGE_VARIANT[item.status]}>
                {PROCESSING_TYPE_STATUS_LABELS[item.status]}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono">{item.code}</span>
              {item.nameEn && (
                <>
                  <span>·</span>
                  <span>{item.nameEn}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/processing-types/${id}/edit`}>
                <Pencil className="mr-1 h-4 w-4" />
                編集
              </Link>
            </Button>
            <ProcessingTypeActions
              id={item.id}
              name={item.name}
              status={item.status}
              isMasterAdmin={isMasterAdmin}
            />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow
            label="コード"
            value={<span className="font-mono">{item.code}</span>}
          />
          <DetailRow label="名称" value={item.name} />
          <DetailRow
            label="大分類（発注種別）"
            value={WORK_ORDER_TYPE_LABELS[item.workType]}
          />
          <DetailRow label="名称（英語）" value={item.nameEn ?? "—"} />
          <DetailRow label="並び順" value={String(item.sortOrder)} />
          <DetailRow
            label="補足"
            value={
              item.description ? (
                <p className="whitespace-pre-wrap">{item.description}</p>
              ) : (
                "—"
              )
            }
          />
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
    <div className="grid grid-cols-[160px_1fr] gap-3 text-sm py-1">
      <div className="text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  )
}
