"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  updateDeliveryNote,
  type ClientOption,
  type BuyerOption,
  type DestinationOption,
  type DeliveryProductOption,
} from "@/lib/actions/delivery-notes"

export type ItemRow = {
  productId: string
  productName: string
  clientProductCode: string
  colorName: string
  size: string
  quantity: string
  unit: string
  unitPrice: string
}

/** 編集フォームの初期値（編集ページが getDeliveryNote から組み立てる）。 */
export type DeliveryNoteFormInitial = {
  clientId: string
  buyerId: string | null
  deliveryDestinationId: string | null
  deliveryDate: string
  showAmounts: boolean
  taxRatePercent: string
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
  }
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
  const [taxRatePercent, setTaxRatePercent] = useState(
    initial?.taxRatePercent ?? "10",
  )
  const [shipToAddress, setShipToAddress] = useState(initial?.shipToAddress ?? "")
  const [shipToContact, setShipToContact] = useState(initial?.shipToContact ?? "")
  const [shipToPhone, setShipToPhone] = useState(initial?.shipToPhone ?? "")
  const [clientNotes, setClientNotes] = useState(initial?.clientNotes ?? "")
  const [items, setItems] = useState<ItemRow[]>(
    initial?.items && initial.items.length > 0 ? initial.items : [emptyRow()],
  )

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
      taxRatePercent,
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
          金額を表示する（単価・小計・消費税・合計）
        </label>
        {showAmounts && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">消費税率(%)</Label>
            <Input
              type="number"
              value={taxRatePercent}
              onChange={(e) => setTaxRatePercent(e.target.value)}
              className="h-8 w-[80px]"
            />
          </div>
        )}
      </div>

      {/* 明細 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">明細</p>
          <Button type="button" size="sm" variant="outline" onClick={addRow}>
            <Plus className="mr-1 h-4 w-4" />
            行を追加
          </Button>
        </div>
        <div className="space-y-3">
          {items.map((row, idx) => (
            <div key={idx} className="space-y-2 rounded-md border p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">品番（必須）</Label>
                  <Select
                    value={row.productId || ""}
                    onValueChange={(v) => onPickProduct(idx, v)}
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
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">サイズ</Label>
                  <Input
                    value={row.size}
                    onChange={(e) => setItem(idx, { size: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">数量</Label>
                  <Input
                    type="number"
                    value={row.quantity}
                    onChange={(e) => setItem(idx, { quantity: e.target.value })}
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
          ))}
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
