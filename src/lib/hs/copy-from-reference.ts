import type { MaterialType } from "@prisma/client"
import {
  EXPORT_SPEC_FIELDS,
  formatComposition,
  type CompositionData,
  type ExportSpec,
  type ExportSpecInput,
} from "./export-spec"

/**
 * B-211 PR-1 FIX-1（B-1）: 「似た材料から写す」の純関数
 * - 規格（EXPORT_SPEC_FIELDS）と hsCode を写し、hsSource=COPIED・copiedFromMaterialId を付ける
 * - 写し先の混率（compositionData）が空なら写し元の混率も写す。入っていれば写さず「違う所」に出す
 * - 目付・幅・素材タイプは写さない（違う所として返す）
 */
export type CopySource = {
  id: string
  materialCode: string
  materialType: MaterialType
  compositionData: CompositionData
  exportSpec: ExportSpec | null
  hsCode: string
  fabricWeight: number | null
  fabricWidth: number | null
}

export type CopyTarget = {
  materialType: MaterialType
  compositionData: CompositionData
  fabricWeight: number | null
  fabricWidth: number | null
}

export type CopyResult = {
  exportSpec: ExportSpecInput
  hsCode: string
  /** null = 写し先の混率は変えない */
  compositionData: CompositionData | null
  diffs: string[]
}

export function buildCopyFromReference(
  target: CopyTarget,
  ref: CopySource,
  typeLabel: (t: MaterialType) => string = (t) => t,
): CopyResult {
  const patch: Partial<ExportSpecInput> = {}
  for (const k of EXPORT_SPEC_FIELDS) {
    const v = ref.exportSpec?.[k]
    if (v !== undefined && v !== null) (patch as Record<string, unknown>)[k] = v
  }
  const exportSpec: ExportSpecInput = {
    version: 1,
    ...patch,
    hsSource: "COPIED",
    copiedFromMaterialId: ref.id,
  }

  const targetEmpty = target.compositionData.length === 0
  const compositionData =
    targetEmpty && ref.compositionData.length > 0 ? ref.compositionData.map((r) => ({ ...r })) : null

  const diffs: string[] = []
  if (ref.materialType !== target.materialType) {
    diffs.push(`素材タイプ: ${typeLabel(ref.materialType)} ↔ ${typeLabel(target.materialType)}`)
  }
  if (compositionData === null) {
    const mine = formatComposition(target.compositionData)
    const theirs = formatComposition(ref.compositionData)
    if (theirs && mine !== theirs) diffs.push(`混率: ${theirs} ↔ ${mine || "未入力"}`)
  }
  if (ref.fabricWeight !== null && ref.fabricWeight !== target.fabricWeight) {
    diffs.push(`目付: ${ref.fabricWeight} g/㎡ ↔ ${target.fabricWeight !== null ? `${target.fabricWeight} g/㎡` : "未入力"}`)
  }
  if (ref.fabricWidth !== null && ref.fabricWidth !== target.fabricWidth) {
    diffs.push(`幅: ${ref.fabricWidth} cm ↔ ${target.fabricWidth !== null ? `${target.fabricWidth} cm` : "未入力"}`)
  }
  return { exportSpec, hsCode: ref.hsCode, compositionData, diffs }
}
