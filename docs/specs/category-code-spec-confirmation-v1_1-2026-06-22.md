# 品番フォーマット（カテゴリコード＋シーズン）確認書 v1.1（宿題③）

- 日付：2026-06-22（セッション11）
- 対象：shunya-pms（shintarokoenuma/shunya-pms）。saagara-v2 ではない。
- 起票元：2026-06-21 セッション10 起票「品番カテゴリコード長の dev/本番ズレ疑い」＋セッション11 でシーズン軸を統合
- 性質：品番フォーマットの「思想」を1か所に統合。**実装は性質ごとに分離**（後述 §7）。
- 関連 spec：`02_仕様書_Part2_ID体系とデータ構造`（社内品番 / SKU）。本体は git 管理外（Notion/Claude.ai プロジェクト側）。
- 関連 backlog：B-026（Season dropdown 標準化＋年/シーズン重複解消）
- v1.0 からの差分：未決事項（§5）を確定済みに更新。シーズン軸（§A〜§C）を新設。タイトルを「カテゴリコード体系」→「品番フォーマット（カテゴリ＋シーズン）」に拡張。

---

## 0. このセッションで確定したこと（結論サマリ）

### カテゴリ軸（v1.0 から継続）
1. **品番5段運用を正式採用（決定 (a)）**。カテゴリ部が階層コード（例 `M-TS`）の場合、品番は5段に見える（`IP-26AW-M-TS-001`）。これを正とする。
2. **カテゴリ体系の標準＝本番の階層方式**（level1 性別区分 `K/L/M/U`＋level2 アイテム部位略号 `-TS` 等）。dev の `CUT_SEWN`/`WOVEN` が異端であり、**直すのは dev 側**。本番は触らない。
3. spec のフォーマット記述・例示を 4段固定から「カテゴリ部は階層コード可（段数可変）」へ更新。

### シーズン軸（v1.1 新設）
4. **入力を year（プルダウン）＋ seasonType（プルダウン7択）に分離（決定 (あ)）**。品番・DB保存用の `season` 文字列は `{year下2桁}{seasonType}` で**システム自動合成**。手打ち Input は廃止。
5. **seasonType は7値フラット併存（決定 (Q)）**：`SS`/`AW`/`SP`/`SU`/`FA`/`WI`/`SPOT`。同一ブランド・同一年での複数 seasonType 併存を許容（メイン SS/AW に加え、夏展示会・店舗夏企画・立ち上がりスポット等が実務で実在するため＝表記揺れではない）。
6. 既存 `season`/`year` の二重持ちは現に破綻している（§6.4 の dev=2024/本番=2026 食い違い）。合成方式で構造的に解消する。

---

## 1. 調査で判明した事実（現物突き合わせ・2026-06-22）

### 1.1 採番ロジック（実コード）
- `src/lib/actions/products.ts:158 productCodePrefix()`
  - 式：`` `${brandCode.toUpperCase()}-${season.toUpperCase()}-${categoryCode.toUpperCase()}-` `` ＋ 連番3桁
  - 実 productCode ＝ `{brandCode}-{season}-{categoryCode}-{連番3桁}`
  - **カテゴリ部に渡す値 ＝ `ProductCategory.categoryCode` そのもの**（略号専用列は無い）
  - **シーズン部に渡す値 ＝ `Product.season`（文字列）そのもの**。`year` は採番文字列に入らない。
- `products.ts:679` 付近に「categoryId 変更時：採番済み productCode は変えない」旨のコメント。
  → **採番済み品番の文字列は、後からカテゴリ/シーズンを変えても不変**。遡及論点に直結。

### 1.2 schema（`prisma/schema.prisma`）
- ProductCategory：`categoryCode String @db.VarChar(50)`。略号専用列なし。`defaultSizeOptions Json?`。`@@unique([companyId, categoryCode])`。
- Product：`season String @db.VarChar(20)`（コメント `26SS / 26FW`）／`year Int @db.SmallInt`（`2026`）。**season と year は別フィールド**。`@@index([companyId, season])` あり。

