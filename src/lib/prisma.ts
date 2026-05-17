import { PrismaClient } from "@prisma/client"
import {
  getEffectiveCompanyId,
  getTenantContext,
  isBypassed,
} from "./tenant-context"
import { SOFT_DELETE_MODELS, TENANT_MODELS } from "./tenant-models"

// ---------------------------------------------------------------------------
// where / data への自動マージヘルパー
// ---------------------------------------------------------------------------

function injectListWhere(
  model: string,
  where: Record<string, unknown> | undefined
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(where ?? {}) }

  if (TENANT_MODELS.has(model) && next.companyId === undefined) {
    next.companyId = getEffectiveCompanyId()
  }

  if (SOFT_DELETE_MODELS.has(model) && next.deletedAt === undefined) {
    next.deletedAt = null
  }

  return next
}

function injectCreateData(
  model: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  if (!TENANT_MODELS.has(model)) return data
  if (data.companyId !== undefined) return data
  return { ...data, companyId: getEffectiveCompanyId() }
}

// Extension が active な状態か（コンテキストがあり、bypass されていない）
function isExtensionActive(): boolean {
  return !isBypassed() && !!getTenantContext()
}

// ---------------------------------------------------------------------------
// Prisma Client 構築
// ---------------------------------------------------------------------------

function buildClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  }).$extends({
    name: "shunya-tenant-isolation",
    query: {
      $allModels: {
        // ===== 検索系：where に companyId / deletedAt を注入 =====
        async findMany({ model, args, query }) {
          if (isExtensionActive()) {
            args.where = injectListWhere(
              model,
              args.where as Record<string, unknown> | undefined
            ) as never
          }
          return query(args)
        },
        async findFirst({ model, args, query }) {
          if (isExtensionActive()) {
            args.where = injectListWhere(
              model,
              args.where as Record<string, unknown> | undefined
            ) as never
          }
          return query(args)
        },
        async findFirstOrThrow({ model, args, query }) {
          if (isExtensionActive()) {
            args.where = injectListWhere(
              model,
              args.where as Record<string, unknown> | undefined
            ) as never
          }
          return query(args)
        },
        async count({ model, args, query }) {
          if (isExtensionActive()) {
            args.where = injectListWhere(
              model,
              args.where as Record<string, unknown> | undefined
            ) as never
          }
          return query(args)
        },
        async aggregate({ model, args, query }) {
          if (isExtensionActive()) {
            args.where = injectListWhere(
              model,
              args.where as Record<string, unknown> | undefined
            ) as never
          }
          return query(args)
        },
        async groupBy({ model, args, query }) {
          if (isExtensionActive()) {
            args.where = injectListWhere(
              model,
              args.where as Record<string, unknown> | undefined
            ) as never
          }
          return query(args)
        },

        // ===== findUnique 系：クエリ後に検証して他テナント漏れを防ぐ =====
        async findUnique({ model, args, query }) {
          const result = await query(args)
          if (!result || !isExtensionActive() || !TENANT_MODELS.has(model)) {
            return result
          }
          const r = result as { companyId?: string; deletedAt?: Date | null }
          const effective = getEffectiveCompanyId()
          if (r.companyId && r.companyId !== effective) return null
          if (SOFT_DELETE_MODELS.has(model) && r.deletedAt) return null
          return result
        },
        async findUniqueOrThrow({ model, args, query }) {
          const result = await query(args)
          if (!isExtensionActive() || !TENANT_MODELS.has(model)) return result
          const r = result as { companyId?: string; deletedAt?: Date | null }
          const effective = getEffectiveCompanyId()
          if (r.companyId && r.companyId !== effective) {
            throw new Error(
              `[shunya] Record on "${model}" not found in current tenant.`
            )
          }
          if (SOFT_DELETE_MODELS.has(model) && r.deletedAt) {
            throw new Error(
              `[shunya] Record on "${model}" has been soft-deleted.`
            )
          }
          return result
        },

        // ===== 作成系：companyId を自動付与 =====
        async create({ model, args, query }) {
          if (isExtensionActive()) {
            args.data = injectCreateData(
              model,
              args.data as Record<string, unknown>
            ) as never
          }
          return query(args)
        },
        async createMany({ model, args, query }) {
          if (isExtensionActive() && TENANT_MODELS.has(model)) {
            const cid = getEffectiveCompanyId()
            if (Array.isArray(args.data)) {
              args.data = (args.data as Record<string, unknown>[]).map((row) => ({
                companyId: cid,
                ...row,
              })) as never
            } else if (
              args.data &&
              (args.data as Record<string, unknown>).companyId === undefined
            ) {
              args.data = {
                companyId: cid,
                ...(args.data as Record<string, unknown>),
              } as never
            }
          }
          return query(args)
        },

        // ===== 更新系：where に companyId / deletedAt を注入 =====
        async update({ model, args, query }) {
          if (isExtensionActive()) {
            args.where = injectListWhere(
              model,
              args.where as Record<string, unknown> | undefined
            ) as never
          }
          return query(args)
        },
        async updateMany({ model, args, query }) {
          if (isExtensionActive()) {
            args.where = injectListWhere(
              model,
              args.where as Record<string, unknown> | undefined
            ) as never
          }
          return query(args)
        },
        async upsert({ model, args, query }) {
          if (isExtensionActive()) {
            args.where = injectListWhere(
              model,
              args.where as Record<string, unknown> | undefined
            ) as never
            if (TENANT_MODELS.has(model)) {
              args.create = injectCreateData(
                model,
                args.create as Record<string, unknown>
              ) as never
            }
          }
          return query(args)
        },

        // ===== 削除系：論理削除を強制（鉄則 #3） =====
        async delete({ model, args, query }) {
          if (isExtensionActive() && SOFT_DELETE_MODELS.has(model)) {
            throw new Error(
              `[shunya] Hard delete is forbidden on "${model}". ` +
                `Use update({ where, data: { deletedAt: new Date() } }) instead.`
            )
          }
          if (isExtensionActive()) {
            args.where = injectListWhere(
              model,
              args.where as Record<string, unknown> | undefined
            ) as never
          }
          return query(args)
        },
        async deleteMany({ model, args, query }) {
          if (isExtensionActive() && SOFT_DELETE_MODELS.has(model)) {
            throw new Error(
              `[shunya] Hard delete is forbidden on "${model}". ` +
                `Use updateMany({ where, data: { deletedAt: new Date() } }) instead.`
            )
          }
          if (isExtensionActive()) {
            args.where = injectListWhere(
              model,
              args.where as Record<string, unknown> | undefined
            ) as never
          }
          return query(args)
        },
      },
    },
  })
}

type ExtendedPrismaClient = ReturnType<typeof buildClient>

const globalForPrisma = globalThis as unknown as {
  prisma?: ExtendedPrismaClient
}

export const prisma: ExtendedPrismaClient =
  globalForPrisma.prisma ?? buildClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
