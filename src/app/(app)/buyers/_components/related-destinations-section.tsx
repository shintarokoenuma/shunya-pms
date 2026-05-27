"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import type { DeliveryDestinationStatus } from "@prisma/client"
import {
  DELIVERY_DESTINATION_STATUS_LABELS,
  DELIVERY_DESTINATION_STATUS_BADGE_VARIANT,
} from "../../delivery-destinations/_components/labels"

type DestinationRow = {
  id: string
  destinationCode: string
  destinationName: string
  prefecture: string | null
  city: string | null
  country: string
  status: DeliveryDestinationStatus
}

type Props = {
  buyerId: string
  destinations: DestinationRow[]
}

/**
 * Phase 1A-10 spec §4 B-1：Buyer 詳細の「関連納品先」セクション。
 * - 全件表示（想定数 10〜30 程度、ページネーション不要）
 * - destinationCode 昇順
 * - アーカイブ済みはトグル切り替え（デフォルト非表示）
 */
export function RelatedDestinationsSection({ buyerId, destinations }: Props) {
  const [showArchived, setShowArchived] = useState(false)

  const visible = showArchived
    ? destinations
    : destinations.filter((d) => d.status === "ACTIVE")
  const archivedCount = destinations.filter(
    (d) => d.status === "ARCHIVED",
  ).length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-3">
        <CardTitle className="text-base">
          関連納品先（{destinations.length} 件）
        </CardTitle>
        <div className="flex items-center gap-3">
          <Link
            href={`/delivery-destinations?buyerId=${buyerId}`}
            className="text-sm text-primary hover:underline whitespace-nowrap"
          >
            一覧で見る →
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link href={`/delivery-destinations/new?buyerId=${buyerId}`}>
              <Plus className="mr-1 h-4 w-4" />
              納品先を追加
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {archivedCount > 0 && (
          <div className="flex items-center gap-2">
            <Switch
              id={`show-archived-${buyerId}`}
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label
              htmlFor={`show-archived-${buyerId}`}
              className="text-sm font-normal text-muted-foreground"
            >
              アーカイブ済みも表示（{archivedCount} 件）
            </Label>
          </div>
        )}

        {visible.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            {destinations.length === 0
              ? "まだ納品先が登録されていません。"
              : "稼働中の納品先はありません。"}
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((d) => (
              <Link
                key={d.id}
                href={`/delivery-destinations/${d.id}`}
                className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-sm text-muted-foreground shrink-0">
                    {d.destinationCode}
                  </span>
                  <span className="font-medium truncate">
                    {d.destinationName}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {d.country === "JP"
                      ? d.prefecture ?? "—"
                      : d.country}
                  </span>
                </div>
                <Badge
                  variant={DELIVERY_DESTINATION_STATUS_BADGE_VARIANT[d.status]}
                >
                  {DELIVERY_DESTINATION_STATUS_LABELS[d.status]}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