### 1.3 dev product_categories（hopper:12921）※異端
| category_code | len | level | size_opt_count |
|---|---|---|---|
| CUT_SEWN | 8 | 1 | 12 |
| WOVEN | 5 | 1 | null |

### 1.4 本番 product_categories（shuttle:16099）※正とする
- 27件。level1＝1字 `K/L/M/U`。level2＝4字 `X-YY`（例 `M-TS`, `L-BT`, `U-AC`）で内部ハイフン含む。
- **27件すべて `defaultSizeOptions` が null**（→ §3 別タスク）。

### 1.5 productCode サンプル
- dev：`NMB-26SS-WOVEN-001` / `AOI-26AW-CUT_SEWN-002` / `AOI-26AW-CUT_SEWN-001`（4段）
- 本番：`IP-26AW-M-TS-001` / `IP-26AW-M-BT-001`（5段＝カテゴリ部 `M-TS` が2トークン）

### 1.6 当初の宿題認識の訂正
- メモは「カテゴリコードの長さが dev/本番でズレ・本番だけ短い疑い」だったが、実態は「体系そのものが別物」かつ「本番のほうが spec に忠実・dev が異端」。記憶（本番が異端）とは逆。

---

## 2. 確定設計：カテゴリ軸（spec 更新内容）

### 2.1 社内品番フォーマット
- 骨格は不変＝`{brandCode}-{season}-{categoryCode}-{連番3桁}`。
- **`categoryCode` は階層コードを取りうる**（level2 では `M-TS` のように内部ハイフン含む）。
- 品番は **段数可変**（1トークンなら4段、2トークンなら5段）。**5段を正式に許容**。
- 連番3桁は `{brandCode}-{season}-{categoryCode}` 前方一致でカウント（現行 `productCodePrefix` の挙動そのまま）。

### 2.2 SKU フォーマット（レイヤー4）の追従
- 実装は `{productCode}-{colorwayCode}-{size}`（PR #90/#91 で確定）。
- productCode が5段なら SKU も長くなる（例 `IP-26AW-M-TS-001-{colorwayCode}-{size}`）。許容。spec の SKU 例示に「productCode を継承するため段数可変」と注記。

### 2.3 採番ロジックへの影響（カテゴリ軸）
- **コード変更なし**。`productCodePrefix` は categoryCode をそのまま乗せるので本番運用に既に適合。カテゴリ軸は **docs（spec）更新のみ**。

---

## 3. 副次タスク（本確認書の対象外・記録のみ）

- **本番 product_categories 27件すべて `defaultSizeOptions` = null**。PR #91 でサイズ権威を `defaultSizeOptions` に一本化したため、**本番では SKU 生成ダイアログのサイズ候補が空＝生成導線が実質機能しない**。
- 検証用ダミーではなく**実運用マスターの初期設定**＝「テストデータを本番に入れない」原則には抵触しない。本番書き込みなので慎太郎さんの明示操作・承認下で実施。
- 順序：カテゴリ体系確定（本確認書）→ その後に値（サイズ展開）を慎太郎さんが決定 → 本番UI手入力（推奨）。
- **別タスクとして次セッション以降に起票**。

---

## 4. dev カテゴリ整備（実装①・確定）

### 4.1 方針
- dev の `CUT_SEWN`/`WOVEN`（2件）を、**本番と同じ階層方式のカテゴリに置き換える**。dev は db push 環境・本番データではない。

### 4.2 範囲（確定：本番27件を dev に複製）
- **本番27件を dev に複製**（companyId は dev のものに合わせる）。dev/本番のカテゴリ体系を一致させ、`M-TS` 等の階層コードで品番・SKU 生成を dev で素振りできるようにする。

