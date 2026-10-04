import { z } from "zod"
import { CONFIGURABLE_ROLES } from "@/lib/constants/user-roles"
import { AREA_KEYS, SETTINGS_SECTIONS } from "@/lib/settings-visibility"

/**
 * B-205 PR-2（P2-D7）: 「役割と権限」の保存の入力。
 * キーは SETTINGS_SECTIONS × CONFIGURABLE_ROLES、値は "view" | "hidden"。欠けたキーは "view" 扱い（D-16）。
 * B-243 PR-1（§2-11）: areas（AREA_KEYS × CONFIGURABLE_ROLES）を optional で足す。欠けたキーは既定値（AREA_DEFAULTS）で解く
 */
const visibility = z.enum(["view", "hidden"])

const byRole = z
  .object(Object.fromEntries(CONFIGURABLE_ROLES.map((r) => [r, visibility.optional()])) as Record<
    (typeof CONFIGURABLE_ROLES)[number],
    z.ZodOptional<typeof visibility>
  >)
  .strict()

export const updateRolePermissionsSchema = z.object({
  settings: z
    .object(Object.fromEntries(SETTINGS_SECTIONS.map((s) => [s, byRole.optional()])) as Record<
      (typeof SETTINGS_SECTIONS)[number],
      z.ZodOptional<typeof byRole>
    >)
    .strict(),
  areas: z
    .object(Object.fromEntries(AREA_KEYS.map((a) => [a, byRole.optional()])) as Record<
      (typeof AREA_KEYS)[number],
      z.ZodOptional<typeof byRole>
    >)
    .strict()
    .optional(),
})
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>
