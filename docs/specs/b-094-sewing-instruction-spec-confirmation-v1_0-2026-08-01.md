# 仕様確認議事録 — B-094 縫製指示（v1.0 確定版）

- 作成日: 2026-08-01 / Claude.ai
- 作成者: 慎太郎さん + Claude
- バージョン: **v1.0（確定・実装着手可能）**
- 起点 commit: 2de0d1d（live 確認済み 2026-08-01）
- migration: **あり**（ADD COLUMN 1本・非破壊・44本目）
- 一次資料: 現場 Excel 縫製仕様書2本（M-65 パッチJKT＝アウター様式 /
  26A-SH01 ウエスタンSH＝TOPS 様式）、20260713_輸出入書類と縫製仕様書_構造メモ.md §3

---

## 1. 目的

現場 Excel 縫製仕様書のヘッダ部（縫製注意点・縫製指示ブロック）を構造化し、
品番カルテ1枚に載せる。北極星「品番カルテで完結」の一部。

---

## 2. スコープ（✓ 慎太郎さん確定 2026-08-01）

### 2-1. 固定フィールド（5項目）

既定候補をプルダウン提示しつつ、**自由入力での上書きを常に許可**。

| # | 項目 | 既定候補（v1） |
|---|---|---|
| 1 | ネーム位置 | CB衿ぐり付け～3.0cm下 / CB流し込み |
| 2 | 洗濯ネーム位置 | （なし・自由入力主体） |
| 3 | 仕上げ方法 | （なし・自由入力主体） |
| 4 | 製品後加工 | （なし・自由入力主体） |
| 5 | 下げ札 | （なし・自由入力主体） |

候補なしの4項目は現物でも空欄。自由入力で開始し運用で候補を育てる。

### 2-2. 縫製指示（6項目）

| # | 項目 | 既定候補（v1） | 備考 |
|---|---|---|---|
| 1 | 裏 | 総裏 / 身頃のみ / 背裏 / 袖裏 / 裏無し | 現物印字どおり |
| 2 | 糸 | 地色 / その他 | 現物印字どおり |
| 3 | ステッチ | （なし・番手を自由入力） | 現物は「番手」ラベルのみ |
| 4 | 柄合わせ | 有 / 無 | 現物印字どおり |
| 5 | 差し込み | 不可 / 組合せ / 一方向 | **3値**。現物の「可」「着内一方」は不採用 |
| 6 | 生地方向 | 並 / 逆 | 現物印字どおり |

### 2-3. スコープ外（v1 で追加しない・✓ 確定）

肩パット / 釦穴種別 / 芯使用箇所 / 箇所別始末表（肩・前脇・後脇・後中心・
前中心・袖ぐり・袖下・衿ぐり・袖口始末・裾始末）。
現物は「印字候補の一次情報」としてのみ使い、v1 のスコープは慎太郎さんの確定リストが正。
Json 列のため後から非破壊で追加可能。

> 「裏」行は TOPS 様式にはあり、アウター様式には行が無い。アイテム種別で様式が
> 異なるが、v1 は全アイテム共通の1フォームとする。様式のアイテム別出し分けは
> 将来課題（B-054 段1 の PDF 設計時に再検討）。

---

## 3. データモデル（✓ 確定・live recon 済み 2026-08-01）

### 3-1. 置き場所の判断

`Specification` モデル（schema 2335行〜）が既に「セクション6：縫製仕様」として
`sewingMethod` / `stitchSpec` / `seamAllowance` を持つ。しかし
**src 配下からの参照はゼロ＝完全休眠**（2026-08-01 grep 確認）。
Specification は仕様書バージョン管理（三位一体・ロック・多言語・承認フロー）を
前提とした重量級モデルであり、品番カルテ1枚に載せる軽量な縫製指示とはレイヤーが違う。

→ **Product に新設する**。B-027 が `DesignVersion.flatSketch` という既存の受け皿を
持ちながら「別レイヤー」と判断して `Product.sketchImages` を新設した前例に揃える。
Specification を起こす際は、そちらから Product 側の値を参照/コピーする方向で設計する
（本書スコープ外）。

### 3-2. 追加する列

```prisma
model Product {
  // ... 既存フィールド ...

  // B-094: 縫製指示（固定5項目＋縫製指示6項目）。
  // 候補値は enum 化せず文字列で保持（自由入力上書きを許可し、候補は運用で育てるため）。
  // 形は src/lib/types/sewing-instruction.ts の SewingInstruction 型 + Zod で保証。
  // Specification.stitchSpec 等（休眠）とは別レイヤー（本仕様 §3-1）。
  sewingInstructions Json? @map("sewing_instructions")
}
```

- `@db` 指定なし（schema 全体の Json 列と一貫。Prisma が既定で jsonb にマップ）。
- 配置は `sketchThumbPath` の直後（B-027 ブロックの下）。

### 3-3. Json の形

```jsonc
{
  "version": 1,
  "fixed": {
    "namePosition":      null,  // ネーム位置
    "careLabelPosition": null,  // 洗濯ネーム位置
    "finishingMethod":   null,  // 仕上げ方法
    "postProcessing":    null,  // 製品後加工
    "hangTag":           null   // 下げ札
  },
  "sewing": {
    "lining":          null,  // 裏
    "thread":          null,  // 糸
    "stitch":          null,  // ステッチ（番手）
    "patternMatching": null,  // 柄合わせ
    "insertion":       null,  // 差し込み
    "fabricDirection": null   // 生地方向
  }
}
```

