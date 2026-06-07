import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, Pencil } from "lucide-react"
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getSampleProduction } from "@/lib/actions/sample-productions"
import {
  listTasks,
  listActiveProcessingTypesForSelect,
} from "@/lib/actions/progress-tasks"
import { primaryProductCode } from "@/lib/utils/product-code"
import { SampleProductionActions } from "../_components/sample-production-delete-button"
import { SampleStatusControl } from "../_components/sample-status-control"
import { SampleGenealogy } from "../_components/sample-genealogy"
import { ProgressChecklist } from "../_components/progress-checklist"
import {
  SAMPLE_STATUS_LABELS,
  SAMPLE_STATUS_BADGE_VARIANT,
  SAMPLE_ROUND_LABELS,
  SAMPLE_ROUND_BADGE_VARIANT,
} from "../_components/labels"

type Params = Promise<{ id: string }>

export default async function SampleProductionDetailPage({
  params,
}: {
  params: Params
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const result = await getSampleProduction(id)
  if (!result.ok) {
    notFound()
  }
  const item = result.data
  const isMasterAdmin = session.user.tenantType === "MASTER_ADMIN"
  const isArchived = !!item.deletedAt

  // S-3: 進行チェックリスト
  const [tasksResult, processingOptions] = await Promise.all([
    listTasks({ sampleProductionId: item.id }),
    listActiveProcessingTypesForSelect(),
  ])
  const tasks = tasksResult.ok ? tasksResult.data.items : []

  return (
    <div className="space-y-6 p-6">
      {/* ヘッダー */}
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/samples">
            <ChevronLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold tracking-tight">
                {item.sampleNumber}
              </h1>
              <Badge variant={SAMPLE_ROUND_BADGE_VARIANT[item.sampleRound]}>
                {SAMPLE_ROUND_LABELS[item.sampleRound]}
              </Badge>
              <Badge variant={SAMPLE_STATUS_BADGE_VARIANT[item.status]}>
                {SAMPLE_STATUS_LABELS[item.status]}
              </Badge>
              {isArchived && <Badge variant="secondary">アーカイブ済み</Badge>}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {item.title ?? "（無題）"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isArchived && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/samples/${id}/edit`}>
                  <Pencil className="mr-1 h-4 w-4" />
                  編集
                </Link>
              </Button>
            )}
            <SampleProductionActions
              id={item.id}
              sampleNumber={item.sampleNumber}
              isArchived={isArchived}
              isMasterAdmin={isMasterAdmin}
            />
          </div>
        </div>
      </div>

      {/* 対象品番 + ステータス操作 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">対象品番</CardTitle>
          </CardHeader>
          <CardContent>
            {item.product ? (
              <Link
                href={`/products/${item.product.id}`}
                className="inline-flex flex-col gap-0.5 hover:underline"
              >
                <span className="font-medium">{item.product.productName}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {primaryProductCode(item.product)}
                  <span className="ml-2">{item.product.season}</span>
                </span>
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">ステータス</CardTitle>
          </CardHeader>
          <CardContent>
            {isArchived ? (
              <p className="text-sm text-muted-foreground">
                アーカイブ済みのため変更できません。復元してから操作してください。
              </p>
            ) : (
              <SampleStatusControl id={item.id} current={item.status} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* 基本情報 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow label="タイトル" value={item.title ?? "—"} />
          <DetailRow
            label="摘要・指示"
            value={
              item.description ? (
                <p className="whitespace-pre-wrap">{item.description}</p>
              ) : (
                "—"
              )
            }
          />
          <DetailRow label="製作数" value={`${item.sampleQuantity} 点`} />
          <DetailRow
            label="開始予定日"
            value={
              item.plannedStartDate
                ? new Date(item.plannedStartDate).toLocaleDateString("ja-JP")
                : "—"
            }
          />
          <DetailRow
            label="完成予定日"
            value={
              item.plannedCompletionDate
                ? new Date(item.plannedCompletionDate).toLocaleDateString(
                    "ja-JP",
                  )
                : "—"
            }
          />
          <DetailRow
            label="社内メモ"
            value={
              item.internalNotes ? (
                <p className="whitespace-pre-wrap">{item.internalNotes}</p>
              ) : (
                "—"
              )
            }
          />
        </CardContent>
      </Card>

      {/* 修正系譜 */}
      <Card>
        <CardContent className="pt-6">
          <SampleGenealogy
            productId={item.productId}
            current={{
              id: item.id,
              sampleNumber: item.sampleNumber,
              sampleRound: item.sampleRound,
              roundOrder: item.roundOrder,
              status: item.status,
            }}
            parent={item.parent}
            childNodes={item.children}
            canCreateRevision={!isArchived}
          />
        </CardContent>
      </Card>

      {/* 進行チェックリスト（S-3） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">進行チェックリスト</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressChecklist
            sampleProductionId={item.id}
            tasks={tasks}
            processingOptions={processingOptions}
          />
        </CardContent>
      </Card>

      {/* メタ情報 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">メタ情報</CardTitle>
        </CardHeader>
        <CardContent>
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
