"use client"

import { useMemo, useState } from "react"
import { useWatch, type UseFormReturn } from "react-hook-form"
import { AlertTriangle, Plus, Trash2 } from "lucide-react"
import type { MaterialType } from "@prisma/client"
import type { MaterialBaseInput } from "@/lib/validators/material"
import type { HsReferenceMaterial } from "@/lib/actions/materials"
import {
  EXPORT_SPEC_FIELDS,
  FABRIC_FORMS,
  FABRIC_FORM_LABELS,
  FIBERS,
  FIBER_LABELS,
  FINISHES,
  FINISH_LABELS,
  TRIM_FORMS,
  TRIM_FORM_LABELS,
  TRIM_MATERIALS,
  TRIM_MATERIAL_LABELS,
  WEAVES,
  WEAVE_LABELS,
  YARN_TYPES,
  YARN_TYPE_LABELS,
  compositionDataSchema,
  compositionTotal,
  type CompositionData,
  type ExportSpecInput,
  type Fiber,
} from "@/lib/hs/export-spec"
import {
  canAdoptCandidate,
  candidateDiffersFromHsCode,
  candidateNote,
  classifyHs,
  displayHsCandidate,
} from "@/lib/hs/classify"
import { buildCopyFromReference } from "@/lib/hs/copy-from-reference"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { COUNTRY_OPTIONS } from "@/lib/constants/countries"
import { ReferenceMaterials } from "./reference-materials"
import { MATERIAL_TYPE_LABELS } from "./labels"

/**
 * B-211 PR-1（P1-D5・案A＋C）: 材料フォームの区画「輸出用の規格」
 * 上から: 似た材料から写す（案C）→ 混率 → 規格（素材タイプで出し分け）→ HS の候補（右）→ HS コード・原産国
 * - 判定は src/lib/hs/classify.ts の純関数（verified=false の間は「要確認」の札）
 * - 「この候補を HS コードに入れる」→ hsCode に入れ hsSource=CANDIDATE。HS コード欄を手で変えたら MANUAL
 * - 保存は親フォームの「保存」（createMaterial / updateMaterial）
 */

const NONE = "__none__"
const NO_ORIGIN_COUNTRY = "__none__"
// 原産国は schema が VarChar(2) なので "OTHER" (4 文字) は使えない
const ORIGIN_COUNTRY_OPTIONS = COUNTRY_OPTIONS.filter((c) => c.value !== "OTHER")

const FABRIC_TYPES: readonly MaterialType[] = ["FABRIC", "LINING", "INTERLINING"]
const TRIM_TYPES: readonly MaterialType[] = [
  "ZIPPER",
  "BUTTON",
  "THREAD",
  "ELASTIC",
  "TAPE",
  "LABEL",
  "HANG_TAG",
  "CARE_LABEL",
]

const MISSING_LABELS: Record<string, string> = {
  composition: "混率",
  fabricWeight: "目付",
  fabricWidth: "幅",
  fabricForm: "織物／編物／不織布",
  yarnType: "糸の種類",
  weave: "組織",
  isDenim: "デニムか",
  isPile: "パイルか",
  finish: "仕上げ",
  trimMaterial: "付属の素材",
  trimForm: "付属の形",
}

type Props = {
  form: UseFormReturn<MaterialBaseInput>
  /** 編集中の材料（似た材料の一覧から自分を除く） */
  excludeId?: string | null
}

