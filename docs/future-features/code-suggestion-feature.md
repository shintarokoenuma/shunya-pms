# コード自動生成機能 - 仕様検討メモ

**作成日**：2026-05-26
**作成者**：Shin（肥沼慎太郎）+ Claude
**ステータス**：構想段階（Phase 1A 完遂後に正式設計予定）
**起点**：Phase 1A-11（バイヤー）完遂時の動作確認後の議論

---

## 1. 機能概要

会社名・ブランド名・バイヤー名などのマスター登録時、`xxxCode` フィールドに対して AI から候補を提案する機能。既に登録されているコードは提案から除外する。

### 対象マスター（候補）

- Client（`clientCode`）
- Buyer（`buyerCode`）
- Brand（`brandCode`）
- Supplier（`supplierCode`）
- Factory（`factoryCode`）
- Contractor（`contractorCode`）
- ProductCategory（`categoryCode`）
- ExpenseCategory（`expenseCode`）
- ModelCode（モデルコード自体は別ロジックがあるため対象外の可能性）
- Material（`materialCode`）

すべての標準マスターで一貫した UX を提供できれば理想的。

---

## 2. ユーザーストーリー

### ストーリー 1：新規 Client 登録

```
1. /clients/new で companyName 欄に「MARKA」を入力
2. clientCode 欄の右に「✨ 候補」ボタンが表示される
3. ボタンクリック → モーダル or ドロップダウンで候補表示：
   - "MARKA" (★★★ 完全一致)
   - "MK" (★★ 母音省略)
   - "MRKA" (★ 子音抽出)
4. ユーザーが採用したい候補をクリック → clientCode に自動入力
5. 既存 code と衝突するものは候補から除外される
```

### ストーリー 2：新規 Buyer 登録（Case B 想定）

```
1. /buyers/new で
   - クライアント = BEAMS（既存登録あり、clientCode = "BEAMS"）
   - バイヤー名 = "国内事業部"
2. buyerCode 欄の「✨ 候補」ボタンをクリック
3. 候補表示：
   - "BEAMS-DOM" (★★★ 標準語 DOM=Domestic 採用)
   - "BEAMS-JP" (★★ 国コード採用)
   - "BEAMS-DOMESTIC" (★ フル表記)
4. クリックで自動入力、既存衝突は自動除外
```

### ストーリー 3：標準語 + ハイブリッド提案

shunya-master-patterns に定義された略号標準語（DOM/INTL/PB/EC/WHO）を **ルールベース** で確実に提案、加えて AI が **創造的な候補** を追加する。

---

## 3. 設計方針：ハイブリッド（ルール + AI）

### 3.1 ルールベース層(速い、コストゼロ、再現性高)

```typescript
function ruleBasedSuggestions(
  entityType: EntityType,
  inputs: { name: string; clientCode?: string; ... }
): SuggestionCandidate[] {
  // 1. ベース名から英数字を抽出(大文字化)
  // 2. パターン適用:
  //    - 完全一致版(MARKA → "MARKA")
  //    - 母音省略版(MARKA → "MRK")
  //    - 頭文字版("Beams United Arrows" → "BUA")
  //    - 標準語付加(clientCode + "-DOM" / "-INTL" / "-PB" 等)
  // 3. confidence スコア付与
  return candidates
}
```

### 3.2 AI 層(柔軟、文脈理解、コストあり)

```typescript
async function aiSuggestions(
  entityType: EntityType,
  inputs: { name: string; clientCode?: string; ... },
  existingCodes: string[]  // 既存衝突を避けるためのプロンプトコンテキスト
): Promise<SuggestionCandidate[]> {
  // Claude Haiku API を使用(最も安価かつ高速)
  // プロンプト:
  //   - エンティティ種別と命名規則
  //   - 入力された名前
  //   - 既存コード一覧(除外対象)
  //   - 出力形式: JSON array of { code, rationale, confidence }
  const response = await claude.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [...]
  })
  return parseJsonResponse(response)
}
```

### 3.3 統合層(衝突チェック + マージ + 並び替え)

```typescript
async function suggestCode(input): Promise<{
  candidates: { code: string; rationale: string; confidence: number; source: "rule" | "ai" }[]
  conflicts: { code: string; existingEntity: string }[]
}> {
  // 1. ルールベース提案を生成
  const ruleCandidates = ruleBasedSuggestions(...)

  // 2. DB から既存 code を取得
  const existingCodes = await prisma[entityType].findMany({
    select: { [codeField]: true },
    where: { companyId, deletedAt: null }
  })

  // 3. AI 提案を生成(除外コード情報込み)
  const aiCandidates = await aiSuggestions(..., existingCodes)

  // 4. マージ + 重複削除 + 衝突マーク
  // 5. confidence 順に並び替え
  return result
}
```

---

## 4. UI 設計案

### 4.1 既存フォームへの統合

各マスターのフォーム（`client-form.tsx` / `buyer-form.tsx` 等）の `xxxCode` フィールドを変更：

**Before（現在）:**

```tsx
<FormField
  name="buyerCode"
  render={({ field }) => (
    <FormItem>
      <FormLabel>バイヤーコード *</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
    </FormItem>
  )}
/>
```

**After:**

