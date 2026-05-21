# Phase 1A-6 進捗メモ（外注先マスター）

**最終更新**: 2026年5月22日
**現在のステータス**: Phase 1（スキーマ）完了、Phase 2（論理層）待機中
**作業ブランチ**: `feat/contractor-master`（main 最新を含む）

---

## 完了済み

### Phase 1: スキーマ ✅

#### Contractor モデル修正
- 住所4分割（postal_code / prefecture / city / address_line2 / address_en / fax 追加）
- 取引条件フィールド統一（paymentMonthOffset / paymentDay）
- ContractorStatus enum 新設（String → enum 化）
- assignedToUserId 担当者カラム追加
- ContractorContact モデル新設（法人外注先の主担当者用）
- インデックス追加（country / assignedToUserId）

#### 副次成果: Contact 系命名統一
ClientContact / SupplierContact / FactoryContact / ContractorContact の preferredLanguage カラムに `@map("preferred_language")` を追加。ClientContact には preferredLanguage 自体を新規追加。

#### Migration ファイル（2件、適用済み）
- `20260521155255_add_contractor_master_fields`
- `20260521163304_unify_contact_preferred_language_naming`

#### コミット
- `7d537a9` feat(phase1a-6): contractor master schema + unify Contact preferred_language
- `885bc3b` Merge branch 'main' into feat/contractor-master

### shunya-master-patterns v1.1 + phase2-roadmap v0.1 ✅
- PR #12 マージ済み（main に反映済み）

---

## 次のステップ: Phase 2（論理層）

shunya-master-patterns §12 Phase 2 のチェックリスト:

- [ ] `src/lib/validators/contractor.ts` 作成
- [ ] `src/app/(app)/contractors/_components/labels.ts` 作成（共通モジュール re-export 中心）
- [ ] `src/lib/actions/contractors.ts` 作成（8関数）
  - listContractors / getContractor / createContractor / updateContractor
  - archiveContractor / restoreContractor
  - checkContractorUsage / deleteContractorPermanently
- [ ] tsc clean 確認
- [ ] 論理層コミット

---

## Phase 3: UI

- [ ] `contractor-form.tsx` 作成（7-8カード）
- [ ] `contractor-delete-button.tsx` 作成
- [ ] `contractors-table.tsx` 作成
- [ ] `contractors-search.tsx` 作成
- [ ] `contractors-pagination.tsx` 作成
- [ ] `page.tsx` / `new/page.tsx` / `[id]/page.tsx` / `[id]/edit/page.tsx` 作成
- [ ] tsc clean 確認
- [ ] ナビゲーション（nav-items.ts）追加 / enabled: true 確認
- [ ] UI コミット

---

## Phase 4: PR & デプロイ

- [ ] push → PR 作成
- [ ] PR マージ
- [ ] main 最新化 + ブランチ削除
- [ ] 本番デプロイ完了確認
- [ ] **動作確認7項目**

---

## 仕様確定メモ（フォーム実装で必要）

### 住所
- 4分割で統一（country=JP 時は postal_code / prefecture / city 必須化）

### ContractorContact（主担当）
- isIndividual=false（法人）時のみ主担当カード表示
- 個人事業主は本人=担当者なので主担当不要

### 料金体系（contractType 連動表示・案A）
- `PACKAGE` → packageFee のみ表示
- `HOURLY` → hourlyRate のみ表示
- `MONTHLY` → monthlyFee のみ表示
- `PER_TASK` → 何も表示せず案内文「個別単価は Phase 2 実装予定」
- `HYBRID` → packageFee / hourlyRate / monthlyFee すべて表示
- contractType 切替時は値を自動クリアしない
- 非表示中の値があれば「※ 現在非表示: パッケージ料金 ¥XX,XXX が登録されています」のような注意書きを契約形態セレクト下に表示

### ロイヤリティ
- 5項目全部フォームに含める（royaltyType / royaltyRate / royaltyMinimum / royaltyMinimumCurrency / royaltyPaymentCycle）

### Phase 2 送り
- `unitFees`（JSON）は DB 列だけ残し、UI は Phase 2 へ
- `invitedUserId` も Phase 1A-6 では UI 非表示（DB 列のみ）

### その他
- `isQualifiedInvoiceIssuer` デフォルト false（個人事業主の免税が多い実態を踏まえ、他マスターと違える）
- `defaultPatternOwnership` / `defaultDesignOwnership` はデフォルト `SHUNYA`、フォームに含める

---

## フォーム構成案（7-8カード）

1. 基本情報: contractorCode / contractorName / contractorNameEn / isIndividual
2. 専門分野・契約形態: specialties[] / contractType
3. 連絡先: 住所4分割 / phone / fax / email
4. 海外取引: chatTool / chatToolId / preferredLanguage / preferredCurrency / timezone
5. 料金体系: contractType に応じて条件表示
6. ロイヤリティ・著作権: royaltyType / royaltyRate / royaltyMinimum / royaltyMinimumCurrency / royaltyPaymentCycle / defaultPatternOwnership / defaultDesignOwnership
7. 取引条件: taxId / isQualifiedInvoiceIssuer / paymentTermType / closingDay / paymentMonthOffset / paymentDay
8. 担当者・ステータス・メモ: assignedToUserId / status / notes
+ 主担当カード（isIndividual=false の時のみ表示）

---

## 次回再開時の合言葉

新しいセッションでこう言うだけで再開できます:

> Phase 1A-6 の Phase 2（論理層）から再開します。前回までに Phase 1（スキーマ）と shunya-master-patterns v1.1 更新は完了済み。feat/contractor-master ブランチで作業中。`docs/phase1a-6-progress.md` を参照してください。

---

## Phase 1A-6 完了時の処理（将来）

Phase 1A-6 が完了したら、このファイルは以下のどちらかで処理:
- 削除（履歴は Git で復元可能）
- アーカイブ（`docs/archive/` に移動）
- shunya-master-patterns.md の §15 参考実装セクションに統合
