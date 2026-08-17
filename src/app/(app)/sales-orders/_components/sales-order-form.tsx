"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Currency, OrderSourceType, SkuMoqStatus } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchableSelect } from "../../_components/searchable-select"
import {
  createSalesOrder,
  updateSalesOrder,
} from "@/lib/actions/sales-orders"
import { listSkusForProduct } from "@/lib/actions/skus"
import type { SkuRow } from "@/lib/types/sku"
import {
  ORDER_SOURCE_TYPE_OPTIONS,
  SKU_MOQ_STATUS_OPTIONS,
} from "./labels"

export type ClientOpt = { id: string; clientCode: string; companyName: string }
export type ProductOpt = {
  id: string
  productCode: string
  productName: string
}

/** 編集時にサーバから渡す初期グループ（品番ごとに単価と SKU 別数量を復元）。 */
export type InitialGroup = {
  productId: string
  unitPrice: number
  skus: {
    skuId: string
    orderedQuantity: number
    moqStatus: SkuMoqStatus
  }[]
}
export type InitialHeader = {
  clientId: string
  orderDate: string
  buyerOrderNumber: string | null
  sourceType: OrderSourceType
  currency: Currency
  desiredDeliveryDate: string | null
  title: string | null
  internalNotes: string | null
}

type Block = {
  key: string
  productId: string | null
  unitPrice: string
  skus: SkuRow[] | null // null=未ロード
  qty: Record<string, string>
  moq: Record<string, SkuMoqStatus>
}

