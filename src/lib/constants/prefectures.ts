/**
 * 都道府県定数（日本47都道府県）
 * 北から南、JIS X 0401 のコード順
 * DB には日本語の都道府県名（例：「東京都」）をそのまま保存
 */

export type PrefectureOption = {
  code: string
  value: string
  label: string
  romaji: string
}

export const PREFECTURE_OPTIONS: PrefectureOption[] = [
  { code: "01", value: "北海道",   label: "北海道",   romaji: "Hokkaido"  },
  { code: "02", value: "青森県",   label: "青森県",   romaji: "Aomori"    },
  { code: "03", value: "岩手県",   label: "岩手県",   romaji: "Iwate"     },
  { code: "04", value: "宮城県",   label: "宮城県",   romaji: "Miyagi"    },
  { code: "05", value: "秋田県",   label: "秋田県",   romaji: "Akita"     },
  { code: "06", value: "山形県",   label: "山形県",   romaji: "Yamagata"  },
  { code: "07", value: "福島県",   label: "福島県",   romaji: "Fukushima" },
  { code: "08", value: "茨城県",   label: "茨城県",   romaji: "Ibaraki"   },
  { code: "09", value: "栃木県",   label: "栃木県",   romaji: "Tochigi"   },
  { code: "10", value: "群馬県",   label: "群馬県",   romaji: "Gunma"     },
  { code: "11", value: "埼玉県",   label: "埼玉県",   romaji: "Saitama"   },
  { code: "12", value: "千葉県",   label: "千葉県",   romaji: "Chiba"     },
  { code: "13", value: "東京都",   label: "東京都",   romaji: "Tokyo"     },
  { code: "14", value: "神奈川県", label: "神奈川県", romaji: "Kanagawa"  },
  { code: "15", value: "新潟県",   label: "新潟県",   romaji: "Niigata"   },
  { code: "16", value: "富山県",   label: "富山県",   romaji: "Toyama"    },
  { code: "17", value: "石川県",   label: "石川県",   romaji: "Ishikawa"  },
  { code: "18", value: "福井県",   label: "福井県",   romaji: "Fukui"     },
  { code: "19", value: "山梨県",   label: "山梨県",   romaji: "Yamanashi" },
  { code: "20", value: "長野県",   label: "長野県",   romaji: "Nagano"    },
  { code: "21", value: "岐阜県",   label: "岐阜県",   romaji: "Gifu"      },
  { code: "22", value: "静岡県",   label: "静岡県",   romaji: "Shizuoka"  },
  { code: "23", value: "愛知県",   label: "愛知県",   romaji: "Aichi"     },
  { code: "24", value: "三重県",   label: "三重県",   romaji: "Mie"       },
  { code: "25", value: "滋賀県",   label: "滋賀県",   romaji: "Shiga"     },
  { code: "26", value: "京都府",   label: "京都府",   romaji: "Kyoto"     },
  { code: "27", value: "大阪府",   label: "大阪府",   romaji: "Osaka"     },
  { code: "28", value: "兵庫県",   label: "兵庫県",   romaji: "Hyogo"     },
  { code: "29", value: "奈良県",   label: "奈良県",   romaji: "Nara"      },
  { code: "30", value: "和歌山県", label: "和歌山県", romaji: "Wakayama"  },
  { code: "31", value: "鳥取県",   label: "鳥取県",   romaji: "Tottori"   },
  { code: "32", value: "島根県",   label: "島根県",   romaji: "Shimane"   },
  { code: "33", value: "岡山県",   label: "岡山県",   romaji: "Okayama"   },
  { code: "34", value: "広島県",   label: "広島県",   romaji: "Hiroshima" },
  { code: "35", value: "山口県",   label: "山口県",   romaji: "Yamaguchi" },
  { code: "36", value: "徳島県",   label: "徳島県",   romaji: "Tokushima" },
  { code: "37", value: "香川県",   label: "香川県",   romaji: "Kagawa"    },
  { code: "38", value: "愛媛県",   label: "愛媛県",   romaji: "Ehime"     },
  { code: "39", value: "高知県",   label: "高知県",   romaji: "Kochi"     },
  { code: "40", value: "福岡県",   label: "福岡県",   romaji: "Fukuoka"   },
  { code: "41", value: "佐賀県",   label: "佐賀県",   romaji: "Saga"      },
  { code: "42", value: "長崎県",   label: "長崎県",   romaji: "Nagasaki"  },
  { code: "43", value: "熊本県",   label: "熊本県",   romaji: "Kumamoto"  },
  { code: "44", value: "大分県",   label: "大分県",   romaji: "Oita"      },
  { code: "45", value: "宮崎県",   label: "宮崎県",   romaji: "Miyazaki"  },
  { code: "46", value: "鹿児島県", label: "鹿児島県", romaji: "Kagoshima" },
  { code: "47", value: "沖縄県",   label: "沖縄県",   romaji: "Okinawa"   },
]

/** 47都道府県の value の Set（バリデーション用） */
export const PREFECTURE_VALUES = new Set(
  PREFECTURE_OPTIONS.map((p) => p.value)
)

/**
 * 任意の文字列が47都道府県に含まれるか判定
 */
export function isValidPrefecture(value: string | null | undefined): boolean {
  if (!value) return false
  return PREFECTURE_VALUES.has(value)
}
