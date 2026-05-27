# Phase 1A 改善バックログ

Phase 1A の動作確認 / 業務確認の過程で見つかった改善案を、優先度付きで記録するライブドキュメント。
各項目が完了したら「対応済み」セクションに移動する。

---

## 未対応

### B-001: Supplier 編集画面で「適格請求書発行事業者」OFF 時の Contractor 誘導アラート

- **記録日**: 2026-05-27
- **記録者**: Shin（肥沼慎太郎） + Claude
- **優先度**: 中
- **目安タイミング**: Phase 1A 完了後または手すきの時に対応

#### 背景

shunya の業務設計では、取引先を以下のように使い分けている：

- **Supplier（仕入先）**：適格請求書発行事業者を前提とした取引先
- **Contractor（外注先）**：適格請求書発行事業者ではない仕入先 / 個人事業主

Supplier 編集画面で `isQualifiedInvoiceIssuer` を OFF に切り替えると、業務設計上は「この取引先は本来 Contractor として管理すべき」というシグナルになる。

#### 改善内容

Supplier 編集画面で `isQualifiedInvoiceIssuer` チェックボックスが OFF に切り替えられた瞬間、以下のアラート（Alert または Tooltip）を表示する：

> 「適格請求書発行事業者ではない場合は、Contractor（外注先）マスターでの管理が推奨されます。詳細は『取引先マスター使い分けガイド』を参照してください。」

可能であれば「Contractor として新規作成 →」のリンクボタンも添える。

#### 実装ヒント

- `src/app/(app)/suppliers/_components/supplier-form.tsx` の `isQualifiedInvoiceIssuer` Field 配下に条件付き Alert を配置
- `form.watch("isQualifiedInvoiceIssuer")` で監視
- 値が false かつ初期値が true（既存 Supplier の変更）の時にだけ目立つ警告色で表示
- 新規作成時はサラッと薄めの案内に留める

---

## 対応済み

（まだなし）

---

## 運用ルール

- 1 項目につき 1 セクション、見出しは `### B-NNN: 短いタイトル`
- 「対応済み」へ移動する際は、その下に「対応 PR: #XX」「対応日: YYYY-MM-DD」を追記
- 軽い改善は本 backlog に残し、まとまった機能は通常の Phase 仕様確定議事録で扱う
