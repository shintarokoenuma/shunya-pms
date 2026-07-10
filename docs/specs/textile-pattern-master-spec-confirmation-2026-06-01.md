# shunya 柄マスター 仕様確認書（仮置き版）

- 作成日: 2026-06-01
- ステータス: **仮置き / 要レビュー**（モデル名・番号体系・種別カタログ・構成色の持ち方はすべて叩き台）
- 関連: Phase 1A-13c 後続（Color マスターの兄弟。Material 色/柄展開の前提となる新マスター）
- 前例: `color-master-spec-confirmation-2026-06-01.md`

---

## 0. このドキュメントの位置づけ

shunya 社内で「柄（デザイン）」を一意に呼べる共通言語を持つための新マスターの設計確認書。Color マスターが「単色の共通言語」だったのに対し、本マスターは「複数色＋構成パターンの共通言語」を担う。本書は仮置き版であり、モデル名・番号体系・種別カタログ・構成色の保持方式は慎太郎さんのレビューで確定させる。

仕入先側の柄表記・品番は各社バラバラで規則性がないためマスター化しない。本マスターは自社の共通言語であり、仕入先の柄呼称は将来 Material 側で「自社柄番号へのマッピング」として紐付ける（Color と同じ思想）。

---

## 1. 背景・設計判断の記録

- **既存スキーマとの関係**: 既存は「柄マスターなし・各テーブルが配色を文字列/Json で直接保持」する設計。`DesignVersion.colorPalette`（`[{name, hex, pantone}]`）は案件ごとのデザイン成果物に紐づく配色データであり、再利用される共通辞書ではない。本マスターはその中央辞書として Color の隣に新設する。
- **柄は本質的に2層構造**: 同じ「ボーダー」でも構成色が違えば別物（ネイビー×白 と 赤×白 は別の柄）。
  - 層1: **柄種別**（無地/ボーダー/ストライプ/チェック/ドット/プリント/総柄/マルチ 等）— 少数・固定的
  - 層2: **柄インスタンス**（種別＋構成色〔Color番号参照〕＋種別固有パラメータ）— 増えていく
  - 本マスターは **層2を主役テーブル**とし、層1（種別）は当面 VarChar で保持（将来の種別マスター切り出しを留保）。Color が status を enum 化しなかったのと同じ段階主義。
- **段階主義**: Color と同様、まず軽量1テーブルで新設し、Material から参照し始める。SKU・Design・在庫ロット等の既存インライン配色列の統合は Phase 1B 以降の横断作業として別チケット化。本マスター新設では触らない。
- **構成色は Color マスターを参照**: 柄インスタンスの構成色は Color の `colorNumber`（2桁）を参照する。柄と色の二辞書が連動する。

### ネーミングの論点（要確定）

「柄＝Pattern」だが、既存スキーマに **型紙の `PatternVersion`（pattern_versions）が存在**するため、`Pattern` は衝突・混同のリスクが高い。本書では仮に **`TextilePattern`（textile_patterns）** を用いる。候補:

| 候補モデル名 | テーブル名 | 懸念 |
|---|---|---|
| `TextilePattern` | `textile_patterns` | 衝突なし。やや長い（仮の第一候補） |
| `Motif` | `motifs` | 短い。ただし「モチーフ」はプリント図案寄りで縞/格子を含みにくい印象 |
| `Design`系 | — | `DesignVersion` と紛らわしく不採用 |
| `Pattern` | — | 型紙 `PatternVersion` と衝突するため不採用 |

---

## 2. 番号体系のルール

色（2桁・色相×濃淡）とは構造が違うため、柄は **種別プレフィックス＋連番** を採用する（論点A・案1）。

- 形式: `種別2文字 - 連番2桁`。例 `ST-01`（ストライプ1号）/ `CK-03`（チェック3号）/ `BD-01`（ボーダー1号）。
- **十の位×一の位の2桁固定にしない理由**: 柄は種別×構成色×パラメータで組み合わせが増え、50色のような事前列挙ができない。種別ごとに連番を伸ばせる方が破綻しない。
- 種別が一目で分かるため、口頭・チャットでも「ストライプの3番」のように運用しやすい。
- 連番は種別内で発番（`ST-01, ST-02, ...`）。3桁が必要になれば `ST-001` へ拡張余地を持たせ、カラム長は余裕を見る。

### 種別プレフィックス一覧（叩き台）

