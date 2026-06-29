# shunya-pms セッション引き継ぎメモ（2026-06-29）

## ① 進行中フェーズと完了状態
- Phase 1A〜1B 移行帯。本日は B-063 PR1 を本番まで完了させ、QE-1（見積もりエンジン）設計に着手・確定材料まで到達して区切り。
- シナリオ A 継続（マスター → 業務トランザクション → AI）。AI 前倒しなし。

## ② 本日マージした PR・本番反映
- **PR #95（B-063: Color.colorNameEn 追加＋色名解決）= マージ済み（squash c5a6356）・本番デプロイ済み**。
  - 本番 migration `20260629000000_color_name_en` 適用確認済み（Railway ログ `Applying migration ...` 目視・三重ガード完了）。
  - 9ファイル（schema/migration/types/actions/validator/color-form/colorway-section/edit-page/docs）。gate①修正（編集フォーム initialValues に colorNameEn）も同 squash に内包済み（git show c5a6356 で確認・別PR不要だった）。
  - gate① 完全クリア：色 編集フォームの英語名初期表示（#99→Black/#01→White）＋カラー展開カードの色名解決併記（A:99ブラック/Black・B:01晒し/White・C:柄=colorId未設定で併記なし=正常）を localhost で目視。
- **本番 colorNameEn バックフィル = COMMIT 済み（三重ガード）**。50色に英語名・00（カラー未定）のみ NULL。host=shuttle:16099 照合→dry-run ROLLBACK（en_filled=50/code00_null=1）→GO→COMMIT。dev も同一投入済み。AuditLog は不要判断で残さず。

## ③ dev DB / 環境
- dev=hopper:12921（postgres-7492）／本番=shuttle:16099（postgres-ab6d / internal postgres-ab6d.railway.internal）。
- colors：dev・本番とも51行（50色英語名・00 NULL）。BomItem/PoItem は dev 全 JPY（混在通貨の実データはまだ無い）。量産 WO（PRODUCTION）は dev 0件＝QE-1 の工賃源は空。
- 申し送り：本番 PROD_URL は今回 railway CLI 自己解決した。次回以降は「PROD_URL は人手で渡す／CLI 自己解決しない」に厳格化推奨（host照合+ROLLBACKで今回は担保済み）。
- 後始末メモ：`feat/b-063-color-name-en`（#95 マージ済み）はローカル/remote とも残存＝削除可。`feat/b-065-po-import-colorway`（#94 OPEN・保留）は残す。

## ④ 直近の spec / 参照ドキュメント
- color-master-spec-confirmation-2026-06-01.md（§6-6/L184 に colorNameEn 採用確定を本日追記済み）。
- qe-0-quotation-foundation-spec-confirmation-v1_0-2026-06-12.md（QE 段階分割 §1・取り切り式 Q5）。
- qe-0d-po-bom-cost-linkage-spec-confirmation-v1_0-2026-06-13.md。
- id-map-and-linkage-audit-v0_1-2026-06-25.md（要件A/B §5）。
- 元設計 quotation_engine.md（project knowledge・20260516 v1.0・フル野心版＝過剰スコープ注意）。

## ⑤ 次セッションで最初にやること（優先順）
1. **QE-1 仕様確認書を起こす（最優先・次回これから）**。下記「QE-1 確定事項」をそのまま落とす。`qe-1-spec-confirmation-v0_1-{date}.md` 想定。docs 単独なら main 直可。確定後に実装ブリーフ。
2. その後 B-065 作り直し（B-069 に吸収 or その後）。PR #94 は OPEN のまま保留（主従逆・作り直し前提）。
3. B-069 本体（PO↔品番 解決一本化・案α'・PoItem.productId）も未着手で控える。

