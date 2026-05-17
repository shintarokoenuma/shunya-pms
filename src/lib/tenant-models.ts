/**
 * テナント分離（Multi-tenant Isolation）の対象モデル whitelist
 *
 * このセットに登録されたモデルに対して、`@/lib/prisma` の Client Extension が
 * 以下を自動適用する：
 *
 *   1. 検索クエリへの `companyId = <effective>` フィルタ自動付与
 *   2. `create` 時の `companyId` 自動付与（明示指定があればそれを優先）
 *   3. `delete` / `deleteMany` の例外化（論理削除を強制：鉄則 #3）
 *   4. 検索時の `deletedAt: null` 自動付与
 *
 * Phase ごとに段階的に拡張する。Phase 0 残：Phase 1A 対象のマスター群を登録。
 *
 * 対象外（意図的に含めない）：
 *   - Company / User / Session / UserLoginHistory / AuditLog（基盤・認証・監査）
 *   - HsCode / FtaRule / BusinessTermsGlossary（グローバル共有マスター）
 */
export const TENANT_MODELS = new Set<string>([
  // Phase 1A: マスター
  "Client",
  "Brand",
  "Supplier",
  "Factory",
  "Contractor",
  "Buyer",
  "Material",

  // Phase 1A: 案件管理（Inquiry → Product/SKU まで）
  "Inquiry",
  "ModelCode",
  "Product",
  "Sku",
  "Collection",
])

/**
 * 論理削除（`deletedAt`）の強制対象モデル。
 * 通常は TENANT_MODELS と一致させる。物理削除を許可したいモデルがあればここから除外。
 */
export const SOFT_DELETE_MODELS = new Set<string>(TENANT_MODELS)