- 全 value は `string | null`。未入力＝`null`。列自体が `null` ＝未設定（未入力と同義に扱う）。
- **候補値も自由入力値も同じ string に入る**（候補は UI のサジェストにすぎない）。
- `version` は将来の項目追加（肩パット・釦穴・箇所別始末表）に備えた版番号。
  v1 の読み取りは `version` 欠落/1 をすべて v1 相当として扱う（防御的読み取り）。

### 3-4. 型と candidate 定数

`src/lib/types/sewing-instruction.ts`（**prisma 非依存の中立モジュール**。
`product-sketch.ts` と同じ理由＝client から "use server" actions の型を import すると
ブラウザバンドルに @prisma/client が漏れる／PR #85 の轍）。

```ts
export type SewingInstruction = {
  version: 1
  fixed: {
    namePosition: string | null
    careLabelPosition: string | null
    finishingMethod: string | null
    postProcessing: string | null
    hangTag: string | null
  }
  sewing: {
    lining: string | null
    thread: string | null
    stitch: string | null
    patternMatching: string | null
    insertion: string | null
    fabricDirection: string | null
  }
}

/** 項目ラベル（画面・将来の PDF で共用） */
export const SEWING_INSTRUCTION_LABELS = {
  namePosition: "ネーム位置",
  careLabelPosition: "洗濯ネーム位置",
  finishingMethod: "仕上げ方法",
  postProcessing: "製品後加工",
  hangTag: "下げ札",
  lining: "裏",
  thread: "糸",
  stitch: "ステッチ（番手）",
  patternMatching: "柄合わせ",
  insertion: "差し込み",
  fabricDirection: "生地方向",
} as const

/** 既定候補。空配列＝候補なし（自由入力のみ）。運用で追記して育てる。 */
export const SEWING_INSTRUCTION_OPTIONS = {
  namePosition: ["CB衿ぐり付け～3.0cm下", "CB流し込み"],
  careLabelPosition: [],
  finishingMethod: [],
  postProcessing: [],
  hangTag: [],
  lining: ["総裏", "身頃のみ", "背裏", "袖裏", "裏無し"],
  thread: ["地色", "その他"],
  stitch: [],
  patternMatching: ["有", "無"],
  insertion: ["不可", "組合せ", "一方向"],
  fabricDirection: ["並", "逆"],
} as const
```

- **Prisma enum を作らない**。候補追加のたびに migration が必要になるのを避け、
  自由入力上書きを許可するため。
  → 「enum 追加時は同一 PR で Record<enum,string> ラベル定義必須」の既存ルールは
  本件に適用されない（enum を作らない）。ラベルは上記定数が兼ねる。
- 形の保証は Zod validator。未知キーは strip する。

---

## 4. UI（✓ 確定）

### 4-1. 配置

品番カルテのセクション順（PR #115 後の実装・live 確認 2026-08-01）:

```
… BOM → マーキング実測 → 資材所要量 → 【縫製指示】← ここ → 概算量産見積 → …
```

「マーキングと概算量産見積の間」という既定案を満たしつつ、
BOM→マーキング実測→資材所要量 の材料量の連鎖を割らない位置。

### 4-2. コンポーネント

`src/app/(app)/products/_components/sewing-instruction-section.tsx` を新設。
page.tsx 側で Card + CardHeader（CardTitle className="text-base" に「縫製指示」）
+ CardContent に包む（マーキング実測・概算量産見積と同じ形）。

### 4-3. 入力方式

- 候補ありの項目 = **コンボボックス**（候補選択＋自由入力可）
- 候補なしの項目 = テキスト入力
- 「ステッチ」は自由入力（番手）
- 未設定時は各項目「—」表示

### 4-4. 保存

`updateSewingInstructions(productId, payload)` の1アクション。
部分更新ではなく Json 全体を置き換える（Zod で形を保証してから write）。

---

## 5. migration（非破壊・triple-gate）

```sql
ALTER TABLE products ADD COLUMN sewing_instructions jsonb;
```

- 1本・非破壊・既存データ不変。既存行はすべて NULL で開始。
- 手書き SQL + prisma migrate diff（empty-diff 検証）方式。
- **triple-gate 必須**: dev 確認 → 本番 dry-run（psql BEGIN/ROLLBACK）→ 本番 migrate deploy。
- migration 本数: 43ディレクトリ（live 確認 2026-08-01）→ **44本目**。
- ディレクトリ名案: 20260801000000_sewing_instructions

---

## 6. 申し送り

- B-054 段1「品番サマリー1枚 PDF」に本項目を載せる前提で Json 形・ラベル定数を設計した。
- スコープ外項目の追加時は version を 2 に上げる。
- Specification モデルを将来起こす際は、Product 側の値を参照/コピーする方向で設計する
  （二重管理にしない）。

---

## 7. 確定状況

| # | 論点 | 状態 |
|---|---|---|
| G1 | 固定フィールド5項目 | ✓ 確定 |
| G2 | 縫製指示6項目（裏を含む） | ✓ 確定 |
| G3 | スコープ外（肩パット・釦穴・箇所別始末表） | ✓ 確定 |
| G4 | 差し込みは3値 | ✓ 確定 |
| G5 | 列名 sewingInstructions / sewing_instructions | ✓ 確定（live 衝突なし確認済み） |
| G6 | Json の形（version + fixed + sewing） | ✓ 確定 |
| G7 | 候補値を enum 化しない | ✓ 確定 |
| G8 | Specification に相乗りせず Product 新設 | ✓ 確定（休眠を live 確認） |
| G9 | 配置＝資材所要量と概算量産見積の間 | ✓ 確定 |

---

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-08-01 | v1.0 | 初版・確定。live recon（Product 全文・Json 命名慣習・Specification 休眠・カルテ構成・migration 本数）で裏取り済み |
