"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * B-222 PR-2d ブリーフ §4-4: /payments のフィルタ。
 * - クライアント（「すべてのクライアント」を含む）／開始日・終了日／「今月」「全期間」。
 * - URL params を push する形は invoices-search と同じ。期間の既定（今月）はサーバ側で決める（D-42）。
 *   `start` / `end` が1つでもあればその範囲、無く `period=all` なら全期間、どちらも無ければ今月。
 */
export function PaymentsSearch({
  clients,
  start,
  end,
}: {
  clients: { id: string; companyName: string }[]
  /** サーバが決めた表示中の期間（今月の既定を含む）。全期間のときは "" */
  start: string
  end: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const clientId = searchParams.get("clientId") ?? "all"
  const period = searchParams.get("period") ?? ""

  const push = (next: { clientId?: string; start?: string; end?: string; period?: string }) => {
    const params = new URLSearchParams()
    const c = next.clientId ?? clientId
    if (c !== "all") params.set("clientId", c)
    if (next.period === "all") {
      params.set("period", "all")
    } else if (next.period === "month") {
      // 今月: start / end / period をすべて落とす（サーバの既定に戻す）
    } else {
      const s = next.start ?? searchParams.get("start") ?? ""
      const e = next.end ?? searchParams.get("end") ?? ""
      if (s) params.set("start", s)
      if (e) params.set("end", e)
      if (!s && !e && period === "all") params.set("period", "all")
    }
    startTransition(() =>
      router.push(params.toString() ? `/payments?${params.toString()}` : "/payments"),
    )
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Select value={clientId} onValueChange={(v) => push({ clientId: v })} disabled={isPending}>
        <SelectTrigger className="w-full sm:w-[260px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべてのクライアント</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.companyName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={start}
          onChange={(e) => push({ start: e.target.value, end })}
          className="w-[160px]"
          disabled={isPending}
          aria-label="開始日"
        />
        <span className="text-muted-foreground">〜</span>
        <Input
          type="date"
          value={end}
          onChange={(e) => push({ start, end: e.target.value })}
          className="w-[160px]"
          disabled={isPending}
          aria-label="終了日"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={period === "all" || searchParams.get("start") || searchParams.get("end") ? "outline" : "secondary"}
          size="sm"
          onClick={() => push({ period: "month" })}
          disabled={isPending}
        >
          今月
        </Button>
        <Button
          type="button"
          variant={period === "all" ? "secondary" : "outline"}
          size="sm"
          onClick={() => push({ period: "all" })}
          disabled={isPending}
        >
          全期間
        </Button>
      </div>
    </div>
  )
}
