"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Currency, OrderSourceType, SkuMoqStatus, YieldMode } from "@prisma/client"
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
import { computeProductionQuantity } from "@/lib/calc/sales-order-quantity"
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

/** 編集時にサーバから渡す初期グループ（品番ごとに単価と SKU 別数量・歩留まりを復元）。 */
export type InitialGroup = {
  productId: string
  unitPrice: number | null
  skus: {
    skuId: string
    orderedQuantity: number
    moqStatus: SkuMoqStatus
    yieldMode: YieldMode | null
    yieldRate: number | null
    yieldQuantity: number | null
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

/** 歩留まりの一括適用の粒度（E-5）。 */
type YieldGranularity = "UNIFORM" | "COLOR" | "SIZE" | "SKU"

type Block = {
  key: string
  productId: string | null
  unitPrice: string
  skus: SkuRow[] | null // null=未ロード
  qty: Record<string, string>
  moq: Record<string, SkuMoqStatus>
  // 歩留まりの一括適用コントロール（ブロック単位・E-5）
  yGran: YieldGranularity
  yBulkMode: YieldMode
  yBulkUniform: string
  yBulkByColor: Record<string, string> // colorwayId -> 値
  yBulkBySize: Record<string, string> // size -> 値
  // 各 SKU に解決された歩留まり（保存はこの2つ・SKU 行単位・D-3）
  ymode: Record<string, YieldMode> // skuId -> 方式
  yval: Record<string, string> // skuId -> 値（方式で率/枚を解釈）
}

const DEFAULT_YIELD_RATE = "5" // 既定は率 5%（D-4）

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
    yGran: "UNIFORM",
    yBulkMode: YieldMode.RATE,
    yBulkUniform: DEFAULT_YIELD_RATE,
    yBulkByColor: {},
    yBulkBySize: {},
    ymode: {},
    yval: {},
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
          unitPrice: g.unitPrice === null ? "" : String(g.unitPrice),
          skus: null, // マウント後に読み込む（下の loadSkus）
          qty: Object.fromEntries(
            g.skus.map((s) => [s.skuId, String(s.orderedQuantity)]),
          ),
          moq: Object.fromEntries(g.skus.map((s) => [s.skuId, s.moqStatus])),
          yGran: "UNIFORM" as YieldGranularity,
          yBulkMode: YieldMode.RATE,
          yBulkUniform: DEFAULT_YIELD_RATE,
          yBulkByColor: {},
          yBulkBySize: {},
          ymode: Object.fromEntries(
            g.skus.map((s) => [s.skuId, s.yieldMode ?? YieldMode.RATE]),
          ),
          yval: Object.fromEntries(
            g.skus.map((s) => [
              s.skuId,
              (s.yieldMode ?? YieldMode.RATE) === YieldMode.QUANTITY
                ? s.yieldQuantity === null
                  ? ""
                  : String(s.yieldQuantity)
                : s.yieldRate === null
                  ? ""
                  : String(s.yieldRate),
            ]),
          ),
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
    const loaded = r.data
    // 各 SKU の歩留まりに既定（率 5%）を敷く。編集復元済みの値は保持する。
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.key !== key) return b
        const ymode = { ...b.ymode }
        const yval = { ...b.yval }
        for (const s of loaded) {
          if (ymode[s.id] === undefined) ymode[s.id] = YieldMode.RATE
          if (yval[s.id] === undefined) yval[s.id] = DEFAULT_YIELD_RATE
        }
        return { ...b, skus: loaded, ymode, yval }
      }),
    )
  }

  const onSelectProduct = (key: string, productId: string) => {
    // 品番が変わったら SKU と入力をリセット（歩留まりの解決値も含む）
    patchBlock(key, { productId, skus: null, qty: {}, moq: {}, ymode: {}, yval: {} })
    startTransition(async () => {
      await loadSkus(key, productId)
    })
  }

  /** ブロックの歩留まりを、選んだ粒度で各 SKU に配る（E-5）。 */
  const applyYield = (key: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.key !== key) return b
        if (b.yGran === "SKU") return b // SKU 個別は各行を直接編集
        const skus = b.skus ?? []
        const ymode = { ...b.ymode }
        const yval = { ...b.yval }
        for (const s of skus) {
          let v = ""
          if (b.yGran === "UNIFORM") v = b.yBulkUniform
          else if (b.yGran === "COLOR") v = b.yBulkByColor[s.colorwayId] ?? ""
          else if (b.yGran === "SIZE") v = b.yBulkBySize[s.size] ?? ""
          ymode[s.id] = b.yBulkMode
          yval[s.id] = v
        }
        return { ...b, ymode, yval }
      }),
    )
  }

  /** 各 SKU 行の量産数量プレビュー（受注数＋歩留まり・純関数を共用）。 */
  const previewProduction = (b: Block, skuId: string): number => {
    const ordered = Number(b.qty[skuId] || 0)
    const mode = b.ymode[skuId] ?? YieldMode.RATE
    const raw = b.yval[skuId]
    const val = raw === "" || raw === undefined ? null : Number(raw)
    return computeProductionQuantity(
      ordered,
      mode === YieldMode.QUANTITY ? "QUANTITY" : "RATE",
      mode === YieldMode.RATE ? val : null,
      mode === YieldMode.QUANTITY ? val : null,
    )
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
      // 単価は任意（B-167）。入力があるときだけ 0 以上を確認する。
      if (b.unitPrice !== "" && Number(b.unitPrice) < 0) {
        toast.error("単価は0以上で入力してください")
        return
      }
      const targetSkus = (b.skus ?? []).filter(
        (s) => Number(b.qty[s.id] || 0) >= 1,
      )
      // 歩留まりの値が方式に対して空でないこと（率/枚のいずれも入力必須）。
      for (const s of targetSkus) {
        const raw = b.yval[s.id]
        if (raw === "" || raw === undefined) {
          toast.error("各 SKU に歩留まり（率 or 枚数）を入力してください")
          return
        }
      }
      const skusPayload = targetSkus.map((s) => {
        const mode = b.ymode[s.id] ?? YieldMode.RATE
        const val = Number(b.yval[s.id])
        return {
          skuId: s.id,
          orderedQuantity: Number(b.qty[s.id]),
          moqStatus: b.moq[s.id] ?? SkuMoqStatus.NOT_DETERMINED,
          moqDecisionReason: "",
          yieldMode: mode,
          yieldRate: mode === YieldMode.RATE ? val : null,
          yieldQuantity: mode === YieldMode.QUANTITY ? val : null,
        }
      })
      if (skusPayload.length === 0) {
        toast.error("各品番に受注数（1以上）の SKU を1件以上入力してください")
        return
      }
      productsPayload.push({
        productId: b.productId,
        unitPrice: b.unitPrice === "" ? null : Number(b.unitPrice),
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
                  <Label>単価（税抜・任意・この品番の全 SKU に配る）</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    placeholder="未定なら空欄"
                    value={b.unitPrice}
                    onChange={(e) =>
                      patchBlock(b.key, { unitPrice: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* 歩留まりの一括適用（E-5・D-4） */}
              {b.skus !== null && b.skus.length > 0 && (
                <div className="space-y-2 rounded-md border bg-muted/30 p-2">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">歩留まりの適用粒度</Label>
                      <Select
                        value={b.yGran}
                        onValueChange={(v) =>
                          patchBlock(b.key, { yGran: v as YieldGranularity })
                        }
                      >
                        <SelectTrigger className="h-9 w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNIFORM">一律</SelectItem>
                          <SelectItem value="COLOR">色別</SelectItem>
                          <SelectItem value="SIZE">サイズ別</SelectItem>
                          <SelectItem value="SKU">SKU 個別</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {b.yGran !== "SKU" && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">方式</Label>
                          <Select
                            value={b.yBulkMode}
                            onValueChange={(v) =>
                              patchBlock(b.key, { yBulkMode: v as YieldMode })
                            }
                          >
                            <SelectTrigger className="h-9 w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={YieldMode.RATE}>率(%)</SelectItem>
                              <SelectItem value={YieldMode.QUANTITY}>
                                加算枚数(+枚)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {b.yGran === "UNIFORM" && (
                          <div className="space-y-1">
                            <Label className="text-xs">
                              値（{b.yBulkMode === YieldMode.RATE ? "%" : "枚"}）
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              inputMode="decimal"
                              className="w-24"
                              value={b.yBulkUniform}
                              onChange={(e) =>
                                patchBlock(b.key, { yBulkUniform: e.target.value })
                              }
                            />
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => applyYield(b.key)}
                        >
                          適用
                        </Button>
                      </>
                    )}
                  </div>
                  {/* 色別・サイズ別の入力欄 */}
                  {b.yGran === "COLOR" && (
                    <div className="flex flex-wrap gap-2">
                      {Array.from(
                        new Map(
                          b.skus.map((s) => [
                            s.colorwayId,
                            { id: s.colorwayId, name: s.colorName },
                          ]),
                        ).values(),
                      ).map((c) => (
                        <div key={c.id} className="space-y-1">
                          <Label className="text-xs">{c.name}</Label>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            inputMode="decimal"
                            className="w-20"
                            value={b.yBulkByColor[c.id] ?? ""}
                            onChange={(e) =>
                              patchBlock(b.key, {
                                yBulkByColor: {
                                  ...b.yBulkByColor,
                                  [c.id]: e.target.value,
                                },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {b.yGran === "SIZE" && (
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(b.skus.map((s) => s.size))).map((sz) => (
                        <div key={sz} className="space-y-1">
                          <Label className="text-xs">{sz}</Label>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            inputMode="decimal"
                            className="w-20"
                            value={b.yBulkBySize[sz] ?? ""}
                            onChange={(e) =>
                              patchBlock(b.key, {
                                yBulkBySize: {
                                  ...b.yBulkBySize,
                                  [sz]: e.target.value,
                                },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    「適用」で各 SKU の歩留まりを埋めます（SKU 個別は各行で直接編集）。量産数量＝受注数＋歩留まり。
                  </p>
                </div>
              )}

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
                      <div className="space-y-1">
                        <Label className="text-xs">歩留まり</Label>
                        <div className="flex items-center gap-1">
                          <Select
                            value={b.ymode[s.id] ?? YieldMode.RATE}
                            onValueChange={(v) =>
                              patchBlock(b.key, {
                                ymode: { ...b.ymode, [s.id]: v as YieldMode },
                              })
                            }
                          >
                            <SelectTrigger className="h-9 w-[72px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={YieldMode.RATE}>%</SelectItem>
                              <SelectItem value={YieldMode.QUANTITY}>+枚</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            inputMode="decimal"
                            className="w-20"
                            value={b.yval[s.id] ?? ""}
                            onChange={(e) =>
                              patchBlock(b.key, {
                                yval: { ...b.yval, [s.id]: e.target.value },
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">量産数量</Label>
                        <div className="flex h-9 items-center px-1 text-sm tabular-nums">
                          {previewProduction(b, s.id).toLocaleString("ja-JP")}
                        </div>
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
