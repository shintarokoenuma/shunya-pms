# B-066 柄マスター（層2 TextilePattern）仕様確認書 v1.1

- 作成日: 2026-06-17
- ステータス: 確定（2026-06-17 セッションで慎太郎さんと合意）
- 関連: textile-pattern-master-spec-confirmation-2026-06-01（叩き台・本書で上書き）/ color-master の兄弟
- 重要: 旧 spec の「構成色 Color番号配列」「parameters Json」は本書で**不採用**に確定（§2）

## 0. 位置づけ
柄を社内で一意に呼ぶ共通言語（D#）を持つ層2マスター。Color マスターの兄弟。
仕入先の柄呼称・先方デザイン番号はマスター化せず、発注書/BOM 側に文字列で乗る（C/# と同じ思想）。

## 1. 柄の分類（2026-06-17 確定）
- 織り柄（生地の組織）= ボーダー(BD) / ストライプ(ST) / チェック(CK)。生地そのものの構造。
- プリント(PR) = 図案・グラフィック。ドットはプリントに内包（独立種別を作らない）。
- 無地 = カラーで対応（柄マスター対象外・層2にインスタンスを作らない）。

## 2. 二層構造
- 層1 TextilePatternType（種別）= 既存。**本タスクで DT/SOLID を ARCHIVED 化し7種に整理**（§3）。
- 層2 TextilePattern（具体的な1柄）= **本タスクで新設**。

## 3. 層1 整理（DT/SOLID を外す・確定）
- 既存9種（SOLID/BD/ST/CK/DT/PR/AO/ML/OT）から **DT（ドット）と SOLID（無地）を ARCHIVED 化**。
  - ドット → プリント(PR)に内包。
  - 無地 → カラーで対応。
- 残る7種: BD / ST / CK / PR / AO / ML / OT。
- 方式: 案1（非破壊・soft delete 方針と一致）= status を ARCHIVED に。物理削除しない。
- seed 定義 `scripts/seeds/textile-pattern-types-core.ts` から DT/SOLID の2行を削除（再 seed で復活させない）。
- dev DB（hopper:12921）= 該当2件を ARCHIVED 化。
- 本番 DB（shuttle:16099）= 該当2件を ARCHIVED 化。**本番操作・段階承認必須**（接続先確認→dry-run ROLLBACK→件数検証→COMMIT）。

## 4. 層2 TextilePattern が持つもの（軽量・確定）
- D#（patternNumber）… `BD-A` 形式＝種別プレフィックス（層1 typeCode と一致）＋ "-" ＋ 英字枝番（A/B/C…）。VarChar(10)。人が手で振る（自動採番しない）。
- 呼称（patternName・手入力）… 「black×white ボーダー」「カモフラージュA」等。VarChar(100)。
- 種別参照（typeId）… 層1 TextilePatternType への緩い参照（純 scalar・FK制約なし・@relation なし。colorId/markingRecordId と同方式）。
- 持たないもの（確定）: 構成色（Color番号）/ parameters（ピッチ・格子サイズ等）。
  - 理由: マルチボーダー・マルチストライプは色番号で割り切れない。色の実指定は発注書側（先方デザイン番号）に乗る。柄マスターは「D#として呼べる」までに徹する。

## 5. データモデル（Prisma 案）
```prisma
/// 自社柄マスター（社内の柄共通言語・層2）
/// 注: 型紙 PatternVersion とは別物。
model TextilePattern {
  id            String   @id @default(uuid())
  companyId     String   @map("company_id")

  patternNumber String   @map("pattern_number") @db.VarChar(10)  // "BD-A"
  patternName   String   @map("pattern_name") @db.VarChar(100)   // 手入力呼称
  typeId        String?  @map("type_id")  // TextilePatternType.id 緩い参照（純 scalar）

  sortOrder     Int      @map("sort_order")
  status        String   @default("ACTIVE") @db.VarChar(20)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  deletedAt     DateTime? @map("deleted_at")

  @@unique([companyId, patternNumber])
  @@index([companyId, typeId])
  @@map("textile_patterns")
}
```

## 6. ProductColorway への配線（増設）
- `patternId String?`（colorId の隣・純 scalar・緩い参照）を ADD COLUMN（非破壊）。
- 「カラーウェイの正体」= 単色（colorId）or 柄（patternId）。patternId は任意追加（null=従来どおり単色）。
- 無地は patternId=null（colorId のみ）で表現＝層2に無地インスタンスを作らない。
- BomItemColorway・C/# マトリクスは変更不要（カラーウェイが単色でも柄でも、資材×カラーウェイの先方品番を持つ意味は同じ）。

## 7. UI
- colorway-section（カラー展開カード）: 編集ダイアログに pattern-picker を color-picker の隣に追加。一覧に柄バッジ。
- 付属マトリクス列見出し: 上段 colorwayCode（`BD-A` が入る・90px に収まる）/ 下段 colorwayName。
  - 呼称が長いと 90px をはみ出す既存挙動 → truncate ＋ ホバーで全文ツールチップ（柄に限らない既存課題・軽く対応 or 別タスク）。
- 柄プレビュー（縞/格子の簡易描画）= **作らない（確定）**。構成色を持たないため縞色を描けない。D#（`BD-A`）表示とバッジのみ。

## 8. 実装段取り（Color の #83→#85 と同型）
- ① 層1整理（DT/SOLID を ARCHIVED 化・seed 定義から2行削除）。本番 ARCHIVED は段階承認。
- ② TextilePattern マスター本体（schema＋migration＋CRUD＋一覧/編集 UI）。migration 1本。
- ③ ProductColorway に patternId 増設＋ pattern-picker。migration 1本（ADD COLUMN）。
- 推奨順: ①→② を先に固め、③は別 PR。①は②の前提。

## 9. カラーの罠・踏襲チェックリスト（Color/種別マスター実装ブリーフから移植）
- [ ] 監査網羅型の罠 = 非該当（product-colorways は手書き afterData 方式）。patternId 増設でビルド壊れない。
- [ ] index-browser 罠 = pattern-picker の型を中立モジュール（src/lib/types/*.ts・prisma非依存）に逃がす。
- [ ] dev 起動の罠 = migration 後 lsof -ti:3000,3001 | xargs kill -9 → npx prisma generate → rm -rf .next → npm run dev。
- [ ] status は VarChar(20)・enum 化しない（軽量カテゴリ前例）。
- [ ] AuditLog entityType を seed と CRUD で "TextilePattern" に統一（層1整理の AuditLog は "TextilePatternType"）。
- [ ] git add は明示パスのみ（-A / . は使わない）。
- [ ] 本番 seed/操作: dry-run 先行・接続先確認（shuttle:16099）・safety-check 全面適用・不可視文字 tr -d '[:space:]'・公開プロキシ DATABASE_PUBLIC_URL。

## 10. 残課題・将来
- カモフラ CF: 当面 AO（総柄）に寄せる。独立種別 CF が要るなら層1に1件 seed 追加（別対応）。
- 発注書↔柄の橋渡し（先方デザイン番号の自動反映）= B-065（C/# 自動反映）の柄版として別タスク。
- 付属マトリクス列見出しの truncate ＋ ツールチップ = 柄に限らない既存課題。
