# Phase 1A-6 進捗メモ（外注先マスター）

**最終更新**: 2026年5月22日
**現在のステータス**: Phase 1（スキーマ）完了、Phase 2（論理層）待機中
**作業ブランチ**: `feat/contractor-master`（main 最新を含む）

---

## 仕様確定（2026年5月22日 セッションで確定）

| Q | 内容 | 決定 |
|---|---|---|
| Q1 | `isQualifiedInvoiceIssuer` デフォルト | **`true`**（Factory/Supplier と統一、個人事業主はフォーム入力時に手動で false に）|
| Q2 | ロイヤリティ UI | **Phase 2 へ**（DB 列だけ保持）|
| Q3 | 著作権・所有権 UI | **Phase 2 へ**（DB 列だけ保持）|
| Q4 | システムユーザー招待 (`invitedUserId`) | **Phase 2 へ**（DB 列だけ保持）|

→ Q2/Q3/Q4 は **DB 列は維持、フォーム UI のみ非表示**。Phase 2 で横断機能として統合実装する想定。

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
- **isQualifiedInvoiceIssuer デフォルトを true に変更**（Q1=B 反映、2026-05-22）

#### 副次成果: Contact 系命名統一
ClientContact / SupplierContact / FactoryContact / ContractorContact の preferredLanguage カラムに `@map("preferred_language")` を追加。ClientContact には preferredLanguage 自体を新規追加。

#### Migration ファイル（3件、適用済み）
- `20260521155255_add_contractor_master_fields`
- `20260521163304_unify_contact_preferred_language_naming`
- `20260522053450_phase_1a_6_contractor_invoice_issuer_default_true`（Q1=B 反映）

#### コミット
- `7d537a9` feat(phase1a-6): contractor master schema + unify Contact preferred_language
- `885bc3b` Merge branch 'main' into feat/contractor-master
- `f749408` docs: Phase 1A-6 進捗メモ追加
- `7b20d41` feat(phase1a-6): is_qualified_invoice_issuer デフォルトを true に変更

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

- [ ] `contractor-form.tsx` 作成（**7カード**、ロイヤリティ・著作権カードは省略）
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

### Phase 2 送り（DB 列は保持、UI は作らない）
- `royaltyType` / `royaltyRate` / `royaltyMinimum` / `royaltyMinimumCurrency` / `royaltyPaymentCycle`（ロイヤリティ 5項目）
- `defaultPatternOwnership` / `defaultDesignOwnership`（著作権・所有権）
- `invitedUserId`（システム招待）
- `unitFees` (JSON、個別作業単価)

### その他
- `isQualifiedInvoiceIssuer` デフォルト **true**（Factory/Supplier と統一、個人事業主はフォーム入力時に手動で false に切替）

---

## フォーム構成（7カード、MVP 確定版）

1. 基本情報: contractorCode / contractorName / contractorNameEn / isIndividual
2. 専門分野・契約形態: specialties[] / contractType
3. 連絡先: 住所4分割 / phone / fax / email
4. 海外取引: chatTool / chatToolId / preferredLanguage / preferredCurrency / timezone
5. 料金体系: contractType に応じて条件表示
6. 取引条件: taxId / isQualifiedInvoiceIssuer / paymentTermType / closingDay / paymentMonthOffset / paymentDay
7. 担当者・ステータス・メモ: assignedToUserId / status / notes
+ 主担当カード（isIndividual=false の時のみ表示）

---

## 次回再開時の合言葉

新しいセッションでこう言うだけで再開できます:

> Phase 1A-6 の Phase 2（論理層）から再開します。前回までに Phase 1（スキーマ）と shunya-master-patterns v1.1 更新は完了済み。feat/contractor-master ブランチで作業中。`docs/phase1a-6-progress.md` を参照してください。仕様確定は Q1=B / Q2=B / Q3=B / Q4=A。

---

## Phase 1A-6 完了時の処理（将来）

Phase 1A-6 が完了したら、このファイルは以下のどちらかで処理:
- 削除（履歴は Git で復元可能）
- アーカイブ（`docs/archive/` に移動）
- shunya-master-patterns.md の §15 参考実装セクションに統合
