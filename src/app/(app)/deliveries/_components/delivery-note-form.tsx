"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createDeliveryNote,
  getDepositSuggestions,
  updateDeliveryNote,
  type DepositSuggestion,
  type ClientOption,
  type BuyerOption,
  type DestinationOption,
  type DeliveryProductOption,
} from "@/lib/actions/delivery-notes"
import {
  AllocationDialog,
  type AllocationPickedRow,
} from "./allocation-dialog"

export type ItemRow = {
  productId: string
  productName: string
  clientProductCode: string
  colorName: string
  size: string
  quantity: string
  unit: string
  unitPrice: string
  // B-108 PR2 §C-3: 引き当て元（内部保持のみ・UI 非表示）。手入力行は null。
  // 第1段では画面に出さず、round-trip（編集で消えない）を通すためだけに持つ。
  sourceSampleProductionId: string | null
  sourceWoItemId: string | null
  sourceWorkOrderId: string | null
  sourcePoItemId: string | null
  sourcePurchaseOrderId: string | null
  // B-114 PR-1 §2-3: 量産行（受注の SKU）。skuId があれば色・サイズ・品番は読み取り専用。
  skuId: string | null
  soId: string | null
  soItemId: string | null
  /** 受注の単価（差分表示専用・送信しない）。無ければ "" */
  orderUnitPrice: string
  /** B-109 PR-3（P3-D1）: 前受金の行の印。通常の行は null */
  lineKind: "DEPOSIT" | "DEPOSIT_APPLIED" | null
}

/** 編集フォームの初期値（編集ページが getDeliveryNote から組み立てる）。 */
export type DeliveryNoteFormInitial = {
  clientId: string
  buyerId: string | null
  deliveryDestinationId: string | null
  deliveryDate: string
  showAmounts: boolean
  shipToAddress: string
  shipToContact: string
  shipToPhone: string
  clientNotes: string
  items: ItemRow[]
}

const NONE = "__none__"

function emptyRow(): ItemRow {
  return {
    productId: "",
    productName: "",
    clientProductCode: "",
    colorName: "",
    size: "",
    quantity: "1",
    unit: "枚",
    unitPrice: "",
    // 手入力行は引き当て元を持たない（すべて null）。
    sourceSampleProductionId: null,
    sourceWoItemId: null,
    sourceWorkOrderId: null,
    sourcePoItemId: null,
    sourcePurchaseOrderId: null,
    skuId: null,
    soId: null,
    soItemId: null,
    orderUnitPrice: "",
    lineKind: null,
  }
}

/** B-114 §2-3: 量産行の単価が受注の単価と違うか（違うこと自体は正常・D-2） */
function priceDiffers(row: ItemRow): boolean {
  if (!row.skuId || row.orderUnitPrice === "" || row.unitPrice === "") return false
  return Number(row.unitPrice) !== Number(row.orderUnitPrice)
}
function fmtYen(v: string): string {
  const n = Number(v)
  return Number.isFinite(n) ? `¥${n.toLocaleString("ja-JP")}` : v
}