### 4.3 既存 dev テストデータの扱い（確定：物理削除→作り直し）
- 旧テスト品番・SKU（CUT_SEWN/WOVEN 系）を**物理削除して作り直す**。
  - 対象：`AOI-26AW-CUT_SEWN-001/002`、`NMB-26SS-WOVEN-001`、および紐づく ProductColorway / Sku（PR #91 目視で生成した dev SKU 群）。
  - dev なので物理削除→新カテゴリで品番再作成で良い。FK cascade（Sku.colorwayId Cascade 等）の効き方は実行前に確認。

---

## 5. 確定事項（v1.0 §5 未決を解消）

1. **dev カテゴリ整備の範囲** → 本番27件を dev に複製（§4.2）。
2. **既存 dev テストデータ** → 物理削除して作り直し（§4.3）。
3. **spec ファイルの更新方法** → 確認書を `docs/specs/` に正式保存（v1.0 は `d1c362b` で保存済み・本 v1.1 で更新）。本体仕様書（`02_仕様書_Part2`）は git 管理外のため、ポインタ追記は Notion/Claude.ai 側で慎太郎さんが実施（repo 側では不要）。

---

## 6. 確定設計：シーズン軸（v1.1 新設）

### 6.1 現状（調査で判明）
- season も year も**自由入力 Input**（Select ではない）。選択肢マスターなし。
  - season：`requiredString(20)`、placeholder「例：26SS / 26FW」、採番時 `toUpperCase()`。
  - year：`type=number`、min 2000 / max 2100、placeholder「例：2026」。
- spec の意図（s-1ブリーフは「season を選んで」）に対し、**実装がプルダウン化されていない**＝B-026 未着手箇所。

### 6.2 既存データ（dev / 本番）
| 環境 | season | year | n |
|---|---|---|---|
| dev | 26AW | 2024 | 2 |
| dev | 26SS | 2026 | 1 |
| 本番 | 26AW | 2026 | 2 |

- 大文字小文字・桁数の表記揺れは**現時点なし**（全件 4桁大文字 `YYSS`）。
- **`season="26AW"` に対し dev=year2024 / 本番=year2026 と食い違い**＝season（年込み）と year（年単独）の二重持ちが現に破綻。データが少ない今が直す好機。

### 6.3 確定設計
1. **入力分離**：`year`（プルダウン）＋ `seasonType`（プルダウン7択）。手打ち Input 廃止。
   - year プルダウンの範囲：当年±数年程度（実装時に決定。例 現在年-1 〜 +3）。
2. **season 文字列はシステム自動合成**：`season = {year の下2桁(2桁ゼロ埋め)}{seasonType}`。
   - 例：year=2026 ＋ seasonType=SS → `26SS`。year=2026 ＋ SPOT → `26SPOT`。
   - DB の `Product.season`（VarChar20）は合成結果を保持（既存フィールド・型はそのまま流用可）。
   - **注意：`SPOT` は4字のため `26SPOT` は6字**。VarChar(20) 内なので桁あふれはしないが、品番が `{brand}-26SPOT-{cat}-001` と伸びる。これを許容（5段同様、段の中身が伸びるだけ）。
3. **seasonType enum（7値）とラベル**（同一PRで `Record<SeasonType,string>` 必須＝tsc ルール）：
   | enum | ラベル（日本語） | 合成例（2026年） |
   |---|---|---|
   | SS | 春夏 | 26SS |
   | AW | 秋冬 | 26AW |
   | SP | 春 | 26SP |
   | SU | 夏 | 26SU |
   | FA | 秋 | 26FA |
   | WI | 冬 | 26WI |
   | SPOT | スポット | 26SPOT |
   - `AW`（秋冬2制）と `FA`+`WI`（秋・冬の4制）の併存は (Q) 方針で許容。
4. **採番への波及**：`productCodePrefix` の `season` 引数に「合成済み season 文字列」を渡す。`generateNextProductCodePreview` のプレビューも合成値で表示。採番ロジック自体の式は不変（受け取る season が手打ちか合成かの違いだけ）。