type CompositionRowInput = { fiber: Fiber; percent: string | number }

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function ExportSpecSection({ form, excludeId }: Props) {
  const materialType = useWatch({ control: form.control, name: "materialType" })
  const compositionRaw = useWatch({ control: form.control, name: "compositionData" })
  const specRaw = useWatch({ control: form.control, name: "exportSpec" })
  const fabricWeightRaw = useWatch({ control: form.control, name: "fabricWeight" })
  const fabricWidthRaw = useWatch({ control: form.control, name: "fabricWidth" })
  const hsCode = useWatch({ control: form.control, name: "hsCode" })

  const [copiedFrom, setCopiedFrom] = useState<{ code: string; diffs: string[]; copiedComposition: boolean } | null>(null)

  const rows: CompositionRowInput[] = useMemo(
    () => (Array.isArray(compositionRaw) ? (compositionRaw as CompositionRowInput[]) : []),
    [compositionRaw],
  )
  const spec: ExportSpecInput = useMemo(
    () => (specRaw && typeof specRaw === "object" ? specRaw : { version: 1 }),
    [specRaw],
  )
  const fabricWeight = toNumber(fabricWeightRaw)
  const fabricWidth = toNumber(fabricWidthRaw)

  /** 入力途中の混率を数値化（壊れた行は落とす） */
  const composition: CompositionData = useMemo(() => {
    const parsed = compositionDataSchema.safeParse(rows)
    if (parsed.success) return parsed.data
    return rows
      .map((r) => ({ fiber: r.fiber, percent: toNumber(r.percent) }))
      .filter((r): r is { fiber: Fiber; percent: number } => r.percent !== null)
  }, [rows])
  const total = compositionTotal(composition)
  const totalWarn = composition.length > 0 && Math.abs(total - 100) > 0.01
  const rowErrors = form.formState.errors.compositionData as
    | { message?: string; [i: number]: { percent?: { message?: string }; fiber?: { message?: string } } | undefined }
    | undefined

  const result = useMemo(
    () =>
      classifyHs({
        materialType,
        compositionData: composition,
        exportSpec: {
          version: 1,
          ...Object.fromEntries(EXPORT_SPEC_FIELDS.map((k) => [k, spec[k]])),
        },
        fabricWeight,
        fabricWidth,
      }),
    [materialType, composition, spec, fabricWeight, fabricWidth],
  )

  const isFabric = FABRIC_TYPES.includes(materialType)
  const isTrim = TRIM_TYPES.includes(materialType)

  // ---- フォームへの書き込み ------------------------------------------------
  const setRows = (next: CompositionRowInput[]) => {
    form.setValue("compositionData", next, { shouldDirty: true, shouldValidate: false })
  }
  const setSpec = (patch: Partial<ExportSpecInput>) => {
    const next: ExportSpecInput = { ...spec, version: 1, ...patch }
    form.setValue("exportSpec", next, { shouldDirty: true, shouldValidate: false })
  }
  const setSpecField = <K extends keyof ExportSpecInput>(key: K, value: ExportSpecInput[K] | undefined) => {
    const next: ExportSpecInput = { ...spec, version: 1 }
    if (value === undefined) delete next[key]
    else next[key] = value
    form.setValue("exportSpec", next, { shouldDirty: true, shouldValidate: false })
  }

  const adoptCandidate = () => {
    if (!result.code) return
    form.setValue("hsCode", result.code, { shouldDirty: true, shouldValidate: true })
    setSpec({ hsSource: "CANDIDATE", copiedFromMaterialId: undefined })
    setCopiedFrom(null)
  }

  const copyFrom = (ref: HsReferenceMaterial) => {
    // FIX-1 B-1: 純関数で組み立てる。写し先の混率が空なら写し元の混率も写す
    const r = buildCopyFromReference(
      { materialType, compositionData: composition, fabricWeight, fabricWidth },
      ref,
      (t) => MATERIAL_TYPE_LABELS[t],
    )
    form.setValue("exportSpec", r.exportSpec, { shouldDirty: true, shouldValidate: false })
    form.setValue("hsCode", r.hsCode, { shouldDirty: true, shouldValidate: true })
    if (r.compositionData) setRows(r.compositionData)
    setCopiedFrom({ code: ref.materialCode, diffs: r.diffs, copiedComposition: r.compositionData !== null })
  }

  const onHsCodeManualChange = (value: string) => {
    form.setValue("hsCode", value, { shouldDirty: true, shouldValidate: true })
    // 手で変えたら「手入力」（候補と同じ値に戻しても手入力扱い）
    if (spec.hsSource !== "MANUAL" || spec.copiedFromMaterialId) {
      setSpec({ hsSource: "MANUAL", copiedFromMaterialId: undefined })
    }
    setCopiedFrom(null)
  }

  const specSelect = <K extends "fabricForm" | "yarnType" | "weave" | "finish" | "trimMaterial" | "trimForm">(
    key: K,
    label: string,
    values: readonly NonNullable<ExportSpecInput[K]>[],
    labels: Record<NonNullable<ExportSpecInput[K]>, string>,
    note?: string,
  ) => (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <Select
        value={(spec[key] as string | undefined) ?? NONE}
        onValueChange={(v) => setSpecField(key, v === NONE ? undefined : (v as ExportSpecInput[K]))}
      >
        <SelectTrigger>
          <SelectValue placeholder="（未選択）" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>（未選択）</SelectItem>
          {values.map((v) => (
            <SelectItem key={String(v)} value={String(v)}>
              {labels[v]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>輸出用の規格</CardTitle>
        <CardDescription>
          輸出インボイスと HS コードの判定に使う。任意項目（何も入れなくても保存できる）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 1. 似た材料から写す（案C） */}
        <ReferenceMaterials
          materialType={materialType}
          compositionData={composition}
          excludeId={excludeId}
          onCopy={copyFrom}
        />
        {copiedFrom && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p className="font-medium">
              {copiedFrom.code} から規格と HS コード{copiedFrom.copiedComposition && "と混率"}を写しました（保存で確定）
            </p>
            {copiedFrom.diffs.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 text-xs">
                {copiedFrom.diffs.map((d) => (
                  <li key={d}>違う所: {d}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs">素材タイプ・混率・目付・幅に違いはありません</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {/* 2. 混率 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">混率</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setRows([...rows, { fiber: "COTTON", percent: "" }])}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  行を足す
                </Button>
              </div>
              {rows.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  繊維と % を行で入れる（例: 綿 100）。既存の「組成」の文字欄はそのまま残る
                </p>
              )}
              {rows.map((row, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Select
                    value={row.fiber}
                    onValueChange={(v) => {
                      const next = rows.map((r, j) => (j === i ? { ...r, fiber: v as Fiber } : r))
                      setRows(next)
                    }}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIBERS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {FIBER_LABELS[f]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="0.1"
                    className="w-[110px]"
                    value={row.percent === null || row.percent === undefined ? "" : String(row.percent)}
                    onChange={(e) => {
                      const next = rows.map((r, j) => (j === i ? { ...r, percent: e.target.value } : r))
                      setRows(next)
                    }}
                    aria-label={`${FIBER_LABELS[row.fiber]} の %`}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}
                    aria-label="行を消す"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  {(rowErrors?.[i]?.percent?.message || rowErrors?.[i]?.fiber?.message) && (
                    <p className="w-full text-xs text-destructive">
                      {rowErrors?.[i]?.percent?.message ?? rowErrors?.[i]?.fiber?.message}
                    </p>
                  )}
                </div>
              ))}
              {typeof rowErrors?.message === "string" && (
                <p className="text-xs text-destructive">{rowErrors.message}</p>
              )}
              {rows.length > 0 && (
                <p
                  className={
                    totalWarn
                      ? "flex items-center gap-1 text-xs text-amber-700"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {totalWarn && <AlertTriangle className="h-3 w-3" />}
                  合計 {Number.isInteger(total) ? total : total.toFixed(1)}%
                  {totalWarn && "（100% になっていません。保存はできます）"}
                </p>
              )}
            </div>

            {/* 3. 規格（素材タイプで出し分け） */}
            {isFabric && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">生地の規格</Label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {specSelect("fabricForm", "織物／編物／不織布", FABRIC_FORMS, FABRIC_FORM_LABELS)}
                  {specSelect("yarnType", "糸の種類", YARN_TYPES, YARN_TYPE_LABELS, "短繊維＝紡績糸／長繊維")}
                  {specSelect("weave", "組織", WEAVES, WEAVE_LABELS)}
                  {specSelect("finish", "仕上げ", FINISHES, FINISH_LABELS)}
                </div>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={spec.isDenim === true}
                      onCheckedChange={(c) => setSpecField("isDenim", c === true ? true : spec.isDenim === undefined ? undefined : false)}
                    />
                    デニム（綿の先染め綾織・200g/㎡超）
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={spec.isPile === true}
                      onCheckedChange={(c) => setSpecField("isPile", c === true ? true : undefined)}
                    />
                    パイル（編物）
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  目付 {fabricWeight !== null ? `${fabricWeight} g/㎡` : "未入力"}・幅{" "}
                  {fabricWidth !== null ? `${fabricWidth} cm` : "未入力"}（上の「生地仕様」の欄を使います）
                </p>
              </div>
            )}
            {isTrim && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">付属の規格</Label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {specSelect("trimMaterial", "素材", TRIM_MATERIALS, TRIM_MATERIAL_LABELS)}
                  {specSelect("trimForm", "形", TRIM_FORMS, TRIM_FORM_LABELS)}
                </div>
                {(materialType === "THREAD") &&
                  specSelect("yarnType", "糸の種類", YARN_TYPES, YARN_TYPE_LABELS)}
              </div>
            )}
            {!isFabric && !isTrim && (
              <p className="text-xs text-muted-foreground">
                この素材タイプ（{MATERIAL_TYPE_LABELS[materialType]}）は判定の木に無いため、HS コードは手入力です
              </p>
            )}
          </div>

          {/* 4. HS の候補 */}
          <div className="space-y-3 rounded-md border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">HS の候補</p>
              <Badge variant="outline" title="判定の木は澁澤WT と照合前。照合が済むまで「要確認」">
                要確認
              </Badge>
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-mono">{displayHsCandidate(result)}</span>
              {candidateNote(result) && (
                <span className="text-xs text-muted-foreground">{candidateNote(result)}</span>
              )}
            </div>
            <p className="text-sm">{result.label}</p>
            {candidateDiffersFromHsCode(result, hsCode) && (
              <div className="flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                <AlertTriangle className="h-3 w-3" />
                候補と今の HS コードが違います（候補 {result.code}・今 {hsCode}）。保存はできます
              </div>
            )}
            {result.reasons.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                {result.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            {result.missing.length > 0 && (
              <div className="text-xs text-amber-700">
                足りない答え: {result.missing.map((m) => MISSING_LABELS[m] ?? m).join("・")}
              </div>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!canAdoptCandidate(result)}
              onClick={adoptCandidate}
              title={canAdoptCandidate(result) ? undefined : "号まで決まったときだけ入れられます（手入力してください）"}
            >
              この候補を HS コードに入れる
            </Button>
            {hsCode && spec.hsSource && (
              <p className="text-xs text-muted-foreground">
                今の HS コード <span className="font-mono">{hsCode}</span>：
                {spec.hsSource === "CANDIDATE" && "候補から"}
                {spec.hsSource === "COPIED" && "似た材料から写した"}
                {spec.hsSource === "MANUAL" && "手入力"}
              </p>
            )}
          </div>
        </div>

        {/* 5. HS コード・原産国（Phase 1A-13b の欄をこの区画へ移動。保存経路は変えない） */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="hsCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>HS コード</FormLabel>
                <FormControl>
                  <Input
                    placeholder="例：5208.33"
                    maxLength={20}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value ?? ""}
                    onChange={(e) => onHsCodeManualChange(e.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  関税分類コード（任意・形式は緩い）。候補を入れるか、手で入力
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="originCountry"
            render={({ field }) => (
              <FormItem>
                <FormLabel>原産国</FormLabel>
                <Select
                  value={field.value && field.value !== "" ? field.value : NO_ORIGIN_COUNTRY}
                  onValueChange={(v) => field.onChange(v === NO_ORIGIN_COUNTRY ? "" : v)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="（未選択）" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NO_ORIGIN_COUNTRY}>（未選択）</SelectItem>
                    {ORIGIN_COUNTRY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        <span className="font-mono text-xs text-muted-foreground mr-2">{o.value}</span>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>ISO 3166-1 alpha-2（任意）</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* 6. 参考 URL（B-125 の器。詳細ページでも足せる） */}
        <ReferenceUrlsEditor form={form} />
      </CardContent>
    </Card>
  )
}

// =============================================================================
// 参考 URL の行編集（referenceUrls: [{ label, url }]）
// =============================================================================
function ReferenceUrlsEditor({ form }: { form: UseFormReturn<MaterialBaseInput> }) {
  const raw = useWatch({ control: form.control, name: "referenceUrls" })
  const urls = useMemo(
    () => (Array.isArray(raw) ? (raw as { label?: string; url: string }[]) : []),
    [raw],
  )
  const set = (next: { label?: string; url: string }[]) =>
    form.setValue("referenceUrls", next, { shouldDirty: true, shouldValidate: false })
  const errors = form.formState.errors.referenceUrls as
    | { message?: string; [i: number]: { url?: { message?: string } } | undefined }
    | undefined

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">参考 URL（メーカーサイトなど）</Label>
        <Button type="button" size="sm" variant="outline" onClick={() => set([...urls, { label: "", url: "" }])}>
          <Plus className="mr-1 h-3 w-3" />
          URL を足す
        </Button>
      </div>
      {urls.map((u, i) => (
        <div key={i} className="flex items-start gap-2">
          <Input
            placeholder="ラベル（例: メーカー規格書）"
            className="w-[220px]"
            maxLength={100}
            value={u.label ?? ""}
            onChange={(e) => set(urls.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
          />
          <div className="flex-1">
            <Input
              placeholder="https://…"
              maxLength={500}
              value={u.url}
              onChange={(e) => set(urls.map((r, j) => (j === i ? { ...r, url: e.target.value } : r)))}
            />
            {errors?.[i]?.url?.message && (
              <p className="mt-1 text-xs text-destructive">{errors[i]?.url?.message}</p>
            )}
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => set(urls.filter((_, j) => j !== i))}
            aria-label="URL を消す"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {typeof errors?.message === "string" && <p className="text-xs text-destructive">{errors.message}</p>}
    </div>
  )
}
