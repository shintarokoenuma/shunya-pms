"use client"

import { useState } from "react"
import { useFormContext } from "react-hook-form"
import {
  TIMEZONE_OPTIONS,
  TIMEZONE_OTHER_VALUE,
  isKnownTimezone,
} from "@/lib/constants/timezones"
import { Input } from "@/components/ui/input"
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

type TimezoneFieldProps = {
  /** React Hook Form のフィールド名（デフォルト: timezone） */
  name?: string
}

export function TimezoneField({ name = "timezone" }: TimezoneFieldProps) {
  const { control, watch } = useFormContext()
  const current = (watch(name) as string) ?? ""

  const [isOther, setIsOther] = useState(
    () => current !== "" && !isKnownTimezone(current)
  )

  const selectValue = isOther
    ? TIMEZONE_OTHER_VALUE
    : isKnownTimezone(current)
      ? current
      : ""

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>タイムゾーン</FormLabel>
          <Select
            value={selectValue}
            onValueChange={(v) => {
              if (v === TIMEZONE_OTHER_VALUE) {
                setIsOther(true)
                if (isKnownTimezone(field.value)) {
                  field.onChange("")
                }
              } else {
                setIsOther(false)
                field.onChange(v)
              }
            }}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="タイムゾーンを選択" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
              <SelectItem value={TIMEZONE_OTHER_VALUE}>
                Other（その他・手入力）
              </SelectItem>
            </SelectContent>
          </Select>
          {isOther && (
            <FormControl>
              <Input
                placeholder="Asia/Tokyo"
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
              />
            </FormControl>
          )}
          <FormDescription>IANA形式 例: Asia/Shanghai</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
