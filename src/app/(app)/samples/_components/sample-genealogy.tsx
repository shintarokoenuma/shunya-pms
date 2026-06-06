import Link from "next/link"
import { GitBranch, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type {
  SampleGenealogyNode,
} from "@/lib/actions/sample-productions"
import type { SampleProductionStatus, SampleRound } from "@prisma/client"
import {
  SAMPLE_STATUS_LABELS,
  SAMPLE_ROUND_LABELS,
  SAMPLE_ROUND_BADGE_VARIANT,
} from "./labels"

type CurrentNode = {
  id: string
  sampleNumber: string
  sampleRound: SampleRound
  roundOrder: number
  status: SampleProductionStatus
}

type Props = {
  productId: string
  current: CurrentNode
  parent: SampleGenealogyNode | null
  childNodes: SampleGenealogyNode[]
  /** archive 済み等で修正作成を出さない場合に false */
  canCreateRevision?: boolean
}

function Row({
  node,
  emphasis,
}: {
  node: CurrentNode | SampleGenealogyNode
  emphasis?: boolean
}) {
  return (
    <Link
      href={`/samples/${node.id}`}
      className={
        "flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent/50" +
        (emphasis ? " border-primary bg-accent/30" : "")
      }
    >
      <Badge variant={SAMPLE_ROUND_BADGE_VARIANT[node.sampleRound]}>
        {SAMPLE_ROUND_LABELS[node.sampleRound]}
      </Badge>
      <span className="font-mono">{node.sampleNumber}</span>
      <span className="text-muted-foreground">
        {SAMPLE_STATUS_LABELS[node.status]}
      </span>
      {emphasis && (
        <span className="ml-auto text-xs text-muted-foreground">表示中</span>
      )}
    </Link>
  )
}

export function SampleGenealogy({
  productId,
  current,
  parent,
  childNodes,
  canCreateRevision = true,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <GitBranch className="h-4 w-4" />
        修正系譜
      </div>

      <div className="space-y-2">
        {parent && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">親（修正ベース）</div>
            <Row node={parent} />
          </div>
        )}

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">このサンプル</div>
          <Row node={current} emphasis />
        </div>

        {childNodes.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              修正サンプル（次ラウンド）
            </div>
            {childNodes.map((c) => (
              <Row key={c.id} node={c} />
            ))}
          </div>
        )}
      </div>

      {canCreateRevision && (
        <Button asChild variant="outline" size="sm">
          <Link
            href={`/samples/new?productId=${productId}&parentSampleId=${current.id}`}
          >
            <Plus className="mr-1 h-4 w-4" />
            修正サンプルを作成（次ラウンド）
          </Link>
        </Button>
      )}
    </div>
  )
}
