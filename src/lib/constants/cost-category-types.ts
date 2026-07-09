import { ExternalCostCategory } from "@prisma/client"

/**
 * 費目 大分類（ExternalCostCategory）の共通ラベル・業務並び順。
 *
 * - work-order-types.ts / rough-estimate-types.ts と同じ中立構成（enum は @prisma/client から import・
 *   このファイル自体は client からも安全に import 可）。
 * - Record は全値網羅（漏れると型エラー＝house rule）。
 * - 既存の費目マスター画面（cost-categories/_components/labels.ts）にも同名ラベルがあるが、
 *   費目 select のグルーピング等 lib 横断で使うため lib/constants に正典を置く。
 */
export const EXTERNAL_COST_CATEGORY_LABELS: Record<ExternalCostCategory, string> =
  {
    MATERIAL: "材料費",
    SEWING: "縫製費",
    PROCESSING: "加工費",
    OVERHEAD: "諸経費",
  }

/** 業務順（材料→縫製→加工→諸経費）。費目 select の分類グループ並びに使う。 */
export const EXTERNAL_COST_CATEGORY_ORDER: ExternalCostCategory[] = [
  ExternalCostCategory.MATERIAL,
  ExternalCostCategory.SEWING,
  ExternalCostCategory.PROCESSING,
  ExternalCostCategory.OVERHEAD,
]