```tsx
<FormField
  name="buyerCode"
  render={({ field }) => (
    <FormItem>
      <FormLabel>バイヤーコード *</FormLabel>
      <div className="flex gap-2">
        <FormControl>
          <Input {...field} />
        </FormControl>
        <CodeSuggestionButton
          entityType="Buyer"
          inputs={{
            name: form.watch("buyerName"),
            clientCode: getSelectedClientCode(form.watch("clientId")),
          }}
          onSelect={(code) => field.onChange(code)}
        />
      </div>
    </FormItem>
  )}
/>
```

### 4.2 候補表示モーダル / Popover

```
┌─────────────────────────────────────┐
│ コード候補                       ✕  │
├─────────────────────────────────────┤
│ ✨ BEAMS-DOM     [採用]              │
│    Domestic 略称 + Client コード    │
│    ★★★ confidence 95%              │
├─────────────────────────────────────┤
│ ✨ BEAMS-JP      [採用]              │
│    国コード採用                     │
│    ★★ confidence 75%               │
├─────────────────────────────────────┤
│ ⚠️ BEAMS-DOMESTIC                   │
│    既存 "BEAMS-DOMESTIC" と衝突     │
│    （Client = MARKA, Buyer ID 123） │
└─────────────────────────────────────┘
```

---

## 5. 技術スタック

| 層 | 技術 |
|---|---|
| API | Claude Haiku 4.5（最安・最速）|
| キャッシュ | 同一入力に対する候補は Redis or in-memory で 1 時間キャッシュ |
| レート制限 | 1 ユーザー 1 分あたり 10 リクエスト（提案ボタン連打防止）|
| フォールバック | AI 失敗時はルールベース候補のみ返す |

---

## 6. データモデル（追加候補）

### 6.1 命名規則設定マスター（オプション）

```prisma
model CodeNamingRule {
  id           String  @id @default(uuid())
  companyId    String  @map("company_id")
  entityType   String  @db.VarChar(50)  // "Client" | "Buyer" | ...
  ruleType     String  @db.VarChar(50)  // "PREFIX_FROM_NAME" | "STANDARD_TERM" | "CUSTOM"
  pattern      String? @db.VarChar(255) // 例: "{client_code}-{dept_slug}"
  priority     Int     @default(0)
  isActive     Boolean @default(true)

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([companyId, entityType, ruleType])
  @@map("code_naming_rules")
}
```

これにより、shunya 社員が UI から「BEAMS の事業部は全部 BEAMS-XXX 形式にする」のような規則をカスタマイズできる。

ただし MVP では **ハードコードされたルール** で十分（あとから DB マスター化）。

### 6.2 コード提案履歴（オプション、学習用）

```prisma
model CodeSuggestionHistory {
  id            String  @id @default(uuid())
  companyId     String  @map("company_id")
  entityType    String  @db.VarChar(50)
  inputs        Json    // 入力された名前等
  suggestions   Json    // 提案された候補
  selectedCode  String? @map("selected_code") @db.VarChar(50)
  userId        String  @map("user_id")

  createdAt     DateTime @default(now())

  @@index([companyId, entityType])
  @@map("code_suggestion_history")
}
```

これを蓄積すれば、後で「どんな候補がよく選ばれるか」を分析して AI プロンプトを改善できる。

---

## 7. Phase 計画

### Phase 1A-15（仮）：機能設計と PoC

- ルールベース層のみ実装
- 1〜2 マスター（Buyer / Client）で UI 統合
- フィードバック収集

### Phase 1A-16（仮）：AI 統合

- Claude Haiku API 連携
- 全マスターに展開
- キャッシュ・レート制限実装

### Phase 1A-17 以降：高度化

- CodeNamingRule マスター化
- 履歴蓄積 → 学習データ化
- 提案精度の継続的改善

---

## 8. リスク・懸念事項

### 8.1 API コスト

Claude Haiku の料金（2026-05 時点）:

- Input: $0.80 / 1M tokens
- Output: $4.00 / 1M tokens

1 リクエストあたり ~500 tokens 想定 → **約 $0.001-0.002 / 提案**

1 日 100 提案 → 月 ~$6。十分許容範囲。

### 8.2 提案の質

- 日本語の社名（カタカナ・漢字混じり）の英字変換は AI に頼る必要あり
- 業界用語（OEM / PB / セレクトショップ等）の理解度依存

### 8.3 ユーザー体験

- 提案待ちで 1-2 秒のラグ → ローディング表示必須
- 「✨ 候補」ボタンの位置・押しやすさ
- 候補が悪いときの「全部却下」フロー

---

## 9. 次回議論時の論点

このメモを起点に、次回（Phase 1A 完遂後）議論する論点：

1. **対象マスターの絞り込み**：最初はどのマスターで実装するか
2. **ルールベース仕様の確定**：標準語辞書 / パターンルール
3. **AI プロンプト設計**：システムプロンプト、出力フォーマット
4. **UI 統合の細部**：モーダル vs Popover、ボタン配置
5. **キャッシュ戦略**：どの粒度で、どこに保存
6. **CodeNamingRule をマスター化するか**：今は不要、将来追加

---

## 10. 関連ドキュメント

- `docs/master-naming-conventions.md`：現状の命名規則の本拠地
- `docs/shunya-master-patterns.md` v1.2：実装パターン集
- `docs/phase1a-11-spec-confirmation-2026-05-25.md`：Phase 1A-11 仕様確定議事録（buyerCode 命名規則の詳細）

---

**次セッション**：本メモを `docs/` 配下に正式配置するか、`docs/future-features/` に新ディレクトリを作って格納するかは Shin と相談して決定。
