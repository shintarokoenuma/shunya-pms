# カテゴリコード体系 確認書 v1.0（宿題③）

- 日付：2026-06-22（セッション11）
- 対象：shunya-pms（shintarokoenuma/shunya-pms）。saagara-v2 ではない。
- 起票元：2026-06-21 セッション10 起票「品番カテゴリコード長の dev/本番ズレ疑い」
- 性質：宿題③本体。spec 更新（docs）＋ dev カテゴリ整備。**本番データは変更しない**。
- 関連 spec：`02_仕様書_Part2_ID体系とデータ構造`（社内品番 §社内品番 / SKU）

---

## 0. このセッションで確定したこと（結論サマリ）

1. **品番5段運用を正式採用（決定 (a)）**。カテゴリ部が階層コード（例 `M-TS`）の場合、品番は5段に見える（`IP-26AW-M-TS-001`）。これを正とする。
2. **カテゴリ体系の標準＝本番の階層方式**（level1 性別区分 `K/L/M/U`＋level2 アイテム部位略号 `-TS` 等）。dev の `CUT_SEWN`/`WOVEN`（製法フラットトークン）が異端であり、**直すのは dev 側**。本番は触らない。
3. spec のフォーマット記述・例示を 4段固定から「カテゴリ部は階層コード可（段数可変）」へ更新する。

---

## 1. 調査で判明した事実（現物突き合わせ・2026-06-22）

### 1.1 採番ロジック（実コード）
- `src/lib/actions/products.ts:158 productCodePrefix()`
  - 式：`` `${brandCode.toUpperCase()}-${season.toUpperCase()}-${categoryCode.toUpperCase()}-` `` ＋ 連番3桁
  - 実 productCode ＝ `{brandCode}-{season}-{categoryCode}-{連番3桁}`
  - **カテゴリ部に渡す値 ＝ `ProductCategory.categoryCode` そのもの**（略号専用列は schema にも実コードにも無い）
- `products.ts:679` 付近に「categoryId 変更時：採番済み productCode は変えない」旨のコメント。
  → **採番済み品番の文字列は、後からカテゴリを変えても不変**。これが 5節の遡及論点に直結。

### 1.2 schema（`prisma/schema.prisma` ProductCategory）
- `categoryCode String @db.VarChar(50)`（Phase 1A-14 で階層コード `LADIES-TOPS-TSHIRT` 対応のため 50字に拡張済み）
- 略号専用列なし。`defaultSizeOptions Json?`（jsonb）。`@@unique([companyId, categoryCode])`。

### 1.3 dev product_categories（hopper:12921）※異端
| category_code | len | level | size_opt_count |
|---|---|---|---|
| CUT_SEWN | 8 | 1 | 12 |
| WOVEN | 5 | 1 | null |

- 2件のみ・フラット・**製法区分**（カットソー/織物）。spec のカテゴリ軸（アイテム種別）とは軸が違う。

### 1.4 本番 product_categories（shuttle:16099）※正とする
- 27件。level1＝1字 `K/L/M/U`（推定：キッズ/レディース/メンズ/ユニセックス）。level2＝4字 `X-YY`（例 `M-TS`, `L-BT`, `U-AC`）で**内部ハイフンを含む**。
- spec の「アイテム種別略号」と同じ軸。`M-TS`＝メンズ・Tシャツと読める。
- **27件すべて `defaultSizeOptions` が null**（→ 別タスク。3節）。

### 1.5 productCode サンプル
- dev：`NMB-26SS-WOVEN-001` / `AOI-26AW-CUT_SEWN-002` / `AOI-26AW-CUT_SEWN-001`（4段＝カテゴリ部が1トークン）
- 本番：`IP-26AW-M-TS-001` / `IP-26AW-M-BT-001`（**5段**＝カテゴリ部 `M-TS` が2トークンに割れる）

### 1.6 当初の宿題認識の訂正
- メモは「カテゴリコードの**長さ**が dev/本番でズレ・本番だけ短い疑い」だった。
- 実態は「**体系そのもの**が別物」かつ「本番のほうが spec に忠実・dev が異端」。記憶（本番が異端）とは逆。長短の問題ではなく軸の問題。

---

## 2. 確定設計（spec 更新内容）

### 2.1 社内品番フォーマット
- 現行 spec：`{ブランド略号}-{年シーズン}-{カテゴリ}-{連番3桁}`、例 `MK-26SS-TS-001`、カテゴリ略号 TS/JK/PT/OP 等（2文字・1トークン前提）。
- **更新後**：
  - フォーマットの骨格は不変＝`{brandCode}-{season}-{categoryCode}-{連番3桁}`。
  - ただし **`categoryCode` は階層コードを取りうる**（level2 では `M-TS` のように内部ハイフンを含む）。
  - 結果、品番は **段数可変**（カテゴリ部が1トークンなら4段、2トークンなら5段）。**5段を正式に許容**。
  - 連番3桁は `{brandCode}-{season}-{categoryCode}` 前方一致でカウント（現行 `productCodePrefix` の挙動そのまま。変更不要）。

