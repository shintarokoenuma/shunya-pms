# B-094 縫製指示 仕様確認書 v1.0 (2026-08-01)

- 種別: 仕様確認書 v1.0（**ドラフト／慎太郎さん確認待ち**）。確認完了後に実装ブリーフへ。
- 対象: 品番カルテに「縫製指示」セクションを新設。固定フィールド（プルダウン既定候補＋自由入力上書き可）
  と縫製指示5項目を Product の Json 列1本に保持する。
- 上位/関連: 品番カルテ UI（PR #115 で再構成済み）／B-054（仕様書1枚 PDF・様式原本）／
  休眠 Specification モデル（saagara V2 継承・現行 src 未参照）。
- 前提 recon: 2026-08-01（main HEAD `2de0d1d`・migration 43本・Product/Json 慣習・中立型作法・カルテ実装場所を確認済み）。

---

## 0. 背景と方針

- 現場の縫製仕様書（Excel・ウエスタンSH 26A-SH01 等）の要素のうち、**品番単位で確定する縫製指示**を
  システムに構造化保持する。箇所別の細かな始末表は本 PR では作らない（下記 §2 確定）。
- 既存の `Specification` モデル（schema §2335・`sewingMethod`/`stitchSpec`/`seamAllowance`/
  `inspectionPoints` 等の縫製・検品フィールドを保有）は **saagara V2 継承の休眠モデル**で、
  `src/` からの参照が無い（recon B: `stitchSpec`/`inspectionPoints`/`gradingRules` の src 参照ゼロ）。
  → B-094 は休眠モデルを起こさず、**Product に Json 列を1本追加**して軽量に実装する（handover ⑤-1 の確定方針）。

## 1. データモデル（要確認: 列名・Json 形）

### 1-1. Product へ Json 列を1本追加（migration あり）

```prisma
// B-094: 縫製指示（品番単位・固定フィールド＋縫製指示5項目）。既存行は null（挙動不変）。
sewingInstruction Json? @map("sewing_instruction")
```

- 命名慣習の根拠（recon STEP3）: 本 schema の Json 列は `camelCase Json? @map("snake_case")`・`@db` 指定なし
  が標準（例: `sketchImages Json? @map("sketch_images")` / `defaultSizeOptions Json? @map("default_size_options")`）。
- 既存行があるため **nullable で追加**（backfill 不要・既存挙動不変）。

### 1-2. Json の形（提案・要確認）

固定フィールド（各: プルダウン既定候補から選択、または自由入力で上書き可 → 保存は確定文字列1本）と
縫製指示5項目を1オブジェクトに格納する案:

```jsonc
{
  // 固定フィールド（5）: 値は「選択した候補 or 自由入力」の確定文字列。未設定は null。
  "namePosition": "後ろ中心・内側",        // ネーム位置
  "washLabelPosition": "左脇縫い代",       // 洗濯ネーム位置
  "finishingMethod": "プレス仕上げ",       // 仕上げ方法
  "postProcessing": "なし",                // 製品後加工
  "hangTag": "紙下げ札＋品質表示",         // 下げ札

  // 縫製指示（5項目のみ）
  "thread": { "baseColor": "地色", "other": "" },   // 糸: 地色 / その他（自由）
  "stitch": { "gauge": "" },                         // ステッチ: 番手
  "patternMatching": "無",                           // 柄合わせ: 有 / 無
  "insertion": "不可",                               // 差し込み: 不可 / 組合せ / 一方向
  "fabricDirection": "並"                            // 生地方向: 並 / 逆
}
```

- **中立型の置き場所**（recon STEP4・PR #85 の轍）: client が "use server" actions から型 import すると
  @prisma/client がブラウザに漏れるため、型は `src/lib/types/sewing-instruction.ts`（prisma 非依存）に置く。
  `product-sketch.ts` と同じ decouple 作法。
- 空欄は `""` または キー欠落 or `null` のいずれで持つか（正規化方針）を実装ブリーフで一本化する。

## 2. 画面（品番カルテ・セクション新設）

- 新セクション「縫製指示」を追加。**配置は「マーキング実測」と「概算量産見積」の間**（handover 確定・既定案）。
  - recon STEP5 の現行順: BOM → マーキング実測 → 資材所要量 → 概算量産見積。
    「マーキングと概算の間」には現在 `資材所要量`（MaterialRequirementSection）が入るため、
    **資材所要量の直前 or 直後のどちらに置くか**を1点だけ確認（提案: 資材所要量の**後**＝概算の直前）。
