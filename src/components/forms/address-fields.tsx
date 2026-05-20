"use client"

import { useFormContext } from "react-hook-form"
import { PREFECTURE_OPTIONS } from "@/lib/constants/prefectures"
import { Input } from "@/components/ui/input"
import {
  FormControl,
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

/** 住所フィールドのプレフィックス（マスター / 請求先 / 配送先） */
export type AddressPrefix = "" | "billing" | "shipping"

type AddressFieldsProps = {
  prefix?: AddressPrefix
  /** 親コンポーネントで watch("country") した値（ISO 3166-1 alpha-2） */
  country: string
}

/** prefix + フィールド名 → React Hook Form の name */
function fieldName(prefix: AddressPrefix, base: string): string {
  if (!prefix) return base
  return `${prefix}${base.charAt(0).toUpperCase()}${base.slice(1)}`
}

const LABELS_JP = {
  postalCode: "郵便番号",
  prefecture: "都道府県",
  city: "市区町村",
  address: "住所",
  addressLine2: "建物名・部屋番号",
} as const

const LABELS_EN = {
  postalCode: "Postal code",
  prefecture: "State / Province",
  city: "City",
  address: "Street address",
  addressLine2: "Address line 2",
} as const

export function AddressFields({ prefix = "", country }: AddressFieldsProps) {
  const { control } = useFormContext()
  const isJP = country === "JP"
  const labels = isJP ? LABELS_JP : LABELS_EN

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <FormField
          control={control}
          name={fieldName(prefix, "postalCode")}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.postalCode}</FormLabel>
              <FormControl>
                <Input placeholder={isJP ? "100-0001" : "10001"} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={fieldName(prefix, "prefecture")}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.prefecture}</FormLabel>
              {isJP ? (
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PREFECTURE_OPTIONS.map((p) => (
                      <SelectItem key={p.code} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <FormControl>
                  <Input placeholder="California" {...field} />
                </FormControl>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={fieldName(prefix, "city")}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{labels.city}</FormLabel>
              <FormControl>
                <Input placeholder={isJP ? "千代田区" : "New York"} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name={fieldName(prefix, "address")}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{labels.address}</FormLabel>
            <FormControl>
              <Input
                placeholder={isJP ? "丸の内 1-1-1" : "123 Main St"}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={fieldName(prefix, "addressLine2")}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{labels.addressLine2}</FormLabel>
            <FormControl>
              <Input
                placeholder={isJP ? "サンプルビル 5F" : "Suite 100"}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