| プレフィックス | 種別 | 説明 |
|---|---|---|
| `BD` | ボーダー | 横縞（日本のアパレル慣習に従い横＝ボーダー） |
| `ST` | ストライプ | 縦縞 |
| `CK` | チェック | 格子（ギンガム/タータン/ウィンドウペン等を内包） |
| `DT` | ドット | 水玉 |
| `PR` | プリント | 図案・グラフィックプリント |
| `AO` | 総柄 | オールオーバー（全面反復柄） |
| `ML` | マルチ | 多色・配色指定なしの混在 |
| `OT` | その他 | 上記に当てはまらない柄 |

※ **無地（SOLID）の扱いは §6 で要確認**。無地は単色であり Color マスターで表現できるため、柄マスター対象外とする案を推奨。

### 予約値（要確認・Color の `00` に相当）

Color は `00`＝カラー未定を予約値に持った。柄マスターにも「柄未定 / 無地（柄なし）」を表す予約エントリを置くか要確認（§6）。Material が「柄あり/なし」を表現するための受け皿。

---

## 3. 種別カタログと代表インスタンスの叩き台

色は全50色を列挙できたが、柄は列挙できないため「種別ごとの代表インスタンス数件」を叩き台として示す。構成色は Color の `colorNumber` を参照（例: `57`＝ネイビー / `01`＝晒し / `99`＝ブラック）。

### BD ボーダー
| 番号 | 呼称 | 構成色（Color番号） | パラメータ（叩き台） |
|---|---|---|---|
| BD-01 | マリンボーダー | `57, 01` | `{pitchMm: 10, ratio: "1:1", direction: "horizontal"}` |
| BD-02 | レッドボーダー | `15, 01` | `{pitchMm: 8, ratio: "1:2", direction: "horizontal"}` |

### ST ストライプ
| 番号 | 呼称 | 構成色 | パラメータ |
|---|---|---|---|
| ST-01 | ネイビーストライプ | `57, 01` | `{pitchMm: 5, ratio: "1:3", direction: "vertical"}` |
| ST-02 | ロンドンストライプ | `55, 01` | `{pitchMm: 4, ratio: "1:1", direction: "vertical"}` |

### CK チェック
| 番号 | 呼称 | 構成色 | パラメータ |
|---|---|---|---|
| CK-01 | ギンガムチェック | `15, 01` | `{subType: "gingham", gridMm: 5}` |
| CK-02 | タータンチェック | `47, 57, 99` | `{subType: "tartan", gridMm: 30}` |

### DT ドット
| 番号 | 呼称 | 構成色 | パラメータ |
|---|---|---|---|
| DT-01 | ピンドット | `57, 01` | `{diameterMm: 2, spacingMm: 8, layout: "regular"}` |

### PR プリント
| 番号 | 呼称 | 構成色 | パラメータ |
|---|---|---|---|
| PR-01 | フローラルプリント | `73, 41, 31, 01` | `{motif: "floral", repeatMm: 120}` |

※ 呼称・構成色・パラメータはすべて仮置き。実運用の柄・呼称に合わせて随時差し替え可。

---

## 4. データモデル（Prisma 案・要レビュー）

既存マスター（MaterialCategory / Color 等）と同じパターン（companyId・status・timestamps・soft delete・`@@unique([companyId, code])`・`@@map`）に揃える。

```prisma
/// 自社柄マスター（社内の柄共通言語）
/// 注: 型紙の PatternVersion とは別物。モデル名は §1 で要確定（仮 TextilePattern）。
model TextilePattern {
  id            String   @id @default(uuid())
  companyId     String   @map("company_id")

  patternNumber String   @map("pattern_number") @db.VarChar(10)  // "ST-01"（種別プレフィックス＋連番）
  patternName   String   @map("pattern_name") @db.VarChar(100)   // 呼称（ネイビーストライプ等）

  patternType   String   @map("pattern_type") @db.VarChar(30)    // BORDER/STRIPE/CHECK/DOT/PRINT/MULTI/OTHER（当面 VarChar、将来種別マスター化を留保）

  // 構成色: Color.colorNumber への参照配列（軽量版）
  colorNumbers  Json     @map("color_numbers")  // ["57","01"]
  // 種別固有パラメータ（種別ごとに可変）
  parameters    Json?    // ボーダー{pitchMm, ratio, direction} / チェック{subType, gridMm} / ドット{diameterMm, spacingMm} ...

  sortOrder     Int      @map("sort_order")

  status        String   @default("ACTIVE") @db.VarChar(20)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  deletedAt     DateTime? @map("deleted_at")

  @@unique([companyId, patternNumber])
  @@index([companyId, patternType])
  @@map("textile_patterns")
}
```

