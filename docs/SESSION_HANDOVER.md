# 引き継ぎメモ (2026-06-02 セッション末 / B-006・B-010横展開 完了 + マスター完了確認 + 品質表示統合方針決定)

## ① 進行中フェーズと完了状態

- **B-006（Material UPDATE auditLog が categoryId を記録しない・high）: ✓ 完了**（PR #55 / c8d5c2a）。原因＝手書きホワイトリスト漏れ。before/after に categoryId を1行ずつ追加。dev で a/b/c 検証完了（after_category が実UUID・誤検知なしを確認）。
- **B-010 横展開（seed の AuditLog 棚卸し）: ✓ 完了**（PR #56 / d28d938）。NG は seed-categories.ts 1件のみ。Lv1/Lv2 の create 直後に tx.auditLog.create を同一tx内追加。dev で冪等性確認（実行前後で件数不変）。
- **引き継ぎメモ更新（SESSION_HANDOVER.md）**: 本セッションで複数回更新。docs単独のため main 直 push 運用。
- **★マスターフェーズは事実上完了を確認**: 棚卸しの結果、メインマスター14個（クライアント/ブランド/仕入先/工場/外注先/バイヤー/納品先/型番/素材/素材カテゴリ/商品カテゴリ/原価費目/カラー/柄種別）すべて schema+actions+validator+UI+nav 完備。未着手は ExchangeRate（意図的にPhase 1B直前へリスケ済）・Inquiry（CRM寄り・nav enabled:false）・参照データ系3つ（HsCode/FtaRule/BusinessTermsGlossary、B-017前提）のみ。→ 必須マスターの残りは無い。

## ② PR と状態（すべてマージ済み）

- PR #55（c8d5c2a）: B-006 updateMaterial AuditLog に categoryId 追加。
- PR #56（d28d938）: B-010 横展開 seed-categories.ts に AuditLog(CREATE) 追加。
- ローカルは main・クリーン。

## ③ dev DB の状態

- 接続先 dev（.env=hopper:12921、railway run=postgres-7492.internal）。本番操作は本セッション一切なし。
- Railway構成の唯一の正：本番=ab6d/shuttle:16099、dev=7492/hopper:12921。

## ④ 次セッションで最初にやるべきこと（優先順）

- **マスターは完了とみなす。** 次はシナリオA の次段＝業務トランザクション（品番カルテ/SKU/見積もり/発注/受注、nav で enabled:false の群）への入り口設計。マスター量産と違い業務ロジック・状態遷移・金額計算が絡むため、まず仕様確認（Part2 ID体系/Part3 機能要件/見積エンジン/在庫移動平均/請求FTA 等）から入る。
- 着手前に「どの業務トランザクションを最初の山にするか」を決める（品番カルテ起点が自然と思われるが要相談）。
- 軽微な実害修正を先に潰したい場合は B-015（価格系含む監査残漏れ）も候補。

## ⑤ 注意点・残課題

- PR #56 の afterData に seedScript キーを追加。準拠形が同キーを持つか未確認（実害なし・B-015/B-017 の監査整理時にまとめて確認）。
- Git運用ルールをスキル化済み（shunya-git-workflow）: docs単独は main直push可、コードを1行でも含めば必ずPR。
- quality-label-app は本アプリ自体が未完成（後述B-020）。統合前にまず単体の動作確認が必要。
- quality-label-app の共有パスワード（admin/admin123）は変更推奨。

## ⑥ 新規バックログ（番号は仮・正式採番は慎太郎さん）

