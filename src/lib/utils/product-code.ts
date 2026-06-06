/**
 * S-1: 品番表示の主従切替ヘルパー（仕様議事録 v1.0 §9-3）
 *
 * 品番カルテは「社内品番（productCode）」が案件の背骨だが、量産確定時には
 * 「先方品番（clientProductCode）」が下げ札・品質表示・納品書の前面に出る。
 * そのため表示は常にこのヘルパー経由に統一しておき、量産で先方品番が主役に
 * なってもUI/帳票を作り直さずに済むようにする。
 *
 * - 主表示（primary） = clientProductCode があればそれ、無ければ社内品番
 * - 副表示（secondary） = 社内品番を常に併記（主が先方品番でも社内品番を残す）
 */

export type ProductCodeLike = {
  productCode: string
  clientProductCode: string | null
}

/** 主表示に出す品番（先方品番優先、無ければ社内品番） */
export function primaryProductCode(p: ProductCodeLike): string {
  const client = p.clientProductCode?.trim()
  return client && client.length > 0 ? client : p.productCode
}

/**
 * 副表示に出す社内品番。主表示が先方品番になっている場合のみ返す
 * （主＝社内品番のときは併記不要なので null）。
 */
export function secondaryProductCode(p: ProductCodeLike): string | null {
  const client = p.clientProductCode?.trim()
  if (client && client.length > 0 && client !== p.productCode) {
    return p.productCode
  }
  return null
}

/** 主表示が先方品番かどうか（バッジ等の出し分け用） */
export function isClientCodePrimary(p: ProductCodeLike): boolean {
  const client = p.clientProductCode?.trim()
  return !!client && client.length > 0
}
