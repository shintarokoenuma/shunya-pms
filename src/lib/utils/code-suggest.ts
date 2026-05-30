/**
 * Phase 1A-17: コードサジェスト共通 utility (B-007 回収)
 *
 * 入力された日本語名と (あれば) 親コードから、コード候補を最大 maxResults 件まで返す汎用関数。
 *
 * 採用ロジック:
 * (i)  ドメイン辞書ベースで日本語 → 英字候補を返す
 * (ii) 親コードが指定されていれば、親 + "-" + 候補 を組み合わせる
 *
 * 辞書にない場合は空配列を返す (ユーザーが手入力)。
 *
 * 旧 `category-code-suggest.ts` / `material-category-code-suggest.ts` の関数本体を
 * 辞書引数化して 1 つに畳んだもの。ドメイン別辞書は `src/lib/constants/code-dicts/`
 * 配下に分離 (apparel / material / cost)。
 */

export type DictEntry = readonly string[]

export type CodeSuggestion = {
  /** 表示用の候補コード (大文字英数 + ハイフン + アンダースコア) */
  value: string
  /** 由来 (辞書 / 親 + 辞書) */
  source: "dict" | "parent-dict"
}

/**
 * 入力 name と (あれば) parent code から候補を生成。
 *
 * - `name` は trim 済みで辞書 key と完全一致した場合のみヒット
 * - `parentCode` が指定されていれば parent-dict (親 + 辞書) を優先
 * - 重複は除外、最大 maxResults 件 (既定 3)
 * - `toUpperCase()` で正規化済み
 */
export function suggestCodeFromName(
  name: string,
  parentCode: string | null | undefined,
  dict: Record<string, DictEntry>,
  maxResults = 3,
): CodeSuggestion[] {
  const trimmed = name.trim()
  if (trimmed.length === 0) return []

  const parent = parentCode?.trim() ?? ""
  const dictHits = dict[trimmed] ?? []

  const results: CodeSuggestion[] = []
  const seen = new Set<string>()

  // (ii) 親 + 辞書
  if (parent !== "") {
    for (const term of dictHits) {
      const code = `${parent}-${term}`.toUpperCase()
      if (!seen.has(code)) {
        seen.add(code)
        results.push({ value: code, source: "parent-dict" })
      }
    }
  }

  // (i) 辞書のみ
  for (const term of dictHits) {
    const code = term.toUpperCase()
    if (!seen.has(code)) {
      seen.add(code)
      results.push({ value: code, source: "dict" })
    }
  }

  return results.slice(0, maxResults)
}
