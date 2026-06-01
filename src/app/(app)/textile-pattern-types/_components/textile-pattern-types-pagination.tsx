"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  page: number
  totalPages: number
  total: number
}

export function TextilePatternTypesPagination({
  page,
  totalPages,
  total,
}: Props) {
  const searchParams = useSearchParams()
  const buildUrl = (p: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(p))
    return `/textile-pattern-types?${params.toString()}`
  }
  if (totalPages <= 1) {
    return <div className="text-sm text-muted-foreground">全 {total} 件</div>
  }
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        全 {total} 件 / {page} ページ目（全 {totalPages} ページ）
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm" disabled={page <= 1}>
          {page > 1 ? (
            <Link href={buildUrl(page - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              前へ
            </Link>
          ) : (
            <span>
              <ChevronLeft className="mr-1 h-4 w-4" />
              前へ
            </span>
          )}
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
        >
          {page < totalPages ? (
            <Link href={buildUrl(page + 1)}>
              次へ
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          ) : (
            <span>
              次へ
              <ChevronRight className="ml-1 h-4 w-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}