### 2.2 SKU フォーマット（レイヤー4）の追従
- spec 例示 `MK-26SS-TS-001-BLK-M` も、実装は `{productCode}-{colorwayCode}-{size}`（PR #90/#91 で確定）。
- productCode が5段なら SKU はさらに色サイズが付いて長くなる（例 `IP-26AW-M-TS-001-{colorwayCode}-{size}`）。これも許容。spec の SKU 例示を「productCode を継承するため段数可変」と注記。

### 2.3 採番ロジックへの影響
- **コード変更なし**。`productCodePrefix` は categoryCode をそのまま乗せるので、本番の階層コード運用に既に適合している。今回は **docs（spec）更新のみ**。

---

## 3. 副次タスク（宿題③とは別・本確認書の対象外だが記録）

- **本番 product_categories 27件すべて `defaultSizeOptions` = null**。
- PR #91 でサイズの権威を `defaultSizeOptions` に一本化したため、**本番では SKU 生成ダイアログのサイズ候補が空＝生成導線が実質機能しない**。
- これは検証用ダミーではなく**実運用マスターの初期設定**＝「テストデータを本番に入れない」原則には抵触しない。ただし本番書き込みなので慎太郎さんの明示操作・承認下で実施。
- **順序**：宿題③（カテゴリ体系確定）を先に。値（各カテゴリのサイズ展開）の決定は慎太郎さん。投入手段の推奨は本番UI手入力（PR #91 のサイズ展開カードの本番初使用を兼ねる）。27件が手間なら Claude Code 一括 UPDATE（dry-run ROLLBACK→COMMIT）に切替。
- **別タスクとして次セッション以降に起票**。

---

## 4. dev カテゴリ整備（実作業・本確認書の実装対象）

### 4.1 方針
- dev の `CUT_SEWN`/`WOVEN`（2件）を、**本番と同じ階層方式のカテゴリに置き換える**。
- dev は db push 環境・本番データではない。テスト用なので影響は軽い。

### 4.2 論点：dev カテゴリを「本番27件のコピー」にするか「最小限」にするか
- **推奨：本番27件を dev にも複製**（companyId は dev のものに合わせる）。
  - 利点：dev/本番のカテゴリ体系が一致し、今後の検証が本番同等の前提で行える。`M-TS` 等の階層コードで品番・SKU 生成を dev で素振りできる。
  - 代替（最小限）：`M-TS` 等 数件だけ作る。早いが dev と本番の前提がまた乖離する。今回ズレで苦労した経緯から非推奨。

### 4.3 既存 dev テストデータの波及（5節と連動）
- 既存テスト品番 `AOI-26AW-CUT_SEWN-001` 等は、採番ロジック上 **categoryId を別カテゴリに付け替えても productCode 文字列は変わらない**（採番済みは不変）。
- よって体系を綺麗にするには **テスト品番・テスト SKU を作り直す**のが素直。
  - 対象：`AOI-26AW-CUT_SEWN-001/002`、`NMB-26SS-WOVEN-001`、およびそれらに紐づく ProductColorway / Sku（PR #91 目視で生成した dev SKU 群）。
  - dev なので物理削除→新カテゴリで品番再作成で良い。FK cascade（Sku.colorwayId Cascade 等）の効き方は実行前に確認。

---

## 5. 慎太郎さんに確認したい未決事項

1. **dev カテゴリ整備の範囲**：4.2 の推奨どおり「**本番27件を dev に複製**」で進めてよいか。それとも数件の最小限で良いか。
2. **既存 dev テストデータ**：4.3 のとおり旧テスト品番・SKU（CUT_SEWN/WOVEN 系）を**物理削除して作り直す**方針でよいか。残す理由があれば残す。
3. **spec ファイルの更新方法**：`02_仕様書_Part2…` は project knowledge 由来。実体は `docs/specs/` 配下に置くのか、既存仕様書本体を直接書き換えるのか（docs整理 B-037 とも絡む）。更新は docs のみなので main 直 push 可。

---

## 6. 実装の段取り（確定後）

A. **spec 更新（docs のみ・main 直 push）**
   - 社内品番フォーマットを「categoryCode は階層コード可・段数可変・5段許容」に更新。SKU 例示に段数可変の注記。本確認書を `docs/specs/` に保存。

B. **dev カテゴリ整備（dev DB のみ・本番非対象）**
   - 5節1の回答に従いカテゴリ投入（本番27件複製 or 最小限）。db push 環境なので migration 不要。
   - 5節2の回答に従い旧テストデータ整理（物理削除→再作成）。FK cascade 事前確認。

C. （別タスク・後日）本番 `defaultSizeOptions` 投入（3節）。

---

## 補足：環境・安全
- 本確認書の実装は **dev DB（hopper:12921）と docs のみ**。本番 DB 書き込みゼロ。
- 調査フェーズで本番へは SELECT のみ実行済み（書き込みなし）。
- 採番ロジックはコード変更なし＝ビルド影響なし。