let blockSeq = 0
function newBlock(): Block {
  blockSeq += 1
  return {
    key: `b${blockSeq}`,
    productId: null,
    unitPrice: "",
    skus: null,
    qty: {},
    moq: {},
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function SalesOrderForm({
  mode,
  salesOrderId,
  clients,
  products,
  initialHeader,
  initialGroups,
}: {
  mode: "create" | "edit"
  salesOrderId?: string
  clients: ClientOpt[]
  products: ProductOpt[]
  initialHeader?: InitialHeader
  initialGroups?: InitialGroup[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [clientId, setClientId] = useState<string | null>(
    initialHeader?.clientId ?? null,
  )
  const [orderDate, setOrderDate] = useState(
    initialHeader?.orderDate ?? todayStr(),
  )
  const [buyerOrderNumber, setBuyerOrderNumber] = useState(
    initialHeader?.buyerOrderNumber ?? "",
  )
  const [sourceType, setSourceType] = useState<OrderSourceType>(
    initialHeader?.sourceType ?? OrderSourceType.EMAIL,
  )
  const [currency, setCurrency] = useState<Currency>(
    initialHeader?.currency ?? Currency.JPY,
  )
  const [desiredDeliveryDate, setDesiredDeliveryDate] = useState(
    initialHeader?.desiredDeliveryDate ?? "",
  )
  const [title, setTitle] = useState(initialHeader?.title ?? "")
  const [internalNotes, setInternalNotes] = useState(
    initialHeader?.internalNotes ?? "",
  )

  const [blocks, setBlocks] = useState<Block[]>(() => {
    if (initialGroups && initialGroups.length > 0) {
      return initialGroups.map((g) => {
        blockSeq += 1
        return {
          key: `b${blockSeq}`,
          productId: g.productId,
          unitPrice: String(g.unitPrice),
          skus: null, // マウント後に読み込む（下の loadSkus）
          qty: Object.fromEntries(
            g.skus.map((s) => [s.skuId, String(s.orderedQuantity)]),
          ),
          moq: Object.fromEntries(g.skus.map((s) => [s.skuId, s.moqStatus])),
        }
      })
    }
    return [newBlock()]
  })

  const productOptions = products.map((p) => ({
    value: p.id,
    label: `${p.productCode} ${p.productName}`,
    keywords: `${p.productCode} ${p.productName}`,
  }))
  const clientOptions = clients.map((c) => ({
    value: c.id,
    label: `${c.clientCode} ${c.companyName}`,
    keywords: `${c.clientCode} ${c.companyName}`,
  }))

  // 初期グループ由来の SKU ロードを一度きりにするガード（ref のため再レンダリングを起こさない）。
  const initRef = useRef(false)

  // アンマウント後の setState を避けるためのマウント状態フラグ（非同期完了後に参照）。
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const patchBlock = (key: string, patch: Partial<Block>) =>
    setBlocks((prev) =>
      prev.map((b) => (b.key === key ? { ...b, ...patch } : b)),
    )

  async function loadSkus(key: string, productId: string) {
    const r = await listSkusForProduct(productId)
    if (!mountedRef.current) return // アンマウント後は書かない
    if (!r.ok) {
      toast.error(r.error)
      patchBlock(key, { skus: [] })
      return
    }
    patchBlock(key, { skus: r.data })
  }

  const onSelectProduct = (key: string, productId: string) => {
    // 品番が変わったら SKU と入力をリセット
    patchBlock(key, { productId, skus: null, qty: {}, moq: {} })
    startTransition(async () => {
      await loadSkus(key, productId)
    })
  }

  // 編集初期化: 既存ブロックの SKU をまとめて読み込む（qty/moq は保持）。
  // ★レンダリング中に呼ばず、マウント時に一度だけ実行する（setState-in-render 違反の解消）。
  //   skusInitialized の一度きりガードは維持（無限ループ防止・二重ロード防止）。
  useEffect(() => {
    if (initRef.current) return
    if (!initialGroups || initialGroups.length === 0) return
    initRef.current = true
    startTransition(async () => {
      for (const b of blocks) {
        if (b.productId && b.skus === null) {
          await loadSkus(b.key, b.productId)
        }
      }
    })
    // 初期グループ由来のロードはマウント時のみ。blocks/loadSkus は初期値を参照する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = () => {
    if (!clientId) {
      toast.error("クライアントを選択してください")
      return
    }
    if (!orderDate) {
      toast.error("受注日を入力してください")
      return
    }
    const productsPayload = []
    const seenProduct = new Set<string>()
    for (const b of blocks) {
      if (!b.productId) continue
      if (seenProduct.has(b.productId)) {
        toast.error("同じ品番が複数のブロックにあります")
        return
      }
      seenProduct.add(b.productId)
      if (b.unitPrice === "" || Number(b.unitPrice) < 0) {
        toast.error("各品番に単価（0以上）を入力してください")
        return
      }
      const skusPayload = (b.skus ?? [])
        .filter((s) => Number(b.qty[s.id] || 0) >= 1)
        .map((s) => ({
          skuId: s.id,
          orderedQuantity: Number(b.qty[s.id]),
          moqStatus: b.moq[s.id] ?? SkuMoqStatus.NOT_DETERMINED,
          moqDecisionReason: "",
        }))
      if (skusPayload.length === 0) {
        toast.error("各品番に受注数（1以上）の SKU を1件以上入力してください")
        return
      }
      productsPayload.push({
        productId: b.productId,
        unitPrice: Number(b.unitPrice),
        skus: skusPayload,
      })
    }
    if (productsPayload.length === 0) {
      toast.error("品番を1件以上追加してください")
      return
    }

    const payload = {
      clientId,
      buyerOrderNumber,
      sourceType,
      orderDate,
      desiredDeliveryDate,
      currency,
      title,
      internalNotes,
      products: productsPayload,
    }

    startTransition(async () => {
      const r =
        mode === "create"
          ? await createSalesOrder(payload)
          : await updateSalesOrder(salesOrderId as string, payload)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(mode === "create" ? "受注を作成しました" : "受注を更新しました")
      const id =
        mode === "create"
          ? (r.data as { id: string }).id
          : (salesOrderId as string)
      router.push(`/sales-orders/${id}`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* ヘッダ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">受注情報</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>クライアント（必須）</Label>
            <SearchableSelect
              options={clientOptions}
              value={clientId}
              onChange={setClientId}
              placeholder="クライアントを選択"
              ariaLabel="クライアント"
            />
          </div>
          <div className="space-y-1">
            <Label>受注日（必須）</Label>
            <Input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>先方発注番号</Label>
            <Input
              value={buyerOrderNumber}
              onChange={(e) => setBuyerOrderNumber(e.target.value)}
              placeholder="先方の発注書番号（任意）"
            />
          </div>
          <div className="space-y-1">
            <Label>受注ソース</Label>
            <Select
              value={sourceType}
              onValueChange={(v) => setSourceType(v as OrderSourceType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER_SOURCE_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>通貨</Label>
            <Select
              value={currency}
              onValueChange={(v) => setCurrency(v as Currency)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(Currency).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>希望納期</Label>
            <Input
              type="date"
              value={desiredDeliveryDate}
              onChange={(e) => setDesiredDeliveryDate(e.target.value)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>タイトル</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>社内メモ</Label>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* 品番ブロック */}
      {blocks.map((b) => {
        const p = b.productId
          ? products.find((x) => x.id === b.productId)
          : null
        return (
          <Card key={b.key}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">品番</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() =>
                  setBlocks((prev) =>
                    prev.length > 1
                      ? prev.filter((x) => x.key !== b.key)
                      : prev,
                  )
                }
                aria-label="品番ブロックを削除"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>品番（必須）</Label>
                  <SearchableSelect
                    options={productOptions}
                    value={b.productId}
                    onChange={(v) => onSelectProduct(b.key, v)}
                    placeholder="品番を選択"
                    ariaLabel="品番"
                  />
                </div>
                <div className="space-y-1">
                  <Label>単価（税抜・この品番の全 SKU に配る）</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={b.unitPrice}
                    onChange={(e) =>
                      patchBlock(b.key, { unitPrice: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* SKU 別数量 */}
              {b.productId && b.skus === null && (
                <p className="text-sm text-muted-foreground">
                  <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                  SKU を読み込み中…
                </p>
              )}
              {b.productId && b.skus !== null && b.skus.length === 0 && (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-700">
                  この品番には SKU が未生成です。品番カルテの「カラー×数量」で SKU
                  を生成してください（受注フォームでは SKU を作りません）。
                </p>
              )}
              {b.skus !== null && b.skus.length > 0 && (
                <div className="space-y-2">
                  {b.skus.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-end gap-3 rounded-md border p-2"
                    >
                      <div className="min-w-40 flex-1 text-sm">
                        <span className="font-medium">{s.colorName}</span>
                        <span className="ml-2 text-muted-foreground">
                          {s.size}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">受注数</Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          className="w-24"
                          value={b.qty[s.id] ?? ""}
                          onChange={(e) =>
                            patchBlock(b.key, {
                              qty: { ...b.qty, [s.id]: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">MOQ 判定</Label>
                        <Select
                          value={b.moq[s.id] ?? SkuMoqStatus.NOT_DETERMINED}
                          onValueChange={(v) =>
                            patchBlock(b.key, {
                              moq: { ...b.moq, [s.id]: v as SkuMoqStatus },
                            })
                          }
                        >
                          <SelectTrigger className="h-9 w-[190px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SKU_MOQ_STATUS_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!b.productId && (
                <p className="text-xs text-muted-foreground">
                  品番を選ぶと、その品番の SKU が表示されます。{p ? "" : ""}
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBlocks((prev) => [...prev, newBlock()])}
        >
          <Plus className="mr-1 h-4 w-4" />
          品番を追加
        </Button>
        <Button onClick={onSubmit} disabled={isPending}>
          {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          {mode === "create" ? "受注を作成" : "更新を保存"}
        </Button>
      </div>
    </div>
  )
}