### 6.4 既存データ移行
- 対象は dev 3件・本番2件と少数。
- **dev**：§4.3 で旧テスト品番を作り直すため、新規作成時に year＋seasonType から正しく合成され、year=2024 ミスは自然消滅。
- **本番**：`IP-26AW-M-TS-001` 等2件は `season=26AW / year=2026` で整合済み。seasonType を後付けする場合 `AW` を埋めれば再合成しても `26AW` で不変＝**productCode 遡及なし**。
  - ただし `Product.seasonType` フィールドを新設する場合、既存2件に `seasonType=AW` を埋める移行 UPDATE が要る（本番書き込み・migration の data 部 or 別途 UPDATE）。dry-run ROLLBACK→COMMIT 手順で実施。

### 6.5 schema 変更の要否（実装時に最終判断）
- 案1：`Product.seasonType SeasonType` を新設（enum）＋ `season` は合成結果のキャッシュとして残す。→ **migration 必要**。
- 案2：`seasonType` を持たず、フォームの year＋seasonType 選択から `season` 文字列だけ合成して保存（seasonType は永続化しない）。→ enum 定義は要るが Product への列追加は不要。ただし「この品番の seasonType は何か」を後から構造的に引けない（season 文字列を後方パースする必要）。
- **推奨：案1**（seasonType を正規に持つ。検索・集計・将来の SO 連携で効く）。migration 1本（37本目想定）。最終は実装ブリーフ作成時に schema を grep し直して確定。

---

## 7. 実装スコープの分離（重要）

品番フォーマットの「思想」は本確認書 v1.1 に統合したが、**実装は性質が違うため分離する**。

| 実装 | 性質 | DB | migration | PR |
|---|---|---|---|---|
| ① spec 保存（本確認書 v1.1） | docs のみ | なし | なし | main 直 push |
| ② dev カテゴリ整備（§4） | dev DB 書き込み | dev のみ（db push） | なし | dev 作業（PR 不要／作業ログのみ） |
| ③ シーズンのプルダウン化（§6） | コード＋schema＋本番移行 | dev＋本番 | **あり（37本目想定）** | **新規 PR（migration 入り）** |

- **順序（確定）**：① → ②（軽い・migration なし）→ ③（じっくり・migration 入り PR）。
- ③ は別セッション/別 PR で腰を据えて。本確認書はその設計根拠として参照される。

---

## 8. 実装の段取り（確定後）

A. **spec 更新（docs のみ・main 直 push）**：本確認書 v1.1 を `docs/specs/` に保存。v1.0 は履歴として残置。

B. **dev カテゴリ整備（dev DB のみ）**：本番27件を dev に複製（§4.2）。旧テスト品番・SKU 物理削除→再作成（§4.3）。db push 環境につき migration 不要。**実行前に read-only で本番27件の全カラム吸い出し＋ dev 削除対象の依存 dry-run**（削除まで一気に走らせない）。

C. **シーズンのプルダウン化（新規 PR・migration 入り）**：§6 の設計で実装ブリーフを別途起こす。enum 7値＋ラベル同梱、year/seasonType プルダウン、season 合成、採番プレビュー差し替え、本番既存2件への seasonType 移行。

D. （別タスク・後日）本番 `defaultSizeOptions` 投入（§3）。

---

## 補足：環境・安全
- ①②は **dev DB（hopper:12921）と docs のみ**。本番 DB 書き込みゼロ。
- ③のみ本番書き込み（既存2件の seasonType 移行）が発生＝dry-run ROLLBACK→COMMIT・ホスト目視を厳守。
- 調査フェーズで本番へは SELECT のみ実行済み（書き込みなし）。
- カテゴリ軸の採番ロジックはコード変更なし。シーズン軸は採番が受け取る season を「手打ち→合成値」に替えるのみで採番式自体は不変。