### QE-1 確定事項（次回そのまま仕様確認書へ）
- **段階分割（qe-0 §1）**: QE-1＝量産見積「計算」（原反取り切り・数量別単価表）＝B-052本体。QE-2＝見積書化（Quotationモデル・PDF・有効期限）。QE-3+＝マージン4階層・MOQカスタム・多通貨/為替・多言語。
- **★owner上書き（要 spec 明記）**: 慎太郎さん指示で「日英」「為替（ドル円）」を QE-1 v1 に前倒し。qe-0 §1 の staging（為替/多言語=QE-3+）と衝突するため、QE-1 仕様確認書で staging 見直しを明記すること。
- **v1 スコープ（確定）**: 計算ビュー（永続化なし・スキーマ変更なし・#93 material-requirement-section.tsx 隣接/拡張）。原価まで（売価・マージンは QE-3+）。
- **2源集計（確定）**: 原価＝材料費＋工賃。材料費＝BomItem×所要量（#93 が用尺×数量×ロスまで実装済み・×単価が QE-1 増分。取り切り ROLL=ceil(必要量/rollLength)×rollPrice / METER=必要量×unitPrice）。工賃＝PRODUCTION の WorkOrder/WoItem。1枚原価＝(材料費Σ＋工賃Σ)÷Σ productionQuantity。工賃源は dev 空＝「WO未登録なら工賃0で材料費のみ」を正常系に。
- **混在通貨（確定・Q2 で確定）**: 行ごとに currency 保持、USD 行は入力 USD/JPY レートで JPY 換算して合算、USD 換算トグルも提供。レートは v1 保存しない（送付用に残すなら QE-2）。**USD・JPY のみ／EUR・GBP・CNY・VND はブロック**。※Claude Code は「dev 全 JPY だから JPY 限定で実害ゼロ」と提案したが、要件（ベトナム例）に反するため不採用＝混在換算で確定。
- **写像（確定）**: 材料費＝BomItem.itemCategory→InternalCostCategory。工賃＝WoItem.costCategoryId→CostCategory.externalCategory→ExternalCostCategory(SEWING/PROCESSING/OVERHEAD)。表示器 CostBreakdownRow/CostBreakdownSection 型は既存・再利用可。
- **日英（確定）**: 原価ラベルを日英併記まで（QuotationMultilingual 永続化はしない＝QE-2）。
- 残小論点: 割戻し分母＝Σ productionQuantity でよいか／取り切りの出力単位（反数/金額）の見せ方。

## ⑥ メモ・残課題
- **混在通貨は業務の常態**（本日ログ＝memory #18）：項目ごとに JPY/USD 混在。ベトナム＝生地JPY・工賃/プリント/検品/刺繍USD／中国買い＝反製品USD・国内プリント/仕上げJPY／海外販売＝売価USD/EUR。基本通貨はドル円のみ確定・EUR/GBP は通貨として存在も換算 v1 対象外。
- **CMYK/HEX 任意化タスク（後回し・memory #17）**: colors の cmyk/hex を nullable 化（本番スキーマ変更＝三重ガード）＋validator "00"例外を全色一般化＋form 必須マーク除去＋★hex は描画使用ゆえ null時 fallback 必須（CMYK は描画依存なし）。優先度低（当面マスターから選ぶ運用）。着手時 migration timestamp は 20260629000000 より後。
- 既存バックログ（棚卸し §7）：hard-delete 経路（Q1c）／Product採番3桁999桁あふれ（Q1b）／「色が変われば別品番」明文化（小B）／採番retry横断（B-048）／貿易書類・免税製造（#3）／買側請求×発注照合（#4）／仕様書→用尺自動投入（#5）／議事録→タスク化（#6）。

## ⑦ 本日の学び（再発防止）
- spec 本文が古いまま放置される轍：colorNameEn は2026-06-01 spec では「未定（§6-6）」のまま、確定は v0.4 §0 にあった。design-reread で spec を読み直して回避。確定したら spec 本文に必ず追記する（本日 color-master spec に追記済み）。
- squash マージのコミット hash 非一致＝未マージではない：`git branch --contains <元hash>` が main 未到達でも、内容は squash コミットに取り込まれている。判定は `git show <squash>` で実 diff を見る。
- recon の「データ現況」で「設計判断」を上書きしない：Claude Code が「dev 全 JPY だから JPY 限定」と提案したが、要件（混在通貨）が正。spec/確定方針 > データ現況。