export function DeliveryNoteForm({
  clients,
  buyers,
  destinations,
  products,
  previewNumber = null,
  defaultDate = "",
  mode = "create",
  id,
  initial,
  currentDeliveryNumber,
}: {
  clients: ClientOption[]
  buyers: BuyerOption[]
  destinations: DestinationOption[]
  products: DeliveryProductOption[]
  previewNumber?: string | null
  defaultDate?: string
  /** 省略時は "create"。編集は "edit"（id / initial / currentDeliveryNumber 必須）。 */
  mode?: "create" | "edit"
  id?: string
  initial?: DeliveryNoteFormInitial
  currentDeliveryNumber?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEdit = mode === "edit"

  const [clientId, setClientId] = useState(initial?.clientId ?? "")
  const [buyerId, setBuyerId] = useState(initial?.buyerId ?? NONE)
  const [destinationId, setDestinationId] = useState(
    initial?.deliveryDestinationId ?? NONE,
  )
  const [deliveryDate, setDeliveryDate] = useState(
    initial?.deliveryDate ?? defaultDate,
  )
  // 追補 v1.1（§6 改訂）: 既定 ON。edit 時は initial.showAmounts を尊重（?? は false を上書きしない）。
  const [showAmounts, setShowAmounts] = useState(initial?.showAmounts ?? true)
  const [shipToAddress, setShipToAddress] = useState(initial?.shipToAddress ?? "")
  const [shipToContact, setShipToContact] = useState(initial?.shipToContact ?? "")
  const [shipToPhone, setShipToPhone] = useState(initial?.shipToPhone ?? "")
  const [clientNotes, setClientNotes] = useState(initial?.clientNotes ?? "")
  const [items, setItems] = useState<ItemRow[]>(
    initial?.items && initial.items.length > 0 ? initial.items : [emptyRow()],
  )

  // B-109 PR-3（P3-D7）: 明細にある受注（soId）に未充当の前受金が残っていれば提案する（保存は止めない）。
  // 集計はサーバ（billing/deposits）。編集中は自分の納品書の行を除く。
  const soIdsKey = useMemo(
    () => [...new Set(items.map((r) => r.soId).filter((v): v is string => !!v))].sort().join(","),
    [items],
  )
  const [suggestions, setSuggestions] = useState<DepositSuggestion[]>([])
  useEffect(() => {
    let alive = true
    const ids = soIdsKey ? soIdsKey.split(",") : []
    if (ids.length === 0) {
      // 受注の行が無ければ提案も無い（setState はコールバック側で行う）
      Promise.resolve().then(() => {
        if (alive) setSuggestions([])
      })
      return () => {
        alive = false
      }
    }
    getDepositSuggestions(ids, isEdit ? id : undefined).then((r) => {
      if (alive) setSuggestions(r.ok ? r.data : [])
    })
    return () => {
      alive = false
    }
  }, [soIdsKey, isEdit, id])
  // フォーム内で既に入れている充当額（受注ごと）を引いた「まだ入れられる額」
  const openSuggestions = suggestions
    .map((sg) => {
      const inForm = items
        .filter((r) => r.lineKind === "DEPOSIT_APPLIED" && r.soId === sg.soId)
        .reduce((a, r) => a + (Number(r.unitPrice) || 0), 0)
      return { ...sg, open: sg.remaining - inForm }
    })
    .filter((sg) => sg.open > 0)
  const addAppliedRow = (sg: DepositSuggestion & { open: number }) =>
    setItems((prev) => [
      ...prev.filter((r) => !(prev.length === 1 && r.productId === "" && r.productName === "")),
      {
        ...emptyRow(),
        productId: sg.productId,
        productName: sg.productName,
        quantity: "-1",
        unit: "式",
        unitPrice: String(sg.open),
        soId: sg.soId,
        lineKind: "DEPOSIT_APPLIED",
      },
    ])

  // クライアントで絞った buyer / destination。
  const clientBuyers = useMemo(
    () => buyers.filter((b) => !clientId || b.clientId === clientId),
    [buyers, clientId],
  )
  const buyerDestinations = useMemo(
    () =>
      buyerId === NONE ? [] : destinations.filter((d) => d.buyerId === buyerId),
    [destinations, buyerId],
  )

  const setItem = (idx: number, patch: Partial<ItemRow>) =>
    setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))

  const onPickProduct = (idx: number, productId: string) => {
    const p = products.find((x) => x.id === productId)
    setItem(idx, {
      productId,
      productName: p?.productName ?? "",
      clientProductCode: p?.clientProductCode ?? "",
    })
  }

  const addRow = () => setItems((prev) => [...prev, emptyRow()])
  const removeRow = (idx: number) =>
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))

  // 引き当てダイアログからの一括追加。既存が「空の1行だけ」なら置き換える。
  const handleAllocationAdd = (picked: AllocationPickedRow[]) => {
    // 引き当て行は通常の行（lineKind null）
    const rows: ItemRow[] = picked.map((r) => ({ ...r, lineKind: null }))
    setItems((prev) => {
      const isPristine =
        prev.length === 1 &&
        prev[0].productId === "" &&
        prev[0].productName === ""
      return isPristine ? rows : [...prev, ...rows]
    })
  }

  const onSubmit = () => {
    if (!clientId) {
      toast.error("クライアントを選択してください")
      return
    }
    // §6: 金額表示ON かつ単価未入力の明細があれば保存前に警告（ブロックしない）。
    // サーバ側 warnings は保存後のナビゲーションで取りこぼされうるため、保存前の
    // クライアント警告を主とする（判定基準は payload と同じ r.unitPrice === ""）。
    if (showAmounts && items.some((r) => r.unitPrice === "")) {
      toast.warning("単価が未入力の明細があります（金額は空欄で保存されます）")
    }
    const payload = {
      clientId,
      buyerId: buyerId === NONE ? null : buyerId,
      deliveryDestinationId: destinationId === NONE ? null : destinationId,
      deliveryDate,
      currency: "JPY",
      showAmounts,
      shipToAddress: shipToAddress || null,
      shipToContact: shipToContact || null,
      shipToPhone: shipToPhone || null,
      clientNotes: clientNotes || null,
      items: items.map((r) => ({
        productId: r.productId,
        productName: r.productName,
        clientProductCode: r.clientProductCode || null,
        colorName: r.colorName || null,
        size: r.size || null,
        quantity: r.quantity,
        unit: r.unit || "枚",
        unitPrice: r.unitPrice === "" ? null : r.unitPrice,
        // §C-3: 引き当て元を action へ透過（内部保持値をそのまま渡す）。
        sourceSampleProductionId: r.sourceSampleProductionId,
        sourceWoItemId: r.sourceWoItemId,
        sourceWorkOrderId: r.sourceWorkOrderId,
        sourcePoItemId: r.sourcePoItemId,
        sourcePurchaseOrderId: r.sourcePurchaseOrderId,
        // B-114 §2-3: 量産行の受注紐付け（orderUnitPrice は送らない）。
        skuId: r.skuId,
        soId: r.soId,
        soItemId: r.soItemId,
        // B-109 PR-3（P3-D1）: 前受金の行の印
        lineKind: r.lineKind,
      })),
    }
    startTransition(async () => {
      const r =
        isEdit && id
          ? await updateDeliveryNote(id, payload)
          : await createDeliveryNote(payload)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      // 単価未入力の警告は保存前に出す（上記）。サーバ側 warnings の生成ロジックは
      // 温存しつつ、同一メッセージの二重表示とナビゲーション取りこぼしを避けるため、
      // ここでの再表示はしない。
      toast.success(
        isEdit
          ? `納品書 ${r.data.deliveryNumber} を更新しました`
          : `納品書 ${r.data.deliveryNumber} を作成しました`,
      )
      // router.refresh() は push が遷移先を取得するため不要（二重レンダの原因）。
      router.push(`/deliveries/${r.data.id}`)
    })
  }

  return (
    <div className="space-y-6">
      {/* ヘッダ */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label>{isEdit ? "DLV番号" : "DLV番号（保存時に確定）"}</Label>
          <Input
            value={
              isEdit
                ? currentDeliveryNumber ?? ""
                : previewNumber ?? "（保存時に採番）"
            }
            disabled
            className="font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label>納品日</Label>
          <Input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>クライアント（必須）</Label>
          <Select
            value={clientId}
            onValueChange={(v) => {
              setClientId(v)
              setBuyerId(NONE)
              setDestinationId(NONE)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="font-mono text-xs text-muted-foreground mr-2">
                    {c.clientCode}
                  </span>
                  {c.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>バイヤー（任意）</Label>
          <Select
            value={buyerId}
            onValueChange={(v) => {
              setBuyerId(v)
              setDestinationId(NONE)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="（指定なし）" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>（指定なし）</SelectItem>
              {clientBuyers.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  <span className="font-mono text-xs text-muted-foreground mr-2">
                    {b.buyerCode}
                  </span>
                  {b.buyerName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>納品先（任意）</Label>
          <Select
            value={destinationId}
            onValueChange={setDestinationId}
            disabled={buyerId === NONE}
          >
            <SelectTrigger>
              <SelectValue placeholder="（指定なし）" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>（指定なし）</SelectItem>
              {buyerDestinations.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  <span className="font-mono text-xs text-muted-foreground mr-2">
                    {d.destinationCode}
                  </span>
                  {d.destinationName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 宛先の上書き（任意・未入力ならマスターから自動解決） */}
      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-medium">送り先（未入力ならマスターから自動補完）</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1 md:col-span-3">
            <Label className="text-xs">住所（上書き）</Label>
            <Input
              value={shipToAddress}
              onChange={(e) => setShipToAddress(e.target.value)}
              placeholder="空欄なら 納品先→バイヤー→クライアント配送先→基本住所 で自動補完"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">担当者（上書き）</Label>
            <Input
              value={shipToContact}
              onChange={(e) => setShipToContact(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">電話（上書き）</Label>
            <Input
              value={shipToPhone}
              onChange={(e) => setShipToPhone(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 金額 */}
      <div className="flex flex-wrap items-center gap-4 rounded-md border p-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={showAmounts}
            onCheckedChange={(c) => setShowAmounts(c === true)}
          />
          金額を表示する（単価・小計）
        </label>
        {/* B-224（D-40）: 消費税率の欄は無い。税は合計請求書でまとめて計算する */}
      </div>

      {/* 明細 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">明細</p>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={addRow}>
              <Plus className="mr-1 h-4 w-4" />
              行を追加
            </Button>
            <AllocationDialog
              clientId={clientId}
              onAdd={handleAllocationAdd}
              existingSoItemIds={items.map((r) => r.soItemId).filter((v): v is string => !!v)}
            />
          </div>
        </div>
        {/* B-109 PR-2b（D-26・D-28）: 赤伝の説明。数量 input に min は付けない */}
        <p className="text-xs text-muted-foreground">
          値引き・返品はマイナスの数量で入れてください（赤伝）。単価はプラスのままにします。
        </p>
        {/* B-109 PR-3（P3-D7）: 充当していない前受金の提案（保存は止めない） */}
        {openSuggestions.map((sg) => (
          <div
            key={sg.soId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {sg.soNumber} に充当していない前受金 ¥{sg.open.toLocaleString("ja-JP")} があります
              </span>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => addAppliedRow(sg)}>
              充当の行を入れる
            </Button>
          </div>
        ))}
        <div className="space-y-3">
          {items.map((row, idx) => {
            const isMass = !!row.skuId
            const isDeposit = !!row.lineKind
            const differs = priceDiffers(row)
            return (
            <div
              key={idx}
              className={"space-y-2 rounded-md border p-3" + (differs ? " bg-amber-50" : "")}
            >
              {isMass && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">量産</Badge>
                  受注の SKU（品番・色・サイズは変更できません）
                </div>
              )}
              {isDeposit && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{row.lineKind === "DEPOSIT" ? "前受金" : "前受金充当"}</Badge>
                  {row.lineKind === "DEPOSIT_APPLIED"
                    ? "数量は −1 固定。金額（単価）は未充当の範囲で減らせます"
                    : "前受金の行（受注から作られたもの）"}
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">品番（必須）</Label>
                  <Select
                    value={row.productId || ""}
                    onValueChange={(v) => onPickProduct(idx, v)}
                    disabled={isMass || isDeposit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="品番を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            {p.productCode}
                          </span>
                          {p.productName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">品名</Label>
                  <Input
                    value={row.productName}
                    onChange={(e) => setItem(idx, { productName: e.target.value })}
                    placeholder="品名（ビーカー等は自由入力）"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <div className="space-y-1">
                  <Label className="text-xs">先方品番</Label>
                  <Input
                    value={row.clientProductCode}
                    onChange={(e) =>
                      setItem(idx, { clientProductCode: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">色</Label>
                  <Input
                    value={row.colorName}
                    onChange={(e) => setItem(idx, { colorName: e.target.value })}
                    readOnly={isMass}
                    className={isMass ? "bg-muted" : undefined}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">サイズ</Label>
                  <Input
                    value={row.size}
                    onChange={(e) => setItem(idx, { size: e.target.value })}
                    readOnly={isMass}
                    className={isMass ? "bg-muted" : undefined}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">数量</Label>
                  <Input
                    type="number"
                    value={row.quantity}
                    onChange={(e) => setItem(idx, { quantity: e.target.value })}
                    readOnly={isDeposit}
                    className={isDeposit ? "bg-muted" : undefined}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">単位</Label>
                  <Input
                    value={row.unit}
                    onChange={(e) => setItem(idx, { unit: e.target.value })}
                  />
                </div>
              </div>
              {showAmounts && (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  <div className="space-y-1">
                    <Label className="text-xs">単価</Label>
                    <Input
                      type="number"
                      value={row.unitPrice}
                      onChange={(e) => setItem(idx, { unitPrice: e.target.value })}
                      placeholder="未定なら空欄"
                    />
                    {differs && (
                      <p className="text-xs text-amber-700">受注 {fmtYen(row.orderUnitPrice)}</p>
                    )}
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(idx)}
                  disabled={items.length <= 1}
                >
                  <Trash2 className="mr-1 h-4 w-4 text-destructive" />
                  行を削除
                </Button>
              </div>
            </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-1">
        <Label>クライアント向けメモ（任意）</Label>
        <Input
          value={clientNotes}
          onChange={(e) => setClientNotes(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() =>
            router.push(isEdit && id ? `/deliveries/${id}` : "/deliveries")
          }
          disabled={isPending}
        >
          キャンセル
        </Button>
        <Button onClick={onSubmit} disabled={isPending}>
          {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          {isEdit ? "更新" : "作成"}
        </Button>
      </div>
    </div>
  )
}
