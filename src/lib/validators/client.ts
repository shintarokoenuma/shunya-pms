import { z } from "zod"
import {
  ClientBusinessType,
  ClientDisplayPattern,
  ClientSize,
  ClientStatus,
  LeadSource,
} from "@prisma/client"

// =============================================================================
// 共通バリデーション
// =============================================================================

/** 任意の文字列フィールド。空文字列 OR max 文字までを受け入れる。 */
const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

/** 任意のメールアドレス。空文字列 OR 有効なメール形式を受け入れる。 */
const optionalEmail = z
  .string()
  .max(255, "255文字以内で入力してください")
  .refine(
    (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "メールアドレスの形式が正しくありません"
  )
  .default("")

/** 任意の URL。空文字列 OR 有効な URL を受け入れる。 */
const optionalUrl = z
  .string()
  .max(500, "500文字以内で入力してください")
  .refine(
    (v) => {
      if (v === "") return true
      try {
        new URL(v)
        return true
      } catch {
        return false
      }
    },
    "URL の形式が正しくありません"
  )
  .default("")

// =============================================================================
// Client 基本スキーマ（Tier 1：13項目）
//
// 注: taxId と isQualifiedInvoiceIssuer はスキーマには存在するが、UI からは
// 削除した。shunya はクライアントに請求書を発行する側のため、クライアントの
// T番号は業務上不要。仕入先マスター（後続）では Tier 1 として復活させる。
// =============================================================================

export const clientBaseSchema = z.object({
  // 基本
  clientCode: z
    .string()
    .trim()
    .min(1, "クライアントコードは必須です")
    .max(50, "50文字以内で入力してください")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "英数字・ハイフン・アンダースコアのみ使用できます"
    ),
  companyName: z
    .string()
    .trim()
    .min(1, "会社名は必須です")
    .max(255, "255文字以内で入力してください"),
  legalEntity: optionalString(255),

  // 分類
  businessType: z.nativeEnum(ClientBusinessType),
  clientSize: z.nativeEnum(ClientSize).optional(),

  // 連絡先
  country: z
    .string()
    .trim()
    .length(2, "ISO 3166-1 alpha-2 の2文字で入力してください")
    .toUpperCase()
    .default("JP"),
  phone: optionalString(50),
  email: optionalEmail,
  website: optionalUrl,
  address: optionalString(1000),

  // 表示
  displayPattern: z.nativeEnum(ClientDisplayPattern).default("B"),

  // 営業
  leadSource: z.nativeEnum(LeadSource).optional(),
  referrer: optionalString(255),

  // 運用
  status: z.nativeEnum(ClientStatus).default("ACTIVE"),
  notes: optionalString(5000),
})

export type ClientBaseInput = z.input<typeof clientBaseSchema>
export type ClientBaseOutput = z.output<typeof clientBaseSchema>

// =============================================================================
// 用途別スキーマ
// =============================================================================

export const createClientSchema = clientBaseSchema
export const updateClientSchema = clientBaseSchema.partial()

export type CreateClientInput = z.input<typeof createClientSchema>
export type UpdateClientInput = z.input<typeof updateClientSchema>

// =============================================================================
// 一覧クエリ用スキーマ
// =============================================================================

export const listClientsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.nativeEnum(ClientStatus).optional(),
  businessType: z.nativeEnum(ClientBusinessType).optional(),
  country: z.string().trim().length(2).toUpperCase().optional(),
  sort: z
    .enum(["companyName", "clientCode", "createdAt", "updatedAt"])
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListClientsQuery = z.input<typeof listClientsQuerySchema>