- 実装場所: セクション本体は `src/app/(app)/products/_components/sewing-instruction-section.tsx`（新規）、
  `src/app/(app)/products/[id]/page.tsx` に `<Card>` で差し込み（既存セクションと同型）。
  ※ `src/components/products/` は存在しない。カルテ用は `src/app/(app)/products/_components/` に集約（recon STEP5 補足）。
- 編集 UI: 各固定フィールドは「プルダウン（既定候補）＋自由入力上書き」。縫製指示5項目は
  糸=地色/その他・ステッチ番手・柄合わせ(有/無)・差し込み(不可/組合せ/一方向)・生地方向(並/逆)。
- 保存は Product 更新 action 経由（既存の品番編集導線に合わせるか、当該セクション単独保存にするかは実装ブリーフで確定）。

## 3. プルダウン既定候補（提案・要確認）

固定フィールドの既定候補（自由入力で上書き可）。**値は暫定案・慎太郎さん確認で確定**する:

- ネーム位置: 後ろ中心・内側 / 後ろ衿ぐり下 / 左脇縫い代 / その他
- 洗濯ネーム位置: 左脇縫い代 / 後ろ中心・内側 / 裾脇 / その他
- 仕上げ方法: プレス仕上げ / たたみ / ハンガー / その他
- 製品後加工: なし / 洗い / ワッシャー / 製品染め / その他
- 下げ札: 紙下げ札 / 品質表示 / 紙下げ札＋品質表示 / なし / その他

縫製指示5項目の選択肢は §1-2 のとおり（糸: 地色/その他自由・ステッチ: 番手自由入力・
柄合わせ: 有/無・差し込み: 不可/組合せ/一方向・生地方向: 並/逆）。

## 4. スコープ外（確定）

- **箇所別始末表は作らない**（慎太郎さん確定 2026-08-01）。
- 休眠 `Specification` モデルの起動・移行は本 PR の対象外。
- 多言語（工場向け翻訳）・仕様書ロック連動は本 PR では扱わない。
- 縫製指示の PDF 出力は B-054（仕様書1枚 PDF）側で扱う。

## 5. migration（triple-gate 対象）

1. Product に `sewingInstruction Json?`（`@map("sewing_instruction")`）を1列追加（追加のみ・DROP なし・既定 null）。
- 手書き SQL ＋ `migrate diff`（empty-diff 検証）方式。命名 `{YYYYMMDD}000000_add_product_sewing_instruction`
  （直近: `20260726000000_procurement_route_colorway`・migration ディレクトリ計 43）。
- 手順: dev db push で確認 → **本番 dry-run（BEGIN/ROLLBACK・psql）で停止点** → 承認後 migrate deploy。
  DB 接続先は dev=hopper.proxy.rlwy.net:12921（本番=shuttle は Claude Code 接続禁止）。

## 6. 確認事項（このドラフトで確定したい点）

| # | 論点 | 提案 | 状態 |
|---|---|---|---|
| Q1 | 列名 | `sewingInstruction` / `@map("sewing_instruction")` | 要確認 |
| Q2 | Json キー名・入れ子（§1-2） | thread{baseColor,other}・stitch{gauge}・他はフラット文字列 | 要確認 |
| Q3 | 空値の持ち方 | 未設定は null（キー欠落許容） | 要確認 |
| Q4 | セクション配置 | 資材所要量の後・概算量産見積の直前 | 要確認 |
| Q5 | プルダウン既定候補値（§3） | 暫定案のとおり | 要確認 |
| Q6 | 保存導線 | 当該セクション単独保存 or 品番編集フォーム同梱 | 要確認 |

## 7. 確定一覧（handover 由来・既確定）

| # | 論点 | 確定内容 |
|---|---|---|
| R-1 | 保持先 | Product に Json 列1本（休眠 Specification は使わない） |
| R-2 | 固定フィールド | ネーム位置／洗濯ネーム位置／仕上げ方法／製品後加工／下げ札（プルダウン既定＋自由入力上書き） |
| R-3 | 縫製指示 | 糸（地色・その他）／ステッチ（番手）／柄合わせ（有・無）／差し込み（不可・組合せ・一方向）／生地方向（並・逆）の5項目のみ |
| R-4 | 始末表 | 箇所別始末表は作らない |
| R-5 | 配置 | 「マーキング」と「概算量産見積」の間 |
| R-6 | 進め方 | 軽い仕様確認（列名・Json 形・候補値）→ migration dry-run 停止点 → triple-gate |

## 改訂履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-08-01 | v1.0 | 初版ドラフト。recon（main `2de0d1d`）＋handover 確定事項から起草。R-1〜R-6 反映・Q1〜Q6 を確認事項として提示 |