論点メモ:
- `patternNumber` は `VarChar(10)`（`ST-01` 形式＋3桁拡張余地）。先頭ゼロ・プレフィックス保持のため Int は不可。
- **構成色の持ち方（軽量版 vs リッチ版・要確認）**:
  - 軽量版（上記）: `colorNumbers: ["57","01"]`。色の順序・比率は `parameters` 側に持つ。Color の `availableColors` Json方式と整合・実装が軽い。
  - リッチ版: `colorComposition: [{colorNumber, role, widthMm, order}]` のオブジェクト配列。ボーダーの色別幅など配置情報を構造として持てる。
  - 厳密版: 中間テーブル `TextilePatternColor`（FK で Color を参照、比率・順序カラムを持つ）。整合性は最強だが重い。
  - **推奨**: まず軽量版で始め、配置・比率の厳密管理が要になったらリッチ版→中間テーブルへ段階移行（Color の段階主義に合わせる）。
- `patternType` を当面 VarChar とするか、最初から enum 化するかは §6。Color は status を VarChar にした前例あり。
- 構成色 Color番号の **存在検証**（実在しない番号の混入防止）を validator 側で行うか要検討（Json配列方式は DB レベルの FK が効かないため）。

---

## 5. Material / 既存柄・配色フィールドとの関係

- **Material 側**: 先染め柄生地（ストライプ生地・チェック生地等）は素材自体が柄を持つ。Material から本マスターを参照する受け皿を将来追加（例: `Material.patternNumbers: ["ST-01"]` または単一参照）。仕入先のバラバラな柄呼称を自社番号にマッピングする受け皿として機能（Color と同じ役割）。
- **Design 側**: プリント柄・配色デザインは案件のデザイン成果物に属する。`DesignVersion` からの参照は Phase 1B 以降の横断統合で扱う。本マスター新設では触らない。
- **参照の起点**: Color と同様、当面は **Material 側から参照し始める**のが筋（§6 で確認）。

---

## 6. 未確定事項（要・慎太郎さん確認）

1. **モデル名**: `TextilePattern` でよいか（型紙 `PatternVersion` との衝突回避）。`Motif` 等の別案を採るか。
2. **無地（SOLID）の扱い**: 無地は柄マスター対象外（単色は Color で表現）でよいか。それとも「柄なし」を表す予約エントリを柄マスターに置くか。
3. **予約値**: Color の `00` に相当する「柄未定 / マルチ」の予約エントリを設けるか。設ける場合の番号（例 `ML-00`）。
4. **番号体系**: 種別プレフィックス＋連番（`ST-01`）で確定してよいか。連番は2桁／3桁どちらを既定とするか。
5. **種別カタログ**: §2 の8種別（BD/ST/CK/DT/PR/AO/ML/OT）で過不足ないか。サブタイプ（ギンガム/タータン/ウィンドウペン等）は `parameters.subType` で吸収する方針でよいか。
6. **構成色の持ち方**: 軽量版（`colorNumbers` 配列）で始める方針でよいか。ボーダーの色別幅・順序を最初から構造で持ちたい場合はリッチ版を初手から採るか。
7. **patternType の型**: 当面 VarChar（Color の status 前例）でよいか、最初から enum 化するか。
8. **構成色の存在検証**: Color番号の実在チェックを validator で行うか（Json配列は DB FK が効かないため）。
9. **Material 参照の形**: `Material` から柄を参照するカラム名・単一/複数（`patternNumbers` 配列 か 単一参照 か）。
10. **UI**: 一覧/詳細/新規/編集に加え、構成色を Color マスターから選ぶ UI（ColorSwatch 流用）と、柄プレビュー（縞/格子/水玉の簡易描画）をどこまで作るか。

---

## 7. 次のステップ

1. 本書の論点（特に §6-1 モデル名 / §6-4 番号体系 / §6-6 構成色の持ち方）をレビュー → 確定。
2. モデル確定 → schema 追加（**migration を含む = 本番 DB スキーマ変更**）。着手前に dev リンク（`7492`）と migration 内容を確認。
3. 初期種別カタログ＋代表インスタンスの seed 作成（AuditLog 書き込み込み。B-010 の方針に準拠）。
4. 一覧 / 新規 / 詳細 / 編集 UI 整備（`shunya-master-patterns` に準拠、Color マスターのカテゴリパターンを流用）。構成色選択 UI（ColorSwatch 流用）・柄プレビューを検討。
5. Material から柄マスターを参照する受け皿を追加（PR-3 相当の柄版。色版と並行 or 後続）。