- **B-015**: Material UPDATE 監査スナップショット残漏れ補完（categoryId 以外に12〜13フィールド欠落。特に unitPrice/currency/unit は価格変更履歴として優先度高め）。検討：欠落スカラ列挙追加 vs ホワイトリスト方式の全マスター横断見直し。
- **B-016**: 色指示の体系・番号・色名フィールド（PANTONE/DIC 等）を手入力で持てるよう Color マスター拡張。色データ全ライブラリは自前保持しない（ライセンスリスク・実益薄）。番号は識別子文字列なので問題なし。schema 変更を伴う可能性・別PR・要仕様確認。
- **B-017**: prisma/seed.ts 参照データ系（HsCode/FtaRule/BusinessTermsGlossary）の監査ログ方針検討。upsert 冪等性との整合含む。ブートストラップ seed（Company/User自身）は対象外。
- **B-018**: 品番に紐づく出荷・貸出伝票の発行ページ（先上げサンプル出荷・スワッチ出荷・貸出）。ブランド単位対応も可。タスク管理（出荷・貸出の業務トランザクション）に内包。論点：返却管理の要否・伝票単位（品番/SKU/生地スワッチ）・在庫引当の要否・既存 DeliveryNote 系との様式/採番共通化。
- **B-019**: CSV インポート/エクスポート機能（旧 Phase 1A-14）。マスター移行用は後回し（マスターは都度フォーム登録で足りる）。本命は受注取り込み・発注など業務トランザクション側のCSV。実働確認後、Phase 2以降に業務に即して設計。
- **B-020（★本セッションで方針決定）**: 品質表示メーカー（quality-label-app）の shunya-pms 統合。
  - **統合方針＝①完全統合で確定**（移植して quality-label-app は廃止、データを shunya に一本化）。②API連携/③iframe は不採用。
  - 実体: Railway稼働中の独立アプリ（Express+素のHTML/JS+Postgres、wholesome-unity プロジェクト内、GitHub shintarokoenuma/quality-label-app、引き継ぎ書2026-05-09あり）。
  - shunya に新規で必要なマスター: JIS絵表示（48種・SVG）/ 繊維名（27種・家庭用品品質表示法 別表第二）/ 付記用語（13件）。印刷メーカーは Supplier/Factory への統合可否を検討。
  - 移植コア機能: 縫製仕様書AI読取（Claude Vision）/ 数量マトリックス（カラー×サイズ）/ 3種PDF（品質表示・下げ札・アテンション）/ 発注書PDF / Resend メール送信。React+Prisma へ書き直し、PDF生成方式は要選定（Puppeteer継続 or 別ライブラリ）。
  - 連携の核: 品番カルテ（Product）・SKU・BOM（組成/HSコード/用尺）・発注（PO）。先方品番が下げ札・品質表示・納品書に載る。
  - 共有リソース整理: R2 prefix（saagara-images を3アプリ共有）、Resend ドメイン（info@shunya.cc 共有）。
  - 着手前提: Phase 1A完了後、かつ品番カルテ・SKU・BOM・発注が動いてから。今は移植着手しない。統合前に quality-label-app 単体の動作確認（メール送信・各マスターCRUD・直近push反映状態の切り分け）を済ませる。

## ⑦ 本日マージされた PR 一覧

- PR #55（c8d5c2a）: B-006 updateMaterial AuditLog に categoryId 追加
- PR #56（d28d938）: B-010 横展開 seed-categories.ts に AuditLog(CREATE) 追加
- （docs）SESSION_HANDOVER.md 更新 fb6408a（main直push）

## ⑧ 本日のその他の成果

- Git運用ルールを新規スキル shunya-git-workflow として作成・登録（docs単独=直push可 / コード含む=PR必須）。
- マスターフェーズ完了の確認（棚卸し実施）。
- 品質表示メーカー統合の方針を①完全統合に決定。

## ⑨ 次セッション冒頭の手順

- このメモを貼り付け → 状態復元
- git checkout main && git pull origin main で最新確認（#55・#56 反映済み）
- dev作業時は grep -E '^DATABASE_URL' .env | sed -E 's|.*@([^/]+)/.*|HOST=\1|' で dev（hopper:12921）確認
- 本番操作時は §③ で host照合・safety-check 全面適用
- Git操作は shunya-git-workflow スキルに従う（docs単独=直push可 / コード含む=PR必須）
